import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './_rate-limit.js';
import { getMemberInviteEmailTemplate, getTeamInviteEmailTemplate } from '../src/lib/email-templates.js';

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

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.resend || '';
const RESEND_SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';
const RESEND_SENDER_NAME = process.env.RESEND_SENDER_NAME || 'agoroll';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'support@agoroll.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'agoroll';

function cleanPhoneForGateway(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return '256' + digits.substring(1);
  }
  if (digits.length === 9) {
    return '256' + digits;
  }
  return digits;
}

async function fetchBrevo(apiKey: string, payload: any): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const proxyEndpoint = process.env.BREVO_PROXY_URL || 'http://ugpay.tech:3001/proxy-brevo';

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

function decodeJwtUser(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    const userId = payload.sub || payload.id;
    if (!userId) return null;
    return {
      id: userId,
      email: payload.email,
      role: payload.role,
      user_metadata: payload.user_metadata || {}
    };
  } catch (e) {
    return null;
  }
}

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

  const { action, otpCode, identifier, memberId, memberIds, inviteAll, uninvitedOnly, email, role, type, organizationId } = req.body || {};

  // --------------------------------------------------------------------------
  // ROUTE 1: MEMBER OTP (Request or Verify)
  // --------------------------------------------------------------------------
  if (action === 'request-otp' || action === 'verify' || otpCode || (identifier && !type && !email && !memberId && !memberIds && !inviteAll)) {
    // VERIFY OTP FLOW
    if (action === 'verify' || otpCode) {
      if (!identifier || !otpCode) {
        return res.status(400).json({ error: 'Missing identifier or otpCode parameter' });
      }

      try {
        let otpQuery = supabase
          .from('member_login_otps')
          .select('*')
          .eq('otp_code', String(otpCode).trim())
          .gt('expires_at', new Date().toISOString());

        const isEmail = identifier.includes('@');
        if (isEmail) {
          otpQuery = otpQuery.ilike('email', identifier.trim());
        } else {
          const digits = identifier.replace(/\D/g, '');
          const suffix = digits.substring(digits.length - 9);
          otpQuery = otpQuery.like('phone', `%${suffix}`);
        }

        const { data: otpRecords, error: otpError } = await otpQuery;
        if (otpError || !otpRecords || otpRecords.length === 0) {
          return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        const matchedOtp = otpRecords[0];
        await supabase.from('member_login_otps').delete().eq('id', matchedOtp.id);

        let memberQuery = supabase.from('members').select('id, organization_id, email, phone, full_name, user_id');
        if (isEmail) {
          memberQuery = memberQuery.ilike('email', identifier.trim());
        } else {
          const digits = identifier.replace(/\D/g, '');
          const suffix = digits.substring(digits.length - 9);
          memberQuery = memberQuery.like('phone', `%${suffix}`);
        }

        const { data: members, error: memberErr } = await memberQuery;
        if (memberErr || !members || members.length === 0) {
          return res.status(404).json({ error: 'Matching club member profile not found' });
        }

        const member = members[0];
        if (!member.email) {
          return res.status(400).json({ error: 'Member profile has no email address. Please contact your club admin.' });
        }

        let authUserId = member.user_id;
        if (!authUserId) {
          const { data: existingUser, error: checkError } = await supabase.auth.admin.createUser({
            email: member.email,
            email_confirm: true,
            user_metadata: {
              full_name: member.full_name,
              organization_id: member.organization_id,
              is_member: true
            }
          }).catch(err => ({ data: null, error: err }));

          if (existingUser?.user) {
            authUserId = existingUser.user.id;
            await supabase.from('members').update({ user_id: authUserId }).eq('id', member.id);
          } else if (checkError && (checkError as any).message?.includes('already exists')) {
            // Already exists
          } else if (checkError) {
            throw new Error(`Failed to create member user: ${checkError.message}`);
          }
        }

        const origin = req.headers.origin || 'http://localhost:5173';
        const redirectUrl = `${origin}/member/dashboard`;

        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: member.email,
          options: { redirectTo: redirectUrl }
        });

        if (linkErr) {
          throw new Error(`Failed to generate login session: ${linkErr.message}`);
        }

        return res.status(200).json({
          success: true,
          actionLink: linkData.properties.action_link,
          message: 'OTP verified successfully. Initializing session...'
        });
      } catch (error: any) {
        console.error('Verify OTP error:', error);
        return res.status(500).json({ error: error.message || 'Failed to verify OTP code' });
      }
    }

    // REQUEST OTP FLOW
    if (!identifier) {
      return res.status(400).json({ error: 'Missing identifier (email or phone)' });
    }

    const rateLimitResult = await rateLimit(req, 'request-otp', 5, 120);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: rateLimitResult.error });
    }

    try {
      let query = supabase.from('members').select('id, organization_id, email, phone, full_name');
      const isEmail = identifier.includes('@');

      if (isEmail) {
        query = query.ilike('email', identifier.trim());
      } else {
        const digits = identifier.replace(/\D/g, '');
        if (digits.length < 9) {
          return res.status(400).json({ error: 'Invalid phone number format. Please check and try again.' });
        }
        const suffix = digits.substring(digits.length - 9);
        query = query.like('phone', `%${suffix}`);
      }

      const { data: members, error: dbError } = await query;
      if (dbError || !members || members.length === 0) {
        return res.status(404).json({ error: 'No registered club member matches that email or phone number' });
      }

      const member = members[0];
      const targetEmail = member.email;
      const targetPhone = member.phone;

      const otpCodeGenerated = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: otpError } = await supabase
        .from('member_login_otps')
        .insert({
          phone: targetPhone || null,
          email: targetEmail || null,
          otp_code: otpCodeGenerated,
          expires_at: expiresAt
        });

      if (otpError) {
        throw new Error(`Failed to store OTP verification code: ${otpError.message}`);
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('name, brevo_api_key, brevo_sender_email, brevo_sender_name')
        .eq('id', member.organization_id)
        .single();

      let channelSent: 'whatsapp' | 'email' = 'email';

      if (targetPhone && targetPhone.trim().length >= 9) {
        try {
          const cleanPhone = cleanPhoneForGateway(targetPhone);
          const waMsg = `Hello ${member.full_name},\nYour verification code for the ${org?.name || 'Rotary Club'} member portal is *${otpCodeGenerated}*.\n\nThis code will expire in 10 minutes.`;
          const gatewayUrl = `http://ugpay.tech:3000/send-whatsapp/${member.organization_id}`;

          const response = await fetch(gatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: cleanPhone, message: waMsg })
          });

          const resJson: any = await response.json().catch(() => ({}));
          if (response.ok) {
            channelSent = 'whatsapp';
          } else {
            throw new Error(resJson.error || 'WhatsApp gateway rejected message');
          }
        } catch (err: any) {
          console.warn(`WhatsApp dispatch to registered number ${targetPhone} failed:`, err.message);
          if (!targetEmail) {
            return res.status(500).json({ error: `Failed to send WhatsApp code: ${err.message}. No email is configured for fallback.` });
          }
        }
      }

      if (channelSent === 'email') {
        if (!targetEmail) {
          return res.status(400).json({ error: 'No email address registered for this member.' });
        }

        const brevoKey = org?.brevo_api_key || BREVO_API_KEY;
        const senderEmail = org?.brevo_sender_email || BREVO_SENDER_EMAIL;
        const senderName = org?.brevo_sender_name || BREVO_SENDER_NAME;

        if (!brevoKey) {
          return res.status(500).json({ error: 'Email settings are not configured for this club.' });
        }

        const htmlContent = `
          <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #002D62; text-align: center;">${org?.name || 'Rotary Club'}</h2>
            <p>Hello <strong>${member.full_name}</strong>,</p>
            <p>You requested a login code for your club member portal.</p>
            <div style="background-color: #f4f6f8; text-align: center; padding: 15px; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #002D62; margin: 20px 0;">
              ${otpCodeGenerated}
            </div>
            <p style="color: #666; font-size: 12px; text-align: center;">This code is valid for 10 minutes.</p>
          </div>
        `;

        const response = await fetchBrevo(brevoKey, {
          sender: { name: senderName, email: senderEmail },
          to: [{ email: targetEmail, name: member.full_name }],
          subject: 'Your Club Portal Verification Code',
          htmlContent: htmlContent
        });

        const resJson: any = await response.json().catch(() => ({}));
        if (!response.ok) {
          return res.status(400).json({ error: resJson.message || resJson.code || 'Failed to send email code via Brevo' });
        }
      }

      return res.status(200).json({
        success: true,
        channel: channelSent,
        maskedDestination: channelSent === 'whatsapp' 
          ? `WhatsApp to ...${targetPhone?.slice(-4)}` 
          : `Email to ${targetEmail?.split('@')[0].slice(0, 3)}...@${targetEmail?.split('@')[1]}`
      });
    } catch (error: any) {
      console.error('Request OTP error:', error);
      return res.status(500).json({ error: error.message || 'Failed to handle OTP request' });
    }
  }

  // --------------------------------------------------------------------------
  // ROUTE 2: MEMBER / TEAM INVITATIONS (Single or Batch)
  // --------------------------------------------------------------------------
  const rateLimitResult = await rateLimit(req, 'invite-handler', 15, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
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

  const currentSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const currentSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

  if (!user && currentSupabaseUrl && currentSupabaseKey) {
    try {
      const scopedClient = createClient(currentSupabaseUrl, currentSupabaseKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      const resScoped = await scopedClient.auth.getUser();
      if (resScoped.data?.user) {
        user = resScoped.data.user;
        authError = null;
      }
    } catch (e) {
      console.error('Scoped client auth check failed:', e);
    }
  }

  if (!user) {
    const decoded = decodeJwtUser(token);
    if (decoded) {
      user = decoded;
      authError = null;
    }
  }

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid token.' });
  }

  const { data: adminProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (profileErr || !adminProfile) {
    return res.status(403).json({ error: 'Forbidden: Admin profile not found' });
  }

  if (!['admin', 'super_admin', 'treasurer', 'staff'].includes(adminProfile.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  }

  const effectiveOrgId = (adminProfile.role === 'super_admin' && organizationId)
    ? organizationId
    : adminProfile.organization_id;

  const { data: org } = await supabase
    .from('organizations')
    .select('name, brevo_api_key, brevo_sender_email, brevo_sender_name')
    .eq('id', effectiveOrgId)
    .single();

  const apiKeyToUse = org?.brevo_api_key || BREVO_API_KEY;
  const senderEmailToUse = org?.brevo_sender_email || BREVO_SENDER_EMAIL;
  const senderNameToUse = org?.brevo_sender_name || BREVO_SENDER_NAME || 'agoroll';
  const orgName = org?.name || 'Rotary Club';

  async function resolveUserByEmail(email: string, existingUserId?: string | null) {
    const cleanEmail = email.trim().toLowerCase();
    
    if (existingUserId) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(existingUserId);
        if (userData?.user) return userData.user;
      } catch (e) {}
    }

    try {
      const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = listData?.users?.find(u => u.email?.trim().toLowerCase() === cleanEmail);
      if (found) return found;
    } catch (e) {}

    return null;
  }

  async function generateRecoveryLink(email: string, redirectUrl: string) {
    const cleanEmail = email.trim().toLowerCase();
    
    try {
      const res1 = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
        options: { redirectTo: redirectUrl }
      });
      if (res1.data?.properties?.email_otp) {
        return res1.data.properties.email_otp;
      }
    } catch (e) {}

    const res2 = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail
    });

    if (res2.error) throw res2.error;
    if (!res2.data?.properties?.email_otp) {
      throw new Error("Failed to generate invitation OTP token.");
    }

    return res2.data.properties.email_otp;
  }

  // Branch A: Team Member Invitation
  if (type === 'team' || (email && role)) {
    try {
      const cleanEmail = email.trim().toLowerCase();
      let targetUser: any = null;

      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: {
          organization_id: effectiveOrgId,
          role: role,
          full_name: cleanEmail.split('@')[0]
        }
      });

      if (createErr) {
        const errMsg = (createErr.message || '').toLowerCase();
        const isAlreadyExists = errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists') || createErr.status === 422 || createErr.status === 400;
        
        if (isAlreadyExists) {
          targetUser = await resolveUserByEmail(cleanEmail);
          if (targetUser) {
            await supabase.auth.admin.updateUserById(targetUser.id, {
              user_metadata: {
                ...targetUser.user_metadata,
                organization_id: effectiveOrgId,
                role: role
              }
            });
          }
        } else {
          throw createErr;
        }
      } else if (createData?.user) {
        targetUser = createData.user;
      }

      if (!targetUser) {
        throw new Error('Failed to resolve team member user account.');
      }

      await supabase.from('profiles').upsert({
        id: targetUser.id,
        organization_id: effectiveOrgId,
        full_name: targetUser.user_metadata?.full_name || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: targetUser.user_metadata?.phone || null,
        role: role
      });

      const origin = req.headers.origin || 'https://rotary-ntinda-k2zrtibce-ataho-princes-projects.vercel.app';
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const emailOtp = await generateRecoveryLink(cleanEmail, `${origin}/member/setup-password`);

      const actionLink = `${origin}/member/setup-password?token=${emailOtp}&email=${encodeURIComponent(cleanEmail)}&exp=${expiresAt}`;
      const htmlContent = getTeamInviteEmailTemplate({
        orgName,
        role,
        actionLink
      });

      const emailSubject = `Team Member Invitation — ${orgName}`;

      let sent = false;
      if (apiKeyToUse) {
        try {
          const brevoRes = await fetchBrevo(apiKeyToUse, {
            sender: { name: senderNameToUse, email: senderEmailToUse },
            to: [{ email: cleanEmail }],
            subject: emailSubject,
            htmlContent
          });
          if (brevoRes.ok) sent = true;
        } catch (e) {}
      }

      if (!sent && RESEND_API_KEY) {
        const resendSender = `${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>`;
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: resendSender, to: [cleanEmail], subject: emailSubject, html: htmlContent })
        });
        if (resendRes.ok) sent = true;
      }

      if (sent) {
        return res.status(200).json({ success: true, message: 'Team member invitation email sent successfully' });
      }

      throw new Error('Failed to send team invitation email');
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to send team invitation email' });
    }
  }

  // Branch B: Single Member Invitation
  const origin = req.headers.origin || 'http://localhost:5173';
  const redirectUrl = `${origin}/member/setup-password`;

  if (memberId && !inviteAll && !memberIds) {
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id, organization_id, email, full_name, user_id')
      .eq('id', memberId)
      .single();

    if (memberErr || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (adminProfile.role !== 'super_admin' && member.organization_id !== adminProfile.organization_id) {
      return res.status(403).json({ error: 'Forbidden: Member does not belong to your organization' });
    }

    const cleanEmail = member.email ? member.email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Cannot invite member: Member has no email address configured' });
    }

    try {
      let targetUser: any = null;
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: {
          full_name: member.full_name,
          organization_id: member.organization_id,
          is_member: true
        }
      });

      if (createErr) {
        const errMsg = (createErr.message || '').toLowerCase();
        const isAlreadyExists = errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists') || createErr.status === 422 || createErr.status === 400;
        
        if (isAlreadyExists) {
          targetUser = await resolveUserByEmail(cleanEmail, member.user_id);
          if (targetUser) {
            await supabase.auth.admin.updateUserById(targetUser.id, {
              user_metadata: {
                ...targetUser.user_metadata,
                is_member: true,
                organization_id: member.organization_id
              }
            });
          }
        } else {
          throw createErr;
        }
      } else if (createData?.user) {
        targetUser = createData.user;
      }

      if (!targetUser) {
        throw new Error('Failed to resolve authenticated user for member.');
      }

      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const emailOtp = await generateRecoveryLink(cleanEmail, redirectUrl);

      const actionLink = `${origin}/member/setup-password?token=${emailOtp}&email=${encodeURIComponent(cleanEmail)}&exp=${expiresAt}`;
      const htmlContent = getMemberInviteEmailTemplate({ fullName: member.full_name, orgName, actionLink });
      const emailSubject = `Activate Your Member Portal — ${orgName}`;

      let sent = false;
      if (apiKeyToUse) {
        try {
          const emailRes = await fetchBrevo(apiKeyToUse, {
            sender: { name: senderNameToUse, email: senderEmailToUse },
            to: [{ email: cleanEmail, name: member.full_name }],
            subject: emailSubject,
            htmlContent
          });
          if (emailRes.ok) sent = true;
        } catch (e) {}
      }

      if (!sent && RESEND_API_KEY) {
        const resendSender = `${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>`;
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: resendSender, to: [cleanEmail], subject: emailSubject, html: htmlContent })
        });
        if (resendRes.ok) sent = true;
      }

      if (sent) {
        return res.status(200).json({ success: true, message: 'Invitation email successfully sent to member', user: targetUser });
      }

      throw new Error('Failed to dispatch email via Brevo or Resend');
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to trigger member invitation' });
    }
  }

  // Branch C: Batch Member Invitation
  try {
    let membersQuery = supabase
      .from('members')
      .select('id, organization_id, email, full_name, user_id')
      .eq('organization_id', effectiveOrgId)
      .not('email', 'is', null)
      .neq('email', '');

    if (!inviteAll && Array.isArray(memberIds)) {
      membersQuery = membersQuery.in('id', memberIds);
    } else if (inviteAll && uninvitedOnly) {
      membersQuery = membersQuery.is('user_id', null);
    }

    const { data: targetMembers, error: fetchErr } = await membersQuery;
    if (fetchErr) throw fetchErr;

    if (!targetMembers || targetMembers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No eligible members found with email addresses.',
        totalProcessed: 0,
        successCount: 0,
        failedCount: 0,
        results: []
      });
    }

    const results: Array<{ memberId: string; name: string; email: string; status: 'sent' | 'failed'; error?: string }> = [];

    async function processMember(member: any) {
      const cleanEmail = member.email ? member.email.trim().toLowerCase() : '';
      if (!cleanEmail) {
        results.push({ memberId: member.id, name: member.full_name, email: '', status: 'failed', error: 'No email address' });
        return;
      }

      try {
        let targetUser: any = null;
        const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
          email: cleanEmail,
          email_confirm: true,
          user_metadata: { full_name: member.full_name, organization_id: member.organization_id, is_member: true }
        });

        if (createErr) {
          const errMsg = (createErr.message || '').toLowerCase();
          const isAlreadyExists = errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists') || createErr.status === 422 || createErr.status === 400;

          if (isAlreadyExists) {
            targetUser = await resolveUserByEmail(cleanEmail, member.user_id);
            if (targetUser) {
              await supabase.auth.admin.updateUserById(targetUser.id, {
                user_metadata: { ...targetUser.user_metadata, is_member: true, organization_id: member.organization_id }
              });
            }
          } else {
            throw createErr;
          }
        } else if (createData?.user) {
          targetUser = createData.user;
        }

        if (!targetUser) throw new Error('Could not resolve user account');

        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
        const emailOtp = await generateRecoveryLink(cleanEmail, redirectUrl);

        const actionLink = `${origin}/member/setup-password?token=${emailOtp}&email=${encodeURIComponent(cleanEmail)}&exp=${expiresAt}`;
        const htmlContent = getMemberInviteEmailTemplate({ fullName: member.full_name, orgName, actionLink });
        const emailSubject = `Activate Your Member Portal — ${orgName}`;

        let emailSent = false;
        if (apiKeyToUse) {
          try {
            const emailResponse = await fetchBrevo(apiKeyToUse, {
              sender: { name: senderNameToUse, email: senderEmailToUse },
              to: [{ email: cleanEmail, name: member.full_name }],
              subject: emailSubject,
              htmlContent
            });
            if (emailResponse.ok) emailSent = true;
          } catch (e) {}
        }

        if (!emailSent && RESEND_API_KEY) {
          const resendSender = `${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>`;
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: resendSender, to: [cleanEmail], subject: emailSubject, html: htmlContent })
          });
          if (resendRes.ok) emailSent = true;
        }

        if (emailSent) {
          results.push({ memberId: member.id, name: member.full_name, email: member.email, status: 'sent' });
        } else {
          throw new Error('Email dispatch failed');
        }
      } catch (err: any) {
        results.push({ memberId: member.id, name: member.full_name, email: member.email, status: 'failed', error: err.message });
      }
    }

    const BATCH_SIZE = 3;
    for (let i = 0; i < targetMembers.length; i += BATCH_SIZE) {
      const batch = targetMembers.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(member => processMember(member)));
    }

    const successCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return res.status(200).json({
      success: true,
      message: `Batch invitation complete: ${successCount} sent, ${failedCount} failed out of ${targetMembers.length}.`,
      totalProcessed: targetMembers.length,
      successCount,
      failedCount,
      results
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to process batch invitations' });
  }
}
