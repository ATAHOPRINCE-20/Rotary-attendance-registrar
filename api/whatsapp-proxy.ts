import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../src/lib/rate-limit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.warn("Supabase client init failed:", e);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // We support both GET (for polling status) and POST (for starting session)
  const isPost = req.method === 'POST';
  
  // Rate Limiting (60 requests per minute per IP)
  const rateLimitResult = await rateLimit(req, 'whatsapp-proxy', 60, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  // Extract parameters from body (POST) or query (GET)
  const params = isPost ? req.body : req.query;
  
  const { action, gatewayUrl, sessionId, phone } = params;

  if (!action || !gatewayUrl || !sessionId) {
    return res.status(400).json({ error: 'Missing action, gatewayUrl, or sessionId' });
  }

  // Validate authentication & permissions (sessionId is organizationId)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing or invalid' });
  }

  // Verify the token by calling getUser
  const { data: { user }, error: authError } = await (supabase.auth as any).getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  // Get user profile to check role and organization
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    return res.status(403).json({ error: 'Forbidden: Profile not found' });
  }

  if (profile.organization_id !== sessionId) {
    return res.status(403).json({ error: 'Forbidden: You do not belong to this organization' });
  }

  if (!['admin', 'super_admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  }

  // Ensure gatewayUrl doesn't have a trailing slash
  const cleanGateway = gatewayUrl.replace(/\/$/, '');

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
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body !== undefined) {
      fetchOptions.body = body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    const result = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      if (response.status === 404 && action === 'delete') {
        // If the delete endpoint isn't deployed yet or session not found, treat as success
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
