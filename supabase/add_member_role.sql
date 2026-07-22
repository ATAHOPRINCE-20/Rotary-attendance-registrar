-- ============================================================
-- Rotary Connect — Add 'member' to Profiles Role Constraint
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'treasurer', 'staff', 'member'));
