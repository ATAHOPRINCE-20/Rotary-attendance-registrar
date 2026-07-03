import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const reference = req.query.reference as string;
  const organizationId = req.query.organizationId as string;

  if (!reference || !organizationId) {
    return res.status(400).json({ error: 'Missing query parameters: reference, organizationId' });
  }

  try {
    // 1. Fetch current donation record
    const { data: donation, error: dbError } = await supabase
      .from('donations')
      .select('*')
      .eq('receipt_number', reference)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!donation) {
      return res.status(404).json({ error: 'Donation record not found' });
    }

    // If it's already marked as completed or failed, return it immediately to avoid unnecessary API calls
    if (donation.status === 'completed' || donation.status === 'failed') {
      return res.status(200).json({ success: true, status: donation.status, donation });
    }

    // 2. Resolve Credentials (using global platform environment variables only)
    const apiKey = process.env.RELWORX_API_KEY || '';
    const accountNo = process.env.RELWORX_ACCOUNT_NO || '';
    const isSandbox = process.env.RELWORX_SANDBOX === 'true' || !apiKey || !accountNo || reference.startsWith('DON-SIM-');

    let finalStatus: 'pending' | 'completed' | 'failed' = 'pending';

    // 3. Handle Sandbox Polling Simulation
    if (isSandbox) {
      const createdAt = new Date(donation.created_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - createdAt) / 1000;

      // Automatically succeed after 5 seconds in sandbox
      if (elapsedSeconds >= 5) {
        finalStatus = 'completed';
      } else {
        finalStatus = 'pending';
      }
    } else {
      // 4. Call live Relworx API to check request status
      const response = await fetch(`https://payments.relworx.com/api/mobile-money/check-request-status?reference=${reference}&account_no=${accountNo}`, {
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

      // Check request status field (can be 'success', 'completed', 'failed', 'cancelled', 'pending')
      const gatewayStatus = (result.status || result.request_status || 'pending').toLowerCase();

      if (gatewayStatus === 'success' || gatewayStatus === 'completed') {
        finalStatus = 'completed';
      } else if (gatewayStatus === 'failed' || gatewayStatus === 'cancelled') {
        finalStatus = 'failed';
      } else {
        finalStatus = 'pending';
      }
    }

    // 5. If status changed, update in Database
    if (finalStatus !== donation.status) {
      const { data: updatedDonation, error: updateError } = await supabase
        .from('donations')
        .update({ status: finalStatus })
        .eq('id', donation.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update donation status in database: ${updateError.message}`);
      }

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
    console.error('Check donation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to verify donation status' });
  }
}
