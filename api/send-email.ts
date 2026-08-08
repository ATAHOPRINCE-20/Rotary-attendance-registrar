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

import { generateVisitationCardPdfBase64 } from './_lib/visitation-card-pdf.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.resend || '';
const RESEND_SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';
const RESEND_SENDER_NAME = process.env.RESEND_SENDER_NAME || 'agoroll';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'support@agoroll.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'agoroll';

async function fetchBrevo(apiKey: string, payload: any): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const proxyEndpoint = process.env.BREVO_PROXY_URL || 'http://ugpay.tech:3001/proxy-brevo';

  // 1. Primary: Route request through user's VPS Proxy (ugpay.tech static IP)
  try {
    const proxyRes = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await proxyRes.json().catch(() => ({}));
    if (proxyRes.ok || proxyRes.status < 500) {
      return {
        ok: proxyRes.ok && (proxyRes.status >= 200 && proxyRes.status < 300),
        status: proxyRes.status,
        json: async () => data
      };
    }
  } catch (proxyErr: any) {
    console.warn('VPS Brevo Proxy call failed, attempting direct connection:', proxyErr.message);
  }

  // 2. Secondary fallback: Direct fetch to Brevo API
  return await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

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

  const { registrationId, orgId: rawOrgId, toEmail: rawToEmail, toName: rawToName, subject: rawSubject, htmlContent: rawHtmlContent, attachment: rawAttachment } = req.body;

  // --------------------------------------------------------------------------
  // AUTOMATED VISITATION CARD EMAIL DISPATCH (by registrationId)
  // --------------------------------------------------------------------------
  if (registrationId) {
    const rateLimitResult = await rateLimit(req, 'send-visitation-card-email', 40, 60);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: rateLimitResult.error });
    }

    try {
      const { data: reg, error: regErr } = await supabase
        .from('registrations')
        .select('*, events(*), organizations(*)')
        .eq('id', registrationId)
        .single();

      if (regErr || !reg) {
        return res.status(404).json({ error: 'Registration not found' });
      }

      // Filter out Home Club Members (Visitation cards are only for Visiting Rotarians and Guests)
      const isHomeMember = reg.is_member && !reg.club_name && (reg.member_id || reg.buddy_group);
      if (isHomeMember) {
        return res.status(200).json({ skipped: true, message: 'Visitation cards are strictly for Guests and Visiting Rotarians.' });
      }

      const isRealEmail = Boolean(reg.email && !reg.email.match(/^member-[a-f0-9\-]+@/));
      if (!isRealEmail) {
        return res.status(400).json({ error: 'Registration has no valid recipient email address' });
      }

      const hostClubName = reg.organizations?.name || 'Rotary Club';
      const logoUrl = reg.organizations?.logo_url || 'https://raw.githubusercontent.com/shadcn.png';

      const eventDate = reg.events?.date
        ? new Date(reg.events.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

      const eventTopic = reg.events?.topic || reg.events?.fellowship_report?.guest_speaker_topic || reg.events?.title || 'Regular Fellowship Meeting';
      const eventTitle = reg.events?.title || 'Rotary Meeting';

      const presidentName = reg.organizations?.president_name || 'Impact President';
      const presidentTitle = reg.organizations?.president_title || 'Impact President';
      const secretaryName = reg.organizations?.secretary_name || 'Impact Secretary';
      const secretaryTitle = reg.organizations?.secretary_title || 'Impact Secretary';

      // Generate PDF attachment
      const pdfBase64 = generateVisitationCardPdfBase64({
        hostClubName,
        visitorName: reg.full_name,
        isMember: Boolean(reg.is_member),
        visitorClub: reg.club_name || reg.organization_name || null,
        eventTitle,
        eventDate,
        eventTopic,
        presidentName,
        presidentTitle,
        secretaryName,
        secretaryTitle,
      });

      const cardTitleText = reg.is_member ? 'FELLOWSHIP CARD' : 'GUEST VISITATION CARD';
      const salutationText = reg.is_member
        ? `To the Secretary, ${reg.club_name || 'Visiting Club'}`
        : 'To Our Esteemed Guest';
      const bodyPhrase = reg.is_member
        ? 'sharing fellowship with'
        : 'hosting our guest';

      const emailSubject = reg.is_member
        ? `Fellowship Card - ${hostClubName}`
        : `Guest Visitation Card - ${hostClubName}`;

      const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 2px solid #0067C8; border-radius: 16px; padding: 30px; font-family: sans-serif; text-align: center; color: #1e293b;">
          <div style="margin-bottom: 15px;">
            ${logoUrl ? `<img src="${logoUrl}" width="60" alt="Rotary Logo" style="vertical-align: middle; max-height: 60px; object-fit: contain;" /><br/>` : ''}
            <h2 style="font-family: serif; color: #0067C8; font-size: 24px; margin: 10px 0 5px 0;">${hostClubName}</h2>
          </div>
          <h1 style="font-family: serif; color: #17458F; font-size: 26px; margin: 0 0 15px 0;">${cardTitleText}</h1>
          <p style="font-weight: bold; font-size: 16px; color: #0f172a; margin-bottom: 15px;">${salutationText}</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.6;">
            The President and members of <strong>${hostClubName}</strong> had the pleasure of ${bodyPhrase}
          </p>
          <div style="font-family: serif; font-style: italic; font-size: 26px; font-weight: bold; color: #D9531F; margin: 20px 0; border-bottom: 2px solid #e2e8f0; display: inline-block; padding-bottom: 5px;">
            ${reg.full_name}
          </div>
          <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 25px;">
            on <strong>${eventDate}</strong>. The topic of the day was <strong>${eventTopic}</strong>.
          </p>
          <p style="font-size: 13px; color: #64748b; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            📎 Your official Visitation Card PDF is attached to this email.
          </p>
          <table style="width: 100%; border-top: 1px solid #cbd5e1; margin-top: 25px; pt: 15px;">
            <tr>
              <td style="width: 50%; text-align: center; vertical-align: bottom;">
                <div style="border-bottom: 1px solid #475569; width: 80%; margin: 5px auto;"></div>
                <strong>${presidentName}</strong><br/>
                <span style="font-size: 12px; color: #64748b;">${presidentTitle}</span>
              </td>
              <td style="width: 50%; text-align: center; vertical-align: bottom;">
                <div style="border-bottom: 1px solid #475569; width: 80%; margin: 5px auto;"></div>
                <strong>${secretaryName}</strong><br/>
                <span style="font-size: 12px; color: #64748b;">${secretaryTitle}</span>
              </td>
            </tr>
          </table>
        </div>
      `;

      const attachmentObj = pdfBase64 ? [{
        name: `Visitation_Card_${reg.full_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: pdfBase64
      }] : [];

      const orgId = reg.organization_id;
      const apiKeyToUse = reg.organizations?.brevo_api_key || BREVO_API_KEY;
      const senderEmailToUse = reg.organizations?.brevo_sender_email || BREVO_SENDER_EMAIL;
      const senderNameToUse = reg.organizations?.brevo_sender_name || BREVO_SENDER_NAME;

      if (apiKeyToUse) {
        const response = await fetchBrevo(apiKeyToUse, {
          sender: { name: senderNameToUse, email: senderEmailToUse },
          to: [{ email: reg.email, name: reg.full_name }],
          subject: emailSubject,
          htmlContent: emailHtml,
          ...(attachmentObj.length > 0 ? { attachment: attachmentObj } : {})
        });

        const result: any = await response.json().catch(() => ({}));
        if (response.ok) {
          return res.status(200).json({ success: true, messageId: result.messageId, provider: 'brevo' });
        }
      }

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
            to: [reg.email],
            subject: emailSubject,
            html: emailHtml,
            ...(attachmentObj.length > 0 ? {
              attachments: [{ filename: attachmentObj[0].name, content: attachmentObj[0].content }]
            } : {})
          }),
        });

        const resendData = await resendRes.json().catch(() => ({}));
        if (resendRes.ok) {
          return res.status(200).json({ success: true, messageId: resendData.id, provider: 'resend' });
        }
      }

      return res.status(500).json({ error: 'No email service configured or delivery failed.' });
    } catch (err: any) {
      console.error('Visitation card email dispatch error:', err);
      return res.status(500).json({ error: err.message || 'Failed to dispatch visitation card email' });
    }
  }

  if (!rawOrgId || !rawToEmail || !rawSubject || !rawHtmlContent) {
    return res.status(400).json({ error: 'Missing required parameters (registrationId or orgId, toEmail, subject, htmlContent)' });
  }

  const orgId = rawOrgId;
  const toEmail = rawToEmail;
  const toName = rawToName;
  const subject = rawSubject;
  const htmlContent = rawHtmlContent;
  const attachment = rawAttachment;

  // 0. Rate Limiting (300 requests per 60 seconds to support admin bulk campaigns)
  const rateLimitResult = await rateLimit(req, 'send-email', 300, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  // 1. Validate authentication & permissions
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

  // Fallback: decode JWT payload directly
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

  // 2. Verify organization and fetch custom Brevo settings
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, brevo_api_key, brevo_sender_email, brevo_sender_name')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError || !org) {
    return res.status(404).json({ error: 'Organization not found or unregistered' });
  }

  // 3. Determine Brevo credentials first for email communications
  const apiKeyToUse = org.brevo_api_key || BREVO_API_KEY;
  const senderEmailToUse = org.brevo_sender_email || BREVO_SENDER_EMAIL;
  const senderNameToUse = org.brevo_sender_name || BREVO_SENDER_NAME;

  if (apiKeyToUse) {
    try {
      const response = await fetchBrevo(apiKeyToUse, {
        sender: {
          name: senderNameToUse,
          email: senderEmailToUse
        },
        to: [
          {
            email: toEmail,
            name: toName || toEmail
          }
        ],
        subject: subject,
        htmlContent: htmlContent,
        ...(attachment ? { attachment } : {})
      });

      const result: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || result.code || `Brevo Error: ${JSON.stringify(result)}`);
      }

      return res.status(200).json({ success: true, messageId: result.messageId, provider: 'brevo' });
    } catch (brevoErr: any) {
      console.error('Brevo SMTP sending error:', brevoErr);
      if (!RESEND_API_KEY) {
        return res.status(400).json({ error: brevoErr.message || 'Failed to send email via Brevo' });
      }
    }
  }

  // 4. Fallback to Resend API
  if (RESEND_API_KEY) {
    try {
      const resendSender = `${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>`;
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendSender,
          to: [toEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      const resendData = await resendRes.json().catch(() => ({}));
      if (!resendRes.ok) {
        throw new Error(resendData.message || resendData.error || `Resend Error: ${JSON.stringify(resendData)}`);
      }

      return res.status(200).json({ success: true, messageId: resendData.id, provider: 'resend' });
    } catch (resendErr: any) {
      console.error('Resend API dispatch error:', resendErr);
      return res.status(500).json({ error: resendErr.message || 'Failed to send email' });
    }
  }

  return res.status(500).json({ error: 'No email service API key configured (Brevo or Resend).' });
}
