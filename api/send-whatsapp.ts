import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../src/lib/rate-limit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { registrationId, webhookUrl, phone, message } = req.body;

  // 1. Welcome WhatsApp Registration Flow
  if (registrationId) {
    const rateLimitResult = await rateLimit(req, 'send-welcome-whatsapp', 30, 60);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: rateLimitResult.error });
    }

    try {
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

      const eventTitle = reg.events?.title || "Event";
      const orgName = reg.organizations?.name || "Rotary Club";
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

      const GATEWAY_BASE_URL = "http://ugpay.tech:3000";
      const destUrl = `${GATEWAY_BASE_URL}/send-whatsapp/${reg.organization_id}`;

      const response = await fetch(destUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: reg.phone, message: welcomeMessage })
      });

      const result: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to forward welcome message via server-side gateway');
      }

      return res.status(200).json({ success: true, gatewayResponse: result });
    } catch (error: any) {
      console.error('Welcome WhatsApp error:', error);
      return res.status(500).json({ error: error.message || 'Failed to send welcome WhatsApp' });
    }
  }

  // 2. Direct Admin WhatsApp Message Flow
  if (!webhookUrl || !phone || !message) {
    return res.status(400).json({ error: 'Missing parameters: registrationId or (webhookUrl, phone, message)' });
  }

  const rateLimitResult = await rateLimit(req, 'send-whatsapp', 20, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  if (!webhookUrl.startsWith('http://ugpay.tech:3000/send-whatsapp/')) {
    return res.status(400).json({ error: 'Unauthorized webhookUrl destination' });
  }

  const orgId = webhookUrl.split('/').pop();
  if (!orgId) {
    return res.status(400).json({ error: 'Invalid webhookUrl organization parameters' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await (supabase.auth as any).getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile || profile.organization_id !== orgId || !['admin', 'super_admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });

    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Failed to forward message');
    }

    return res.status(200).json({ success: true, gatewayResponse: result });
  } catch (error: any) {
    console.error('Proxy routing error:', error);
    return res.status(500).json({ error: error.message || 'Failed to proxy WhatsApp message' });
  }
}
