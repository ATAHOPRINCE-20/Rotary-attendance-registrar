import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from './utils/rate-limit';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate Limiting (30 requests per minute per IP)
  const rateLimitResult = await rateLimit(req, 'check-withdrawal', 30, 60);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: rateLimitResult.error });
  }

  const reference = req.query.reference as string;
  const organizationId = req.query.organizationId as string;

  if (!reference || !organizationId) {
    return res.status(400).json({ error: 'Missing query parameters: reference, organizationId' });
  }

  // Validate authentication & permissions
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

  try {
    // 1. Fetch current withdrawal record
    const { data: withdrawal, error: dbError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('reference', reference)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal record not found' });
    }

    // If it's already completed or failed, return it immediately
    if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
      return res.status(200).json({ success: true, status: withdrawal.status, withdrawal });
    }

    // 2. Resolve credentials
    const apiKey = process.env.RELWORX_API_KEY || '';
    const accountNo = process.env.RELWORX_ACCOUNT_NO || '';
    const isSandbox = process.env.RELWORX_SANDBOX === 'true' || !apiKey || !accountNo;

    let finalStatus: 'pending' | 'completed' | 'failed' = 'pending';

    if (isSandbox) {
      // Sandbox auto-completes after 3 seconds
      const createdAt = new Date(withdrawal.created_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - createdAt) / 1000;

      if (elapsedSeconds >= 3) {
        finalStatus = 'completed';
      } else {
        finalStatus = 'pending';
      }
    } else {
      // 3. Call live Relworx API to check payout request status
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

      // Parse status
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

    // 4. Update status in database if changed
    if (finalStatus !== withdrawal.status) {
      const { data: updatedWithdrawal, error: updateError } = await supabase
        .from('withdrawals')
        .update({ status: finalStatus })
        .eq('id', withdrawal.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update withdrawal status: ${updateError.message}`);
      }

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
    console.error('Check withdrawal error:', error);
    return res.status(500).json({ error: error.message || 'Failed to verify withdrawal status' });
  }
}
