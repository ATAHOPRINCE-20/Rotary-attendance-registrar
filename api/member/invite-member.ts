import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../../src/lib/rate-limit.js';
import { getMemberInviteEmailTemplate, getTeamInviteEmailTemplate } from '../../src/lib/email-templates.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://phczqgytpbisjngwttnb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_609eAQBA8OgntscxwHoQhg_71QHHAvL';
const supabase = createClient(supabaseUrl, supabaseKey);

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.resend || '';
const RESEND_SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';
const RESEND_SENDER_NAME = process.env.RESEND_SENDER_NAME || 'agoroll';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'support@agoroll.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'agoroll';

function decodeJwtUser(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.warn('JWT token has expired');
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
    console.error('JWT decode error:', e);
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

  const { memberId, memberIds, inviteAll, uninvitedOnly, email, role, inviteUrl, type, organizationId } = req.body || {};

  // 1. Rate Limiting
  const rateLimitResult = await rateLimit(req, 'invite-handler', 15, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  // 2. Validate calling Admin authentication & permissions
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];

  let user: any = null;
  let authError: any = null;

  // Try direct getUser first
  try {
    const resAuth = await (supabase.auth as any).getUser(token);
    user = resAuth.data?.user;
    authError = resAuth.error;
  } catch (e) {
    authError = e;
  }

  // Fallback 1: Scoped client getUser
  if (!user && supabaseUrl && supabaseKey) {
    try {
      const scopedClient = createClient(supabaseUrl, supabaseKey, {
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

  // Fallback 2: Decode JWT token directly
  if (!user) {
    const decoded = decodeJwtUser(token);
    if (decoded) {
      user = decoded;
      authError = null;
    }
  }

  if (authError || !user) {
    console.error('Invite handler auth error:', authError);
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid token. Please refresh and try again.' });
  }

  // Fetch admin profile
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

  // Support Super Admin impersonation override
  const effectiveOrgId = (adminProfile.role === 'super_admin' && organizationId)
    ? organizationId
    : adminProfile.organization_id;

  // Fetch Organization & custom Brevo sender settings once
  const { data: org } = await supabase
    .from('organizations')
    .select('name, brevo_api_key, brevo_sender_email, brevo_sender_name')
    .eq('id', effectiveOrgId)
    .single();

  const apiKeyToUse = org?.brevo_api_key || BREVO_API_KEY;
  const senderEmailToUse = org?.brevo_sender_email || BREVO_SENDER_EMAIL;
  const senderNameToUse = org?.brevo_sender_name || BREVO_SENDER_NAME || 'agoroll';
  const orgName = org?.name || 'Rotary Club';

  // Helper to resolve existing Auth user by ID or email
  async function resolveUserByEmail(email: string, existingUserId?: string | null) {
    const cleanEmail = email.trim().toLowerCase();
    
    if (existingUserId) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(existingUserId);
        if (userData?.user) return userData.user;
      } catch (e) {
        console.warn("getUserById failed for", existingUserId, e);
      }
    }

    try {
      const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = listData?.users?.find(u => u.email?.trim().toLowerCase() === cleanEmail);
      if (found) return found;
    } catch (e) {
      console.warn("listUsers search failed:", e);
    }

    return null;
  }

  // Helper to generate recovery link safely with fallback if redirectUrl is rejected
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
    } catch (e) {
      console.warn("generateLink with redirectTo failed, using fallback:", e);
    }

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

      // 1. Pre-create confirmed user account for team member
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

      // 2. Ensure profile exists in profiles table
      await supabase.from('profiles').upsert({
        id: targetUser.id,
        organization_id: effectiveOrgId,
        full_name: targetUser.user_metadata?.full_name || cleanEmail.split('@')[0],
        role: role
      });

      // 3. Generate direct password setup link safely
      const origin = req.headers.origin || 'https://rotary-ntinda-k2zrtibce-ataho-princes-projects.vercel.app';
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const emailOtp = await generateRecoveryLink(cleanEmail, `${origin}/member/setup-password`);

      const actionLink = `${origin}/member/setup-password?token=${emailOtp}&email=${encodeURIComponent(cleanEmail)}&exp=${expiresAt}`;

      // 4. Send Team Member Invite Email
      const htmlContent = getTeamInviteEmailTemplate({
        orgName,
        role,
        actionLink
      });

      const emailSubject = `Team Member Invitation — ${orgName}`;

      let sent = false;
      if (apiKeyToUse) {
        try {
          const brevoRes = await fetch('http://ugpay.tech:3001/proxy-brevo', {
            method: 'POST',
            headers: { 'api-key': apiKeyToUse, 'content-type': 'application/json' },
            body: JSON.stringify({
              sender: { name: senderNameToUse, email: senderEmailToUse },
              to: [{ email: cleanEmail }],
              subject: emailSubject,
              htmlContent
            })
          });
          if (brevoRes.ok) sent = true;
        } catch (e) {
          console.error('Brevo team invite error:', e);
        }
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
      console.error('Team invite error:', err);
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
          const emailRes = await fetch('http://ugpay.tech:3001/proxy-brevo', {
            method: 'POST',
            headers: { 'api-key': apiKeyToUse, 'content-type': 'application/json' },
            body: JSON.stringify({
              sender: { name: senderNameToUse, email: senderEmailToUse },
              to: [{ email: cleanEmail, name: member.full_name }],
              subject: emailSubject,
              htmlContent
            })
          });
          if (emailRes.ok) sent = true;
        } catch (e) {
          console.error('Brevo error:', e);
        }
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
      console.error('Member invite error:', err);
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
            const emailResponse = await fetch('http://ugpay.tech:3001/proxy-brevo', {
              method: 'POST',
              headers: { 'api-key': apiKeyToUse, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: senderNameToUse, email: senderEmailToUse },
                to: [{ email: cleanEmail, name: member.full_name }],
                subject: emailSubject,
                htmlContent
              })
            });
            if (emailResponse.ok) emailSent = true;
          } catch (e) {
            console.error(`Brevo failed for ${cleanEmail}:`, e);
          }
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
    console.error('Batch invite error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process batch invitations' });
  }
}
