-- Add Tenant Billing and Subscription Management columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS momo_phone TEXT DEFAULT NULL;

-- Create helper function to check super admin status (SECURITY DEFINER bypasses RLS to prevent infinite recursion)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Super Admins to view/manage all organizations and profiles
DROP POLICY IF EXISTS "Super admins manage all orgs" ON organizations;
CREATE POLICY "Super admins manage all orgs"
  ON organizations FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super admins manage all profiles" ON profiles;
CREATE POLICY "Super admins manage all profiles"
  ON profiles FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Enable Super Admins to manage all events
DROP POLICY IF EXISTS "Super admins manage all events" ON events;
CREATE POLICY "Super admins manage all events"
  ON events FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Enable Super Admins to manage all members
DROP POLICY IF EXISTS "Super admins manage all members" ON members;
CREATE POLICY "Super admins manage all members"
  ON members FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Enable Super Admins to manage all registrations
DROP POLICY IF EXISTS "Super admins manage all registrations" ON registrations;
CREATE POLICY "Super admins manage all registrations"
  ON registrations FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Enable Super Admins to manage all donations
DROP POLICY IF EXISTS "Super admins manage all donations" ON donations;
CREATE POLICY "Super admins manage all donations"
  ON donations FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Enable Super Admins to manage all campaigns
DROP POLICY IF EXISTS "Super admins manage all campaigns" ON campaigns;
CREATE POLICY "Super admins manage all campaigns"
  ON campaigns FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Enable Super Admins to manage all withdrawals
DROP POLICY IF EXISTS "Super admins manage all withdrawals" ON withdrawals;
CREATE POLICY "Super admins manage all withdrawals"
  ON withdrawals FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
