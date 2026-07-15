import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './utils/rate-limit';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'support@agoroll.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'agoroll';

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

  const { orgId, toEmail, toName, subject, htmlContent } = req.body;

  if (!orgId || !toEmail || !subject || !htmlContent) {
    return res.status(400).json({ error: 'Missing required parameters (orgId, toEmail, subject, htmlContent)' });
  }

  // 0. Rate Limiting (20 requests per minute per IP)
  const rateLimitResult = await rateLimit(req, 'send-email', 20, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  // 1. Validate authentication & permissions
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

  if (profileErr || !profile) {
    return res.status(403).json({ error: 'Forbidden: Profile not found' });
  }

  if (profile.organization_id !== orgId) {
    return res.status(403).json({ error: 'Forbidden: You do not belong to this organization' });
  }

  if (!['admin', 'super_admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  }

  // 2. Verify organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError || !org) {
    return res.status(404).json({ error: 'Organization not found or unregistered' });
  }

  // 2. Send request to Brevo API
  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'Brevo API key is not configured' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL
        },
        to: [
          {
            email: toEmail,
            name: toName || toEmail
          }
        ],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || 'Failed to send email via Brevo');
    }

    return res.status(200).json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error('Brevo SMTP sending error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
}
