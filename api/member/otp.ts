import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../../src/lib/rate-limit.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_BREVO_KEY = process.env.BREVO_API_KEY || '';
const DEFAULT_BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'support@agoroll.com';
const DEFAULT_BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'agoroll';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, identifier, otpCode } = req.body;

  // VERIFY OTP FLOW
  if (action === 'verify' || otpCode) {
    if (!identifier || !otpCode) {
      return res.status(400).json({ error: 'Missing identifier or otpCode parameter' });
    }

    try {
      let otpQuery = supabase
        .from('member_login_otps')
        .select('*')
        .eq('otp_code', otpCode.trim())
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
          // User already exists
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

    if (!isEmail && targetPhone) {
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
        if (!targetEmail) {
          return res.status(500).json({ error: `Failed to send WhatsApp code: ${err.message}. No email is configured for fallback.` });
        }
      }
    }

    if (channelSent === 'email') {
      if (!targetEmail) {
        return res.status(400).json({ error: 'No email address registered for this member.' });
      }

      const brevoKey = org?.brevo_api_key || DEFAULT_BREVO_KEY;
      const senderEmail = org?.brevo_sender_email || DEFAULT_BREVO_SENDER_EMAIL;
      const senderName = org?.brevo_sender_name || DEFAULT_BREVO_SENDER_NAME;

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

      const response = await fetch('http://ugpay.tech:3001/proxy-brevo', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: targetEmail, name: member.full_name }],
          subject: 'Your Club Portal Verification Code',
          htmlContent: htmlContent
        })
      });

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(500).json({ error: resJson.message || 'Failed to send email fallback code' });
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
