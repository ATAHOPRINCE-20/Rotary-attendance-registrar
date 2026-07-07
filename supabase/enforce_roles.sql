-- ============================================================
-- Rotary Connect — Database Role-Based Access Control (RBAC)
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Helper function to check if the current user is an Admin or Super Admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update ORGANIZATIONS policies
DROP POLICY IF EXISTS "Admins update own org" ON organizations;
CREATE POLICY "Admins update own org"
  ON organizations FOR UPDATE
  USING (id = my_org_id() AND is_admin());

-- 3. Update PROFILES policies
DROP POLICY IF EXISTS "Admins see org profiles" ON profiles;
DROP POLICY IF EXISTS "Admins manage org profiles" ON profiles;

CREATE POLICY "Admins see org profiles"
  ON profiles FOR SELECT
  USING (organization_id = my_org_id());

CREATE POLICY "Admins manage org profiles"
  ON profiles FOR ALL
  USING (organization_id = my_org_id() AND is_admin());

-- 4. Update EVENTS policies
DROP POLICY IF EXISTS "Admins manage own org events" ON events;

CREATE POLICY "Users view org events"
  ON events FOR SELECT
  USING (organization_id = my_org_id());

CREATE POLICY "Admins insert org events"
  ON events FOR INSERT
  WITH CHECK (organization_id = my_org_id() AND is_admin());

CREATE POLICY "Admins update org events"
  ON events FOR UPDATE
  USING (organization_id = my_org_id() AND is_admin());

CREATE POLICY "Admins delete org events"
  ON events FOR DELETE
  USING (organization_id = my_org_id() AND is_admin());

-- 5. Update MEMBERS policies
DROP POLICY IF EXISTS "Admins manage org members" ON members;

CREATE POLICY "Users view org members"
  ON members FOR SELECT
  USING (organization_id = my_org_id());

CREATE POLICY "Admins insert org members"
  ON members FOR INSERT
  WITH CHECK (organization_id = my_org_id() AND is_admin());

CREATE POLICY "Admins update org members"
  ON members FOR UPDATE
  USING (organization_id = my_org_id() AND is_admin());

CREATE POLICY "Admins delete org members"
  ON members FOR DELETE
  USING (organization_id = my_org_id() AND is_admin());

-- 6. Update DONATIONS policies (Staff should not have access to financial info)
DROP POLICY IF EXISTS "Admins manage org donations" ON donations;

CREATE POLICY "Admins manage org donations"
  ON donations FOR ALL
  USING (organization_id = my_org_id() AND is_admin());

-- 7. Update CAMPAIGNS policies (Staff should not be able to manage comms campaigns)
DROP POLICY IF EXISTS "Admins manage org campaigns" ON campaigns;

CREATE POLICY "Admins manage org campaigns"
  ON campaigns FOR ALL
  USING (organization_id = my_org_id() AND is_admin());

-- 8. Update REGISTRATIONS policies (Staff can view, insert walk-ins, and update/check-in, but cannot delete)
DROP POLICY IF EXISTS "Admins manage org registrations" ON registrations;

CREATE POLICY "Users view org registrations"
  ON registrations FOR SELECT
  USING (organization_id = my_org_id());

CREATE POLICY "Users insert org registrations"
  ON registrations FOR INSERT
  WITH CHECK (organization_id = my_org_id());

CREATE POLICY "Users update org registrations"
  ON registrations FOR UPDATE
  USING (organization_id = my_org_id());

CREATE POLICY "Admins delete org registrations"
  ON registrations FOR DELETE
  USING (organization_id = my_org_id() AND is_admin());
