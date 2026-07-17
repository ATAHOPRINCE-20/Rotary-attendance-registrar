import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './utils/rate-limit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { registrationId } = req.body;

  if (!registrationId) {
    return res.status(400).json({ error: 'Missing registrationId' });
  }

  // 0. Rate Limiting (30 requests per minute per IP for public registrations)
  const rateLimitResult = await rateLimit(req, 'send-welcome-whatsapp', 30, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  try {
    // 1. Fetch the registration to ensure it exists and get details using Service Role
    const { data: reg, error: regError } = await supabase
      .from('registrations')
      .select('*, events(title), organizations(name, whatsapp_welcome_template)')
      .eq('id', registrationId)
      .single();

    if (regError || !reg) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (!reg.phone) {
      return res.status(400).json({ error: 'No phone number provided for this registration' });
    }

    // 2. Format the message
    // @ts-ignore
    const eventTitle = reg.events?.title || "Event";
    // @ts-ignore
    const orgName = reg.organizations?.name || "Rotary Club";
    // @ts-ignore
    const customTemplate = reg.organizations?.whatsapp_welcome_template;

    let welcomeMessage = "";
    if (customTemplate && customTemplate.trim()) {
      welcomeMessage = customTemplate
        .replace(/{full_name}/g, reg.full_name)
        .replace(/{event_title}/g, eventTitle)
        .replace(/{qr_ref}/g, reg.qr_ref)
        .replace(/{org_name}/g, orgName);
    } else {
      welcomeMessage = `Welcome to *${orgName}*!\n\nDear *${reg.full_name}*, thank you for registering for *${eventTitle}*.\n\nYour Registration Code is: *${reg.qr_ref}*.\n\nWe look forward to hosting you!`;
    }

    // 3. Forward the request to the user's custom gateway (HTTP)
    const GATEWAY_BASE_URL = "http://ugpay.tech:3000";
    const webhookUrl = `${GATEWAY_BASE_URL}/send-whatsapp/${reg.organization_id}`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: reg.phone,
        message: welcomeMessage
      })
    });

    const result: any = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to forward message via server-side gateway');
    }

    return res.status(200).json({ success: true, gatewayResponse: result });
  } catch (error: any) {
    console.error('Proxy routing error:', error);
    return res.status(500).json({ error: error.message || 'Failed to proxy WhatsApp message' });
  }
}
