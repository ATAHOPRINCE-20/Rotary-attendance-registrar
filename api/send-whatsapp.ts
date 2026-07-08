import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

  const { webhookUrl, phone, message } = req.body;

  if (!webhookUrl || !phone || !message) {
    return res.status(400).json({ error: 'Missing webhookUrl, phone, or message parameters' });
  }

  // 1. Secure proxy destination: only allow our known gateway domain
  if (!webhookUrl.startsWith('http://ugpay.tech:3000/send-whatsapp/')) {
    return res.status(400).json({ error: 'Unauthorized webhookUrl destination' });
  }

  // 2. Extract and verify organization ID from URL
  const orgId = webhookUrl.split('/').pop();
  if (!orgId) {
    return res.status(400).json({ error: 'Invalid webhookUrl organization parameters' });
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError || !org) {
    return res.status(403).json({ error: 'Forbidden: Unauthorized or unregistered organization' });
  }

  try {
    // Forward the request from Vercel (server-side HTTPS) to the user's custom gateway (HTTP)
    // Server-to-server requests bypass all browser CORS and Mixed-Content blocks
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: phone,
        message: message
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
