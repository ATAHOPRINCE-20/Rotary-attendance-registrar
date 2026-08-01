import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    console.log('Relworx Webhook Received:', JSON.stringify(payload));

    // Extract reference identifiers
    const validationRef = payload.validation_reference || payload.validationRef || payload.data?.validation_reference;
    const internalRef = payload.internal_reference || payload.internalRef || payload.data?.internal_reference;
    const reference = payload.reference || payload.ref || payload.data?.reference;
    const rawStatus = String(payload.status || payload.transaction_status || payload.data?.status || '').toLowerCase();

    if (!validationRef && !internalRef && !reference) {
      console.warn('Relworx Webhook missing reference identifier:', payload);
      return res.status(400).json({ error: 'Missing reference identifier in webhook payload' });
    }

    let finalStatus: 'completed' | 'failed' | 'pending' = 'pending';
    if (['success', 'successful', 'completed', 'approved'].includes(rawStatus)) {
      finalStatus = 'completed';
    } else if (['failed', 'error', 'declined', 'cancelled', 'rejected'].includes(rawStatus)) {
      finalStatus = 'failed';
    }

    if (finalStatus === 'pending') {
      return res.status(200).json({ success: true, message: 'Status remains pending.' });
    }

    // Query matching withdrawal in database
    let query = supabase.from('withdrawals').select('id, status');

    if (validationRef) {
      query = query.eq('validation_reference', validationRef);
    } else if (reference) {
      query = query.eq('reference', reference);
    }

    const { data: records, error: fetchErr } = await query;

    if (fetchErr) {
      console.error('Error fetching withdrawal for webhook:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }

    if (!records || records.length === 0) {
      console.warn(`No matching withdrawal found for webhook ref: valRef=${validationRef}, ref=${reference}`);
      return res.status(200).json({ success: true, message: 'No matching record found.' });
    }

    const targetRecord = records[0];

    // Update status in DB
    const { error: updateErr } = await supabase
      .from('withdrawals')
      .update({
        status: finalStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetRecord.id);

    if (updateErr) {
      console.error('Error updating withdrawal status via webhook:', updateErr);
      return res.status(500).json({ error: updateErr.message });
    }

    console.log(`Successfully updated withdrawal ${targetRecord.id} to ${finalStatus} via Relworx Webhook`);

    return res.status(200).json({
      success: true,
      message: `Withdrawal status updated to ${finalStatus}`,
      withdrawalId: targetRecord.id
    });

  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message || 'Webhook internal error' });
  }
}
