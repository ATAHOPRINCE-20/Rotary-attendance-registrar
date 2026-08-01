import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './_rate-limit.js';

const DEFAULT_SUPABASE_URL = 'https://phczqgytpbisjngwttnb.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoY3pxZ3l0cGJpc2puZ3d0dG5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNjI1MiwiZXhwIjoyMDk3MjAyMjUyfQ.pbldO9-Z-JYzO4O5yatXFerltXwxnm3vXnAwBc0GL9Y';

function getSupabase() {
  const supabaseUrl = 
    process.env.VITE_SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    process.env.SUPABASE_URL || 
    DEFAULT_SUPABASE_URL;

  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    DEFAULT_SUPABASE_KEY;

  return createClient(supabaseUrl, supabaseKey);
}

const supabase = getSupabase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --------------------------------------------------------------------------
  // WHATSAPP SESSION PROXY (handles session start / status / delete)
  // --------------------------------------------------------------------------
  if (req.query.proxy === 'true' || req.body?.action || req.query?.action) {
    const isPost = req.method === 'POST';
    const rateLimitResult = await rateLimit(req, 'whatsapp-proxy', 60, 60);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: rateLimitResult.error });
    }

    const params = isPost ? req.body : req.query;
    const { action, gatewayUrl, sessionId, phone } = params;

    if (!action || !gatewayUrl || !sessionId) {
      return res.status(400).json({ error: 'Missing action, gatewayUrl, or sessionId' });
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

    if (profileErr || !profile || profile.organization_id !== sessionId) {
      return res.status(403).json({ error: 'Forbidden: You do not belong to this organization' });
    }

    if (!['admin', 'super_admin'].includes((profile as any).role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    const cleanGateway = String(gatewayUrl).replace(/\/$/, '');

    try {
      let targetUrl = '';
      let method = 'GET';
      let body: any = undefined;

      if (action === 'start') {
        targetUrl = `${cleanGateway}/session/start/${sessionId}`;
        method = 'POST';
        if (phone) {
          body = JSON.stringify({ phone });
        }
      } else if (action === 'status') {
        targetUrl = `${cleanGateway}/session/status/${sessionId}`;
        method = 'GET';
      } else if (action === 'delete') {
        targetUrl = `${cleanGateway}/session/delete/${sessionId}`;
        method = 'POST';
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const fetchOptions: any = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (body !== undefined) {
        fetchOptions.body = body;
      }

      const response = await fetch(targetUrl, fetchOptions);
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 404 && action === 'delete') {
          return res.status(200).json({ success: true, message: 'Session assumed deleted' });
        }
        throw new Error(result.error || `Gateway returned ${response.status}`);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('WhatsApp Proxy Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to connect to WhatsApp Gateway' });
    }
  }

  // --------------------------------------------------------------------------
  // SEND WHATSAPP MESSAGE (Welcome or Direct Admin)
  // --------------------------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { registrationId, webhookUrl, phone, message, pdfBase64, fileName } = req.body;

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

  let user: any = null;
  let authError: any = null;

  try {
    const resAuth = await (supabase.auth as any).getUser(token);
    user = resAuth.data?.user;
    authError = resAuth.error;
  } catch (e) {
    authError = e;
  }

  if (!user && token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (!payload.exp || payload.exp * 1000 > Date.now()) {
          user = { id: payload.sub || payload.id };
          authError = null;
        }
      }
    } catch (e) {}
  }

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    return res.status(403).json({ error: 'Forbidden: Profile not found' });
  }

  const isAllowedRole = ['admin', 'super_admin', 'treasurer', 'staff'].includes(profile.role);
  if (!isAllowedRole) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  }

  if (profile.role !== 'super_admin' && profile.organization_id !== orgId) {
    return res.status(403).json({ error: 'Forbidden: You do not belong to this organization' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message, pdfBase64, fileName })
    });

    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(400).json({
        error: result.error || result.message || 'WhatsApp Gateway returned an error. Please check your WhatsApp session status in Settings.'
      });
    }

    return res.status(200).json({ success: true, gatewayResponse: result });
  } catch (error: any) {
    console.error('Proxy routing error:', error);
    return res.status(400).json({
      error: error.message || 'Could not connect to WhatsApp Gateway (http://ugpay.tech:3000). Please check your server or network connection.'
    });
  }
}
