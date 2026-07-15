import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './utils/rate-limit.js';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function fetchRelworx(urlStr: string, options: any = {}): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.FIXIE_URL || '';
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    const reqOptions: https.RequestOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: agent as any,
    };

    const req = https.request(urlStr, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          ok: (res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300,
          status: res.statusCode || 200,
          json: async () => {
            try {
              return JSON.parse(data);
            } catch {
              return {};
            }
          }
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function formatMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return '+256' + digits.substring(1);
  }
  if (digits.length === 9) {
    return '+256' + digits;
  }
  if (digits.startsWith('256') && digits.length === 12) {
    return '+' + digits;
  }
  return '+' + digits;
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

  // Rate Limiting (10 requests per minute per IP)
  const rateLimitResult = await rateLimit(req, 'withdraw', 10, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  const { amount, phone, recipientName, organizationId } = req.body;

  if (!amount || !phone || !organizationId) {
    return res.status(400).json({ error: 'Missing required parameters: amount, phone, organizationId' });
  }

  // 0. Validate authentication & permissions
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];

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

  if (profile.organization_id !== organizationId) {
    return res.status(403).json({ error: 'Forbidden: You do not belong to this organization' });
  }

  if (!['admin', 'super_admin'].includes(profile.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  }

  const payoutAmount = Number(amount);
  if (isNaN(payoutAmount) || payoutAmount <= 0) {
    return res.status(400).json({ error: 'Invalid payout amount.' });
  }

  try {
    // 1. Fetch organization details to get names & verify exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // 2. Calculate balance ledger
    // Get total completed donations
    const { data: donations, error: donError } = await supabase
      .from('donations')
      .select('amount')
      .eq('organization_id', organizationId)
      .eq('status', 'completed');

    if (donError) throw donError;

    // Get total pending/completed withdrawals
    const { data: withdrawals, error: withError } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('organization_id', organizationId)
      .in('status', ['completed', 'pending']);

    if (withError) throw withError;

    const totalDonations = donations.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const totalWithdrawals = withdrawals.reduce((sum: number, w: any) => sum + Number(w.amount), 0);
    const withdrawableBalance = totalDonations - totalWithdrawals;

    if (payoutAmount > withdrawableBalance) {
      return res.status(400).json({ error: `Insufficient balance. Withdrawable balance is UGX ${withdrawableBalance.toLocaleString()}.` });
    }

    // 3. Setup credentials
    const apiKey = process.env.RELWORX_API_KEY || '';
    const accountNo = process.env.RELWORX_ACCOUNT_NO || '';
    const isSandbox = process.env.RELWORX_SANDBOX === 'true' || !apiKey || !accountNo;

    // Generate reference
    const reference = 'WITH-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // 4. Create pending withdrawal record in database
    const { data: withdrawal, error: insertError } = await supabase
      .from('withdrawals')
      .insert({
        organization_id: organizationId,
        amount: payoutAmount,
        currency: 'UGX',
        recipient_phone: formatMsisdn(phone),
        recipient_name: recipientName || null,
        status: 'pending',
        reference: reference
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create withdrawal record: ${insertError.message}`);
    }

    // 5. Run payout
    if (isSandbox) {
      // Simulate completed payout after 1 second
      const { error: updateError } = await supabase
        .from('withdrawals')
        .update({ status: 'completed' })
        .eq('id', withdrawal.id);

      if (updateError) throw updateError;

      return res.status(200).json({
        success: true,
        status: 'completed',
        reference,
        message: 'Sandbox withdrawal simulated successfully.'
      });
    } else {
      // Call live Relworx send-payment API
      const msisdn = formatMsisdn(phone);
      const description = `Withdrawal to ${recipientName || 'Mobile'} - ${org.name}`;

      const response = await fetchRelworx('https://payments.relworx.com/api/mobile-money/send-payment', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.relworx.v2',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          account_no: accountNo,
          reference: reference,
          msisdn: msisdn,
          currency: 'UGX',
          amount: payoutAmount,
          description: description
        })
      });

      const result: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Mark as failed in database
        await supabase
          .from('withdrawals')
          .update({ status: 'failed' })
          .eq('id', withdrawal.id);

        throw new Error(result.message || result.error || 'Relworx Send Payment API failed.');
      }

      // Check request status from response (payouts can return 'completed' or 'pending')
      const gatewayStatus = (result.status || result.request_status || result.data?.status || 'pending').toLowerCase();
      let finalStatus: 'pending' | 'completed' | 'failed' = 'pending';

      if (gatewayStatus === 'success' || gatewayStatus === 'completed') {
        finalStatus = 'completed';
      } else if (gatewayStatus === 'failed' || gatewayStatus === 'cancelled') {
        finalStatus = 'failed';
      }

      // Update final status in DB
      await supabase
        .from('withdrawals')
        .update({ status: finalStatus })
        .eq('id', withdrawal.id);

      return res.status(200).json({
        success: true,
        status: finalStatus,
        reference,
        gatewayResponse: result
      });
    }

  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process withdrawal payout.' });
  }
}
