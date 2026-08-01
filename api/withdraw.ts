import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './_rate-limit.js';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

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

function makeRelworxRequest(urlStr: string, options: any, useProxy: boolean): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(useProxy ? 'Proxy connection timed out.' : 'Direct connection timed out.'));
    }, 8000);

    const proxyUrl = useProxy ? (process.env.HTTPS_PROXY || process.env.FIXIE_URL || '') : '';
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    const reqOptions: https.RequestOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: agent as any,
    };

    const bodyStr = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    if (bodyStr) {
      (reqOptions.headers as Record<string, any>)['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(urlStr, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timeoutId);
        resolve({
          ok: (res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300,
          status: res.statusCode || 200,
          json: async () => {
            try { return JSON.parse(data); } catch { return {}; }
          }
        });
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function fetchRelworx(urlStr: string, options: any = {}): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const method = options.method || 'GET';
  const proxyEndpoint = process.env.RELWORX_PROXY_URL || 'http://ugpay.tech:3001/proxy-relworx';

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-target-url': urlStr,
      ...(options.headers || {})
    };

    const proxyRes = await fetch(proxyEndpoint, {
      method: method,
      headers: headers,
      body: method !== 'GET' && options.body 
        ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
        : undefined
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
    console.warn('VPS Relworx Proxy call failed, attempting direct connection:', proxyErr.message);
  }

  return await makeRelworxRequest(urlStr, options, false);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --------------------------------------------------------------------------
  // GET: Check Withdrawal Request Status
  // --------------------------------------------------------------------------
  if (req.method === 'GET') {
    const rateLimitResult = await rateLimit(req, 'check-withdrawal', 30, 60);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: rateLimitResult.error });
    }

    const reference = req.query.reference as string;
    const organizationId = req.query.organizationId as string;

    if (!reference || !organizationId) {
      return res.status(400).json({ error: 'Missing query parameters: reference, organizationId' });
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

    if (profileErr || !profile || profile.organization_id !== organizationId) {
      return res.status(403).json({ error: 'Forbidden: You do not belong to this organization' });
    }

    if (!['admin', 'super_admin', 'treasurer'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    try {
      const { data: withdrawal } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('reference', reference)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (!withdrawal) {
        return res.status(404).json({ error: 'Withdrawal record not found' });
      }

      if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
        return res.status(200).json({ success: true, status: withdrawal.status, withdrawal });
      }

      const apiKey = process.env.RELWORX_API_KEY || '';
      const accountNo = process.env.RELWORX_ACCOUNT_NO || '';
      const isSandbox = process.env.RELWORX_SANDBOX === 'true' || !apiKey || !accountNo;

      let finalStatus: 'pending' | 'completed' | 'failed' = 'pending';

      if (isSandbox) {
        const createdAt = new Date(withdrawal.created_at).getTime();
        const now = Date.now();
        const elapsedSeconds = (now - createdAt) / 1000;
        finalStatus = elapsedSeconds >= 3 ? 'completed' : 'pending';
      } else {
        const response = await fetchRelworx(`https://payments.relworx.com/api/mobile-money/check-request-status?internal_reference=${reference}&account_no=${accountNo}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.relworx.v2',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        });

        const result: any = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || result.error || 'Failed to check status with Relworx');
        }

        const gatewayStatus = (
          result.status || 
          result.request_status || 
          result.data?.status || 
          result.data?.request_status || 
          'pending'
        ).toLowerCase();

        if (gatewayStatus === 'success' || gatewayStatus === 'completed' || gatewayStatus === 'successful') {
          finalStatus = 'completed';
        } else if (gatewayStatus === 'failed' || gatewayStatus === 'cancelled') {
          finalStatus = 'failed';
        } else {
          finalStatus = 'pending';
        }
      }

      if (finalStatus !== withdrawal.status) {
        const { data: updatedWithdrawal } = await supabase
          .from('withdrawals')
          .update({ status: finalStatus })
          .eq('id', withdrawal.id)
          .select()
          .single();

        return res.status(200).json({
          success: true,
          status: finalStatus,
          withdrawal: updatedWithdrawal
        });
      }

      return res.status(200).json({
        success: true,
        status: withdrawal.status,
        withdrawal
      });

    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to verify withdrawal status' });
    }
  }

  // --------------------------------------------------------------------------
  // POST: Execute Payout / Withdrawal
  // --------------------------------------------------------------------------
  if (req.method === 'POST') {
    const rateLimitResult = await rateLimit(req, 'withdraw', 10, 60);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: rateLimitResult.error });
    }

    const {
      amount,
      phone,
      organizationId,
      payoutMethod = 'mobile_money',
      bankCode,
      bankName,
      accountNumber,
      validationReference,
      chargeAmount
    } = req.body;

    if (!amount || !organizationId) {
      return res.status(400).json({ error: 'Missing required parameters: amount, organizationId' });
    }

    if (payoutMethod === 'mobile_money' && !phone) {
      return res.status(400).json({ error: 'Recipient phone number is required for Mobile Money payouts' });
    }

    if (payoutMethod === 'bank_transfer' && (!accountNumber || !validationReference)) {
      return res.status(400).json({ error: 'Bank account number and validation reference are required for Bank Transfer payouts' });
    }

    const payoutAmount = Number(amount);
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payout amount' });
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

    if (profileErr || !profile || profile.organization_id !== organizationId) {
      return res.status(403).json({ error: 'Forbidden: You do not belong to this organization' });
    }

    if (!['admin', 'super_admin', 'treasurer'].includes(profile.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    try {
      const { data: donations, error: donError } = await supabase
        .from('donations')
        .select('amount, payment_method')
        .eq('organization_id', organizationId)
        .eq('status', 'completed');

      if (donError) throw donError;

      const { data: withdrawals, error: withError } = await supabase
        .from('withdrawals')
        .select('amount, charge_amount')
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'completed']);

      if (withError) throw withError;

      const totalDigitalDonations = donations
        .filter((d: any) => d.payment_method !== 'cash')
        .reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const totalWithdrawals = withdrawals.reduce((sum: number, w: any) => sum + Number(w.amount), 0);
      const withdrawableBalance = Math.max(0, totalDigitalDonations - totalWithdrawals);

      if (payoutAmount > withdrawableBalance) {
        return res.status(400).json({
          error: `Insufficient balance. Requested withdrawal is UGX ${payoutAmount.toLocaleString()}, but available withdrawable balance is UGX ${withdrawableBalance.toLocaleString()}.`
        });
      }

      const apiKey = process.env.RELWORX_API_KEY || '';
      const accountNo = process.env.RELWORX_ACCOUNT_NO || '';
      const isSandbox = process.env.RELWORX_SANDBOX === 'true' || !apiKey || !accountNo;

      const reference = 'WITH-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      const insertPayload: any = {
        organization_id: organizationId,
        amount: payoutAmount,
        currency: 'UGX',
        recipient_phone: phone ? formatMsisdn(phone) : (accountNumber || ''),
        status: 'pending',
        reference: reference,
        requested_by: user.id
      };

      if (payoutMethod === 'bank_transfer') {
        insertPayload.payout_method = 'bank_transfer';
        insertPayload.bank_code = bankCode || null;
        insertPayload.bank_name = bankName || null;
        insertPayload.account_number = accountNumber || null;
        insertPayload.validation_reference = validationReference || null;
        insertPayload.charge_amount = Number(chargeAmount) || 5000;
      } else {
        insertPayload.payout_method = 'mobile_money';
        insertPayload.charge_amount = 0;
      }

      let withdrawal: any = null;
      let dbError: any = null;

      const primaryInsert = await supabase
        .from('withdrawals')
        .insert(insertPayload)
        .select()
        .single();

      if (primaryInsert.error) {
        console.warn('Primary withdrawal insert failed, trying schema fallback:', primaryInsert.error.message);
        const fallbackPayload = {
          organization_id: organizationId,
          amount: payoutAmount,
          currency: 'UGX',
          recipient_phone: payoutMethod === 'bank_transfer'
            ? `${bankName || 'Bank'}: ${accountNumber}`
            : formatMsisdn(phone),
          status: 'pending',
          reference: reference,
          requested_by: user.id
        };

        const fallbackInsert = await supabase
          .from('withdrawals')
          .insert(fallbackPayload)
          .select()
          .single();

        withdrawal = fallbackInsert.data;
        dbError = fallbackInsert.error;
      } else {
        withdrawal = primaryInsert.data;
      }

      if (dbError || !withdrawal) {
        return res.status(500).json({ error: `Failed to create withdrawal record: ${dbError?.message}` });
      }

      if (isSandbox) {
        return res.status(200).json({
          success: true,
          status: 'pending',
          withdrawal: withdrawal,
          reference: reference,
          isSandbox: true,
          message: 'Sandbox withdrawal request initiated successfully.'
        });
      }

      if (payoutMethod === 'bank_transfer') {
        const response = await fetchRelworx('https://payments.relworx.com/api/products/purchase', {
          method: 'POST',
          headers: {
            'Accept': 'application/json, application/vnd.relworx.v2',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: {
            account_no: accountNo,
            validation_reference: validationReference
          }
        });

        const result: any = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
          await supabase.from('withdrawals').update({ status: 'failed' }).eq('id', withdrawal.id);
          return res.status(response.status || 400).json({
            error: result.message || result.error || 'Bank transfer product purchase failed.',
            relworxError: result
          });
        }

        return res.status(200).json({
          success: true,
          status: 'pending',
          withdrawal: withdrawal,
          reference: reference,
          internal_reference: result.internal_reference,
          message: 'Bank transfer purchase executed successfully.'
        });

      } else {
        const formattedPhone = formatMsisdn(phone);
        const response = await fetchRelworx('https://payments.relworx.com/api/mobile-money/send-payment', {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.relworx.v2',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: {
            account_no: accountNo,
            reference: reference,
            msisdn: formattedPhone,
            amount: payoutAmount,
            currency: 'UGX',
            description: `Payout from Rotary Club`
          }
        });

        const result: any = await response.json().catch(() => ({}));

        if (!response.ok) {
          await supabase.from('withdrawals').update({ status: 'failed' }).eq('id', withdrawal.id);
          return res.status(response.status || 400).json({
            error: result.message || result.error || 'Failed to send payment request to Relworx',
            relworxError: result
          });
        }

        return res.status(200).json({
          success: true,
          status: 'pending',
          withdrawal: withdrawal,
          reference: reference,
          message: result.message || 'Mobile Money payout request sent successfully.'
        });
      }

    } catch (error: any) {
      console.error('Withdrawal API error:', error);
      return res.status(500).json({ error: error.message || 'Failed to process withdrawal request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
