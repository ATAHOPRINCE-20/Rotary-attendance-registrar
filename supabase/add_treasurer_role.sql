-- ============================================================
-- Rotary Connect — Add Treasurer Role
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Drop existing check constraint on profiles.role and re-add with 'treasurer'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'treasurer', 'staff'));

-- 2. Update is_admin() helper to include 'treasurer'
--    (allows treasurers to pass existing admin-only RLS checks for financial tables)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin', 'treasurer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update donation_campaigns RLS policy to include 'treasurer'
DROP POLICY IF EXISTS "Admins manage donation campaigns" ON donation_campaigns;
CREATE POLICY "Admins manage donation campaigns"
  ON donation_campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = donation_campaigns.organization_id
      AND profiles.role IN ('admin', 'super_admin', 'treasurer')
    )
  );

-- 4. Allow treasurers to view donations (financial read access)
DROP POLICY IF EXISTS "Treasurer view org donations" ON donations;
CREATE POLICY "Treasurer view org donations"
  ON donations FOR SELECT
  TO authenticated
  USING (organization_id = my_org_id() AND is_admin());

-- 5. Allow treasurers to view withdrawals
DROP POLICY IF EXISTS "Treasurer view org withdrawals" ON withdrawals;
CREATE POLICY "Treasurer view org withdrawals"
  ON withdrawals FOR SELECT
  TO authenticated
  USING (organization_id = my_org_id() AND is_admin());
