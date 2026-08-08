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

async function authenticateSuperAdmin(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or invalid token', status: 401 as const };
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Unauthorized: Session expired or invalid token.', status: 401 as const };
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile || profile.role !== 'super_admin') {
    return { error: 'Forbidden: Super admin access required.', status: 403 as const };
  }

  return { user };
}

async function enrichProfiles(profiles: any[]) {
  return Promise.all(
    profiles.map(async (profile) => {
      let email = profile.email || null;
      let phone = profile.phone || null;

      if (!email || !phone) {
        const { data: authData } = await supabase.auth.admin.getUserById(profile.id);
        const authUser = authData?.user;
        email = email || authUser?.email || null;
        phone = phone || authUser?.phone || authUser?.user_metadata?.phone || null;

        const updates: Record<string, string> = {};
        if (!profile.email && email) updates.email = email;
        if (!profile.phone && phone) updates.phone = phone;

        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', profile.id);
        }
      }

      return { ...profile, email, phone };
    })
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await authenticateSuperAdmin(req);
  if ('error' in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const organizationId = typeof req.query.organizationId === 'string'
    ? req.query.organizationId
    : null;
  const fetchAll = req.query.all === 'true';

  try {
    if (fetchAll) {
      const [profilesRes, membersRes] = await Promise.all([
        supabase.from('profiles').select('*').order('organization_id'),
        supabase.from('members').select('id, full_name, email, phone, buddy_group, organization_id').order('full_name'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (membersRes.error) throw membersRes.error;

      const profiles = await enrichProfiles(profilesRes.data || []);
      return res.status(200).json({ profiles, members: membersRes.data || [] });
    }

    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId is required' });
    }

    const [profilesRes, membersRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('organization_id', organizationId).order('role'),
      supabase
        .from('members')
        .select('id, full_name, email, phone, buddy_group, organization_id, created_at, updated_at')
        .eq('organization_id', organizationId)
        .order('full_name'),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (membersRes.error) throw membersRes.error;

    const profiles = await enrichProfiles(profilesRes.data || []);
    return res.status(200).json({ profiles, members: membersRes.data || [] });
  } catch (err: any) {
    console.error('[tenant-contacts]', err);
    return res.status(500).json({ error: err?.message || 'Failed to load tenant contacts.' });
  }
}
