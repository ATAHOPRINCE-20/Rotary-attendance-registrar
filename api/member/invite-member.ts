import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../../src/lib/rate-limit.js';
import { getMemberInviteEmailTemplate } from '../../src/lib/email-templates.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.resend || '';
const RESEND_SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';
const RESEND_SENDER_NAME = process.env.RESEND_SENDER_NAME || 'agoroll';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'support@agoroll.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'agoroll';

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

  const { memberId } = req.body;

  if (!memberId) {
    return res.status(400).json({ error: 'Missing required parameter: memberId' });
  }

  // 1. Rate Limiting (10 requests per minute per IP)
  const rateLimitResult = await rateLimit(req, 'invite-member', 10, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  // 2. Validate calling Admin authentication & permissions
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await (supabase.auth as any).getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
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

  if (!['admin', 'super_admin'].includes(adminProfile.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  }

  // 3. Retrieve target member details
  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('id, organization_id, email, full_name, user_id')
    .eq('id', memberId)
    .single();

  if (memberErr || !member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // 4. Verify admin and member belong to the same organization
  if (member.organization_id !== adminProfile.organization_id) {
    return res.status(403).json({ error: 'Forbidden: Member does not belong to your organization' });
  }

  if (!member.email) {
    return res.status(400).json({ error: 'Cannot invite member: Member has no email address configured' });
  }

  try {
    const origin = req.headers.origin || 'http://localhost:5173';
    const redirectUrl = `${origin}/member/setup-password`;

    // 5. Ensure the user exists in auth.users (bypass SMTP via createUser)
    let targetUser: any = null;
    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email: member.email,
      email_confirm: true,
      user_metadata: {
        full_name: member.full_name,
        organization_id: member.organization_id,
        is_member: true
      }
    });

    if (createErr) {
      if (createErr.message.includes('already exists') || createErr.status === 422) {
        // Retrieve existing user
        const { data: listData } = await supabase.auth.admin.listUsers();
        targetUser = listData?.users?.find(u => u.email?.toLowerCase() === member.email?.toLowerCase());
        
        // Ensure user metadata is updated to mark as member
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

    // 6. Link user_id on the members table if not set
    if (member.user_id !== targetUser.id) {
      await supabase
        .from('members')
        .update({ user_id: targetUser.id })
        .eq('id', member.id);
    }

    // 7. Programmatically generate a password recovery / setup link (does NOT trigger SMTP emails)
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: member.email,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (linkErr) {
      throw linkErr;
    }

    // Instead of using Supabase's hosted redirect link (which triggers domain redirects based on Dashboard URL settings),
    // we direct the member straight to our local app's setup page, passing the email_otp code as a token parameter.
    const actionLink = `${origin}/member/setup-password?token=${linkData.properties.email_otp}&email=${encodeURIComponent(member.email)}`;

    // 8. Fetch Organization & custom Brevo sender settings
    const { data: org } = await supabase
      .from('organizations')
      .select('name, brevo_api_key, brevo_sender_email, brevo_sender_name')
      .eq('id', member.organization_id)
      .single();

    const apiKeyToUse = org?.brevo_api_key || BREVO_API_KEY;
    const senderEmailToUse = org?.brevo_sender_email || BREVO_SENDER_EMAIL;
    const htmlContent = getMemberInviteEmailTemplate({
      fullName: member.full_name,
      orgName: org?.name || 'Rotary Club',
      actionLink
    });

    const emailSubject = `Activate Your Member Portal — ${org?.name || 'Rotary Club'}`;

    // Try sending via Brevo first
    if (apiKeyToUse) {
      try {
        const emailResponse = await fetch('http://ugpay.tech:3001/proxy-brevo', {
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
              email: member.email,
              name: member.full_name
            }],
            subject: emailSubject,
            htmlContent
          })
        });

        if (emailResponse.ok) {
          return res.status(200).json({
            success: true,
            message: 'Custom invitation email successfully sent to member via Brevo',
            user: targetUser
          });
        } else {
          const errText = await emailResponse.text();
          console.error('Brevo invitation dispatch failed:', errText);
          if (!RESEND_API_KEY) {
            throw new Error(`Email dispatch failed: ${errText}`);
          }
        }
      } catch (brevoErr: any) {
        console.error('Brevo exception during invitation dispatch:', brevoErr);
        if (!RESEND_API_KEY) throw brevoErr;
      }
    }

    // Fallback to Resend API
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
          to: [member.email],
          subject: emailSubject,
          html: htmlContent,
        }),
      });

      if (resendRes.ok) {
        return res.status(200).json({
          success: true,
          message: 'Custom invitation email successfully sent to member via Resend',
          user: targetUser
        });
      } else {
        const resendErrText = await resendRes.text();
        throw new Error(`Email dispatch failed via Resend: ${resendErrText}`);
      }
    }

    throw new Error('No email service API key configured (Brevo or Resend).');

  } catch (error: any) {
    console.error('Member invite error:', error);
    return res.status(500).json({ error: error.message || 'Failed to trigger member invitation' });
  }
}
