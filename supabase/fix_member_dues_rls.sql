-- ============================================================
-- Rotary Connect — Fix Member Dues RLS & Linking
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Ensure RLS policies for member_dues_balances allow members to view their dues
--    by user_id OR email matching auth.email()
DROP POLICY IF EXISTS "Members view own dues balances" ON member_dues_balances;
CREATE POLICY "Members view own dues balances" ON member_dues_balances
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
    )
  );

-- 2. Allow Admins and Treasurers to manage (INSERT/UPDATE/DELETE) member_dues_balances
DROP POLICY IF EXISTS "Admins manage dues balances" ON member_dues_balances;
CREATE POLICY "Admins manage dues balances" ON member_dues_balances
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin', 'treasurer')
    )
  );

-- 3. Ensure RLS policies for dues_categories allow members to view categories
DROP POLICY IF EXISTS "Members view dues categories" ON dues_categories;
CREATE POLICY "Members view dues categories" ON dues_categories
  FOR SELECT TO authenticated
  USING (true);

-- 4. Allow Admins and Treasurers to manage dues_categories
DROP POLICY IF EXISTS "Admins manage dues categories" ON dues_categories;
CREATE POLICY "Admins manage dues categories" ON dues_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin', 'treasurer')
    )
  );
