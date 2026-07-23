import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../../src/lib/rate-limit.js';
import { getTeamInviteEmailTemplate } from '../../src/lib/email-templates.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.resend || '';
const RESEND_SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';
const RESEND_SENDER_NAME = process.env.RESEND_SENDER_NAME || 'Rotary Connect';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'support@agoroll.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Rotary Connect';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, role, inviteUrl } = req.body;

  if (!email || !role || !inviteUrl) {
    return res.status(400).json({ error: 'Missing required parameters (email, role, inviteUrl)' });
  }

  // 1. Rate Limiting (10 requests per minute per IP)
  const rateLimitResult = await rateLimit(req, 'team-invite', 10, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  // 2. Validate calling Admin authentication & permissions
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error: authError } = await (supabase.auth as any).getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    const { data: adminProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileErr || !adminProfile) {
      return res.status(403).json({ error: 'Forbidden: Admin profile not found' });
    }

    if (!['admin', 'super_admin'].includes(adminProfile.role)) {
      return res.status(403).json({ error: 'Forbidden: Only Administrators can invite team members' });
    }

    // 3. Fetch Organization Details
    const { data: org } = await supabase
      .from('organizations')
      .select('name, brevo_api_key, brevo_sender_email, brevo_sender_name')
      .eq('id', adminProfile.organization_id)
      .single();

    const apiKeyToUse = org?.brevo_api_key || BREVO_API_KEY;
    const senderEmailToUse = org?.brevo_sender_email || BREVO_SENDER_EMAIL;
    const senderNameToUse = org?.brevo_sender_name || BREVO_SENDER_NAME;

    // 4. Construct HTML Template
    const htmlContent = getTeamInviteEmailTemplate({
      orgName: org?.name || 'Rotary Club',
      role,
      actionLink: inviteUrl
    });

    const emailSubject = `Team Member Invitation — ${org?.name || 'Rotary Club'}`;

    // 5. Try Brevo First
    if (apiKeyToUse) {
      try {
        const brevoRes = await fetch('http://ugpay.tech:3001/proxy-brevo', {
          method: 'POST',
          headers: {
            'api-key': apiKeyToUse,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            sender: {
              name: senderNameToUse,
              email: senderEmailToUse
            },
            to: [{
              email: email
            }],
            subject: emailSubject,
            htmlContent
          })
        });

        if (brevoRes.ok) {
          return res.status(200).json({
            success: true,
            message: 'Team member invitation email sent successfully via Brevo',
            provider: 'brevo'
          });
        } else {
          const errText = await brevoRes.text();
          console.error('Brevo team invite dispatch failed:', errText);
          if (!RESEND_API_KEY) {
            throw new Error(`Email dispatch failed via Brevo: ${errText}`);
          }
        }
      } catch (brevoErr: any) {
        console.error('Brevo exception during team invite dispatch:', brevoErr);
        if (!RESEND_API_KEY) throw brevoErr;
      }
    }

    // 6. Fallback to Resend API
    if (RESEND_API_KEY) {
      const resendSender = `${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>`;
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendSender,
          to: [email],
          subject: emailSubject,
          html: htmlContent,
        }),
      });

      const resendData = await resendRes.json().catch(() => ({}));
      if (resendRes.ok) {
        return res.status(200).json({
          success: true,
          message: 'Team member invitation email sent successfully via Resend',
          provider: 'resend',
          messageId: resendData.id
        });
      } else {
        throw new Error(`Email dispatch failed via Resend: ${resendData.message || JSON.stringify(resendData)}`);
      }
    }

    return res.status(500).json({ error: 'No email service API key configured (Brevo or Resend).' });

  } catch (error: any) {
    console.error('Team invite error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send team invitation email' });
  }
}
