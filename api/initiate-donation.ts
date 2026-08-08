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
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        clearTimeout(timeoutId);
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

  // 1. Primary: Route request through VPS Proxy (ugpay.tech static IP)
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

  // 2. Secondary fallback: Direct HTTPS call to Relworx API
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabase();

    // --------------------------------------------------------------------------
    // GET: Check Donation Payment Status
    // --------------------------------------------------------------------------
    if (req.method === 'GET') {
      const rateLimitResult = await rateLimit(req, 'check-donation', 60, 60);
      if (!rateLimitResult.success) {
        return res.status(429).json({ error: rateLimitResult.error });
      }

      const reference = req.query.reference as string;
      const organizationId = req.query.organizationId as string;

      if (!reference || !organizationId) {
        return res.status(400).json({ error: 'Missing query parameters: reference, organizationId' });
      }

      try {
        const { data: donation } = await supabase
          .from('donations')
          .select('*')
          .eq('receipt_number', reference)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (!donation) {
          return res.status(404).json({ error: 'Donation record not found' });
        }

        if (donation.status === 'completed' || donation.status === 'failed') {
          return res.status(200).json({ success: true, status: donation.status, donation });
        }

        const apiKey = process.env.RELWORX_API_KEY || '83b9807b3ea2ea.8UtP0JFHUqMu_MsooK9kAA';
        const accountNo = process.env.RELWORX_ACCOUNT_NO || 'RELB91D9643B2';
        const isSandbox = process.env.RELWORX_SANDBOX === 'true' || reference.startsWith('DON-SIM-');

        let finalStatus: 'pending' | 'completed' | 'failed' = 'pending';

        if (isSandbox) {
          const createdAt = new Date(donation.created_at).getTime();
          const now = Date.now();
          const elapsedSeconds = (now - createdAt) / 1000;
          finalStatus = elapsedSeconds >= 5 ? 'completed' : 'pending';
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

          if (gatewayStatus === 'success' || gatewayStatus === 'completed') {
            finalStatus = 'completed';
          } else if (gatewayStatus === 'failed' || gatewayStatus === 'cancelled') {
            finalStatus = 'failed';
          } else {
            finalStatus = 'pending';
          }
        }

        if (finalStatus !== donation.status) {
          const { data: updatedDonation } = await supabase
            .from('donations')
            .update({ status: finalStatus })
            .eq('id', donation.id)
            .select()
            .single();

          return res.status(200).json({
            success: true,
            status: finalStatus,
            donation: updatedDonation,
            isSimulated: isSandbox
          });
        }

        return res.status(200).json({
          success: true,
          status: donation.status,
          donation,
          isSimulated: isSandbox
        });

      } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Failed to verify donation status' });
      }
    }

    // --------------------------------------------------------------------------
    // POST: Initiate Donation Payment
    // --------------------------------------------------------------------------
    if (req.method === 'POST') {
      const rateLimitResult = await rateLimit(req, 'initiate-donation', 10, 60);
      if (!rateLimitResult.success) {
        return res.status(429).json({ error: rateLimitResult.error });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      body = body || {};

      const {
        organizationId,
        eventId,
        registrationId,
        amount,
        currency = 'UGX',
        fullName,
        email,
        category,
        paymentMethod,
        phone,
        slug,
        campaignId,
        memberId,
        duesCategoryId
      } = body;

      if (!organizationId || !amount || !fullName || !paymentMethod) {
        return res.status(400).json({ error: 'Missing required parameters: organizationId, amount, fullName, paymentMethod' });
      }

      if (Number(amount) < 500) {
        return res.status(400).json({ error: 'Minimum donation amount is UGX 500' });
      }

      if (paymentMethod === 'mobile' && !phone) {
        return res.status(400).json({ error: 'Phone number is required for Mobile Money payments' });
      }

      const apiKey = process.env.RELWORX_API_KEY || '83b9807b3ea2ea.8UtP0JFHUqMu_MsooK9kAA';
      const accountNo = process.env.RELWORX_ACCOUNT_NO || 'RELB91D9643B2';
      const isSandbox = process.env.RELWORX_SANDBOX === 'true';

      const refPrefix = isSandbox ? 'DON-SIM-' : 'DON-';
      const reference = `${refPrefix}${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      try {
        const primaryPayload: any = {
          organization_id: organizationId,
          event_id: eventId || null,
          registration_id: registrationId || null,
          campaign_id: campaignId || null,
          full_name: (fullName || 'Anonymous').trim(),
          email: email ? email.trim() : null,
          amount: Number(amount),
          currency: currency,
          category: category || 'general',
          payment_method: paymentMethod,
          status: 'pending',
          phone_number: phone ? phone.trim() : null,
          receipt_number: reference,
          member_id: memberId || null,
          dues_category_id: duesCategoryId || null
        };

        const primaryInsert = await supabase
          .from('donations')
          .insert(primaryPayload);

        if (primaryInsert.error) {
          console.warn('Primary donation insert failed, attempting fallback insert:', primaryInsert.error.message);
          const fallbackPayload = {
            organization_id: organizationId,
            event_id: eventId || null,
            registration_id: registrationId || null,
            full_name: (fullName || 'Anonymous').trim(),
            email: email ? email.trim() : null,
            amount: Number(amount),
            currency: currency,
            category: category || 'general',
            payment_method: paymentMethod,
            status: 'pending',
            phone_number: phone ? phone.trim() : null,
            receipt_number: reference
          };
          const fallbackInsert = await supabase
            .from('donations')
            .insert(fallbackPayload);

          if (fallbackInsert.error) {
            throw new Error(`Database record creation failed: ${fallbackInsert.error.message}`);
          }
        }

        if (isSandbox) {
          if (paymentMethod === 'card') {
            const redirectUrl = `/org/${slug}/donate?reference=${reference}&status=success`;
            return res.status(200).json({
              success: true,
              reference,
              payment_url: redirectUrl,
              isSimulated: true,
              message: 'Simulated Card session initiated'
            });
          } else {
            return res.status(200).json({
              success: true,
              reference,
              isSimulated: true,
              message: 'Simulated Mobile Money prompt initiated'
            });
          }
        }

        const msisdn = formatMsisdn(phone || '');
        const description = `Donation to Rotary Club - ${fullName}`;

        if (paymentMethod === 'mobile') {
          const response = await fetchRelworx('https://payments.relworx.com/api/mobile-money/request-payment', {
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
              currency: currency,
              amount: Number(amount),
              description: description
            })
          });

          const result: any = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(result.message || result.error || 'Relworx Mobile Money request failed');
          }

          return res.status(200).json({
            success: true,
            reference,
            gatewayResponse: result
          });

        } else if (paymentMethod === 'card') {
          let paymentUrl: string | null = null;

          try {
            const response = await fetchRelworx('https://payments.relworx.com/api/visa/request-session', {
              method: 'POST',
              headers: {
                'Accept': 'application/vnd.relworx.v2',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                account_no: accountNo,
                reference: reference,
                currency: currency,
                amount: Number(amount),
                description: description
              })
            });

            const result: any = await response.json().catch(() => ({}));
            if (response.ok && (result.payment_url || result.data?.payment_url)) {
              paymentUrl = result.payment_url || result.data?.payment_url;
            } else {
              const relworxErrMsg = result.message || result.error || '';
              if (!paymentUrl) {
                if (relworxErrMsg.toLowerCase().includes('disabled')) {
                  throw new Error('Card payments are disabled on your Relworx merchant account. Please enable Visa/Mastercard processing in your Relworx dashboard or use Mobile Money.');
                }
                throw new Error(relworxErrMsg || 'Relworx Card session request failed');
              }
            }
          } catch (cardErr: any) {
            throw cardErr;
          }

          return res.status(200).json({
            success: true,
            reference,
            payment_url: paymentUrl,
          });
        }

        return res.status(400).json({ error: 'Unsupported payment method' });

      } catch (error: any) {
        console.error('Initiate donation error:', error);
        return res.status(500).json({ error: error.message || 'Failed to initiate donation payment' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (fatalErr: any) {
    console.error('Fatal unhandled error in initiate-donation handler:', fatalErr);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: fatalErr?.message || 'Internal Server Error' });
  }
}
