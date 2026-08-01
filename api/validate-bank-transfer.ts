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

const FALLBACK_BANK_PRODUCTS = [
  {
    name: "Stanbic Bank Uganda Ltd Transfer",
    code: "STANBIC_BANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "Centenary Bank Uganda Transfer",
    code: "CENTENARY_BANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "ABSA Bank Uganda Ltd Transfer",
    code: "ABSA_BANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "Equity Bank Uganda Ltd Transfer",
    code: "EQUITY_BANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "DFCU Bank Uganda Transfer",
    code: "DFCU_BANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "Finance Trust Bank Uganda Ltd Transfer",
    code: "FINANCE_TRUST_BANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "Housing Finance Bank Uganda Transfer",
    code: "HOUSING_FINANCE_BANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "PostBank Uganda Ltd Transfer",
    code: "POSTBANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "KCB Bank Uganda Transfer",
    code: "KCB_BANK_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  },
  {
    name: "Bank of Baroda Uganda Transfer",
    code: "BANK_OF_BARODA_UGANDA_TRANSFER",
    category: "BANK_TRANSFERS",
    has_price_list: false,
    has_choice_list: false,
    billable: true
  }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --------------------------------------------------------------------------
  // GET: Fetch Available Bank Products
  // --------------------------------------------------------------------------
  if (req.method === 'GET') {
    const rateLimitResult = await rateLimit(req, 'bank-products', 30, 60);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: rateLimitResult.error });
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

    const apiKey = process.env.RELWORX_API_KEY || '';
    const accountNo = process.env.RELWORX_ACCOUNT_NO || '';
    const isSandbox = process.env.RELWORX_SANDBOX === 'true' || !apiKey || !accountNo;

    if (isSandbox) {
      return res.status(200).json({
        success: true,
        products: FALLBACK_BANK_PRODUCTS,
        isSandbox: true
      });
    }

    try {
      const response = await fetchRelworx('https://payments.relworx.com/api/products', {
        method: 'GET',
        headers: {
          'Accept': 'application/json, application/vnd.relworx.v2',
          'Authorization': `Bearer ${apiKey}`
        }
      });

      const result: any = await response.json().catch(() => ({}));

      if (!response.ok || !result.products || !Array.isArray(result.products)) {
        return res.status(200).json({
          success: true,
          products: FALLBACK_BANK_PRODUCTS,
          fallback: true
        });
      }

      const bankProducts = result.products.filter(
        (p: any) => p.category === 'BANK_TRANSFERS' || (p.code && p.code.includes('BANK') && p.code.includes('TRANSFER'))
      );

      return res.status(200).json({
        success: true,
        products: bankProducts.length > 0 ? bankProducts : FALLBACK_BANK_PRODUCTS
      });

    } catch (error: any) {
      return res.status(200).json({
        success: true,
        products: FALLBACK_BANK_PRODUCTS,
        fallback: true,
        error: error.message
      });
    }
  }

  // --------------------------------------------------------------------------
  // POST: Validate Selected Bank Transfer Details
  // --------------------------------------------------------------------------
  if (req.method === 'POST') {
    const rateLimitResult = await rateLimit(req, 'validate-bank-transfer', 15, 60);
    if (!rateLimitResult.success) {
      return res.status(429).json({ error: rateLimitResult.error });
    }

    const {
      accountNo,
      amount,
      productCode,
      accountName,
      contactPhone,
      organizationId
    } = req.body;

    if (!accountNo || !amount || !productCode || !accountName || !contactPhone || !organizationId) {
      return res.status(400).json({
        error: 'Missing required validation parameters: accountNo, amount, productCode, accountName, contactPhone, organizationId'
      });
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

    const grossAmount = Number(amount);
    const ESTIMATED_BANK_FEE = 5000;
    if (isNaN(grossAmount) || grossAmount <= ESTIMATED_BANK_FEE) {
      return res.status(400).json({
        error: `Minimum withdrawal amount for Bank Transfer must be greater than UGX ${ESTIMATED_BANK_FEE.toLocaleString()} to cover the bank transfer fee.`
      });
    }

    const netAmount = grossAmount - ESTIMATED_BANK_FEE;

    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const apiKey = process.env.RELWORX_API_KEY || '';
      const relworxAccountNo = process.env.RELWORX_ACCOUNT_NO || '';
      const isSandbox = process.env.RELWORX_SANDBOX === 'true' || !apiKey || !relworxAccountNo;

      const reference = 'VAL-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const formattedPhone = formatMsisdn(contactPhone);
      const depositorName = org.name || 'Rotary Club';

      if (isSandbox) {
        return res.status(200).json({
          success: true,
          validation_reference: `VAL-SB-${Math.random().toString(36).substring(2, 10).toLowerCase()}`,
          charge: "5000.0",
          customer_name: accountName.toUpperCase(),
          gross_amount: grossAmount,
          net_amount: netAmount,
          balance: "0.0",
          isSandbox: true
        });
      }

      const requestBody = {
        account_no: relworxAccountNo,
        reference: reference,
        msisdn: String(accountNo).trim(),
        amount: netAmount,
        product_code: String(productCode).trim(),
        depositor_name: depositorName,
        account_name: String(accountName).trim(),
        contact_phone: formattedPhone
      };

      const response = await fetchRelworx('https://payments.relworx.com/api/products/validate', {
        method: 'POST',
        headers: {
          'Accept': 'application/json, application/vnd.relworx.v2',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: requestBody
      });

      const result: any = await response.json().catch(() => ({}));

      if (!response.ok || result.success === false) {
        return res.status(response.status || 400).json({
          error: result.message || result.error || 'Bank transfer details validation failed.',
          relworxError: result
        });
      }

      const actualCharge = Number(result.charge) || ESTIMATED_BANK_FEE;
      const finalNetAmount = grossAmount - actualCharge;

      return res.status(200).json({
        success: true,
        validation_reference: result.validation_reference,
        charge: String(actualCharge),
        customer_name: result.customer_name || accountName,
        gross_amount: grossAmount,
        net_amount: finalNetAmount,
        balance: result.balance || '0.0'
      });

    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to validate bank transfer details.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
