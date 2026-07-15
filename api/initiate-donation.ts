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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate Limiting (10 requests per minute per IP)
  const rateLimitResult = await rateLimit(req, 'initiate-donation', 10, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

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
    slug, // Used for constructing local sandbox redirects
    campaignId
  } = req.body;

  if (!organizationId || !amount || !fullName || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required parameters: organizationId, amount, fullName, paymentMethod' });
  }

  if (paymentMethod === 'mobile' && !phone) {
    return res.status(400).json({ error: 'Phone number is required for Mobile Money payments' });
  }

  // 1. Resolve Credentials (using global platform environment variables only)
  const apiKey = process.env.RELWORX_API_KEY || '';
  const accountNo = process.env.RELWORX_ACCOUNT_NO || '';
  const isSandbox = process.env.RELWORX_SANDBOX === 'true' || !apiKey || !accountNo;

  // 2. Generate a unique reference
  const refPrefix = isSandbox ? 'DON-SIM-' : 'DON-';
  const reference = `${refPrefix}${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  try {
    // 3. Insert PENDING donation record in Database
    const { error: dbError } = await supabase
      .from('donations')
      .insert({
        organization_id: organizationId,
        event_id: eventId || null,
        registration_id: registrationId || null,
        campaign_id: campaignId || null,
        full_name: fullName.trim() || 'Anonymous',
        email: email ? email.trim() : null,
        amount: Number(amount),
        currency: currency,
        category: category || 'general',
        payment_method: paymentMethod,
        status: 'pending',
        phone_number: phone ? phone.trim() : null,
        receipt_number: reference
      });

    if (dbError) {
      throw new Error(`Database record creation failed: ${dbError.message}`);
    }

    // 4. Handle Sandbox Mode (Simulated Payment)
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

    // 5. Handle Live Mode (Call Relworx API)
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

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Relworx Card session request failed');
      }

      const paymentUrl = result.payment_url;
      if (!paymentUrl) {
        throw new Error('Relworx did not return a payment checkout URL');
      }

      return res.status(200).json({
        success: true,
        reference,
        payment_url: paymentUrl,
        gatewayResponse: result
      });
    }

    return res.status(400).json({ error: 'Unsupported payment method' });

  } catch (error: any) {
    console.error('Initiate donation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to initiate donation payment' });
  }
}
