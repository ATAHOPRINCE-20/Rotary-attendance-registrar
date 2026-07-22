-- ============================================================
-- Rotary Connect — Prevent IDOR Attacks Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. DROP INSECURE PUBLIC POLICIES
-- These policies allowed anyone with the anon key to read ALL records.
DROP POLICY IF EXISTS "Public read members" ON members;
DROP POLICY IF EXISTS "Public view own registration" ON registrations;

-- (Optional) If there were any other overly broad policies on donations, drop them:
DROP POLICY IF EXISTS "Public read donations" ON donations;

-- 2. CREATE SECURE RPC FOR FETCHING A SINGLE REGISTRATION
-- This allows the confirmation page to fetch a user's own registration
-- ONLY if they know the exact secret qr_ref.
CREATE OR REPLACE FUNCTION get_registration_by_qr(p_qr_ref TEXT)
RETURNS SETOF registrations
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM registrations WHERE qr_ref = p_qr_ref LIMIT 1;
$$;

-- 3. CREATE SECURE RPC FOR FETCHING PUBLIC MEMBER INFO
-- This allows the registration page to auto-suggest member names securely,
-- restricted to a specific organization and EXCLUDING emails/phones.
CREATE OR REPLACE FUNCTION get_public_org_members(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  buddy_group TEXT,
  club_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, full_name, buddy_group, null AS club_name 
  FROM members 
  WHERE organization_id = p_org_id 
  ORDER BY full_name ASC;
$$;

-- 4. CREATE SECURE RPC FOR CHECKING DUPLICATE REGISTRATIONS
-- This allows checking if an email or member is already registered for an event
-- without exposing the whole registrations table.
CREATE OR REPLACE FUNCTION check_duplicate_registration(
  p_event_id UUID,
  p_email TEXT DEFAULT NULL,
  p_member_id UUID DEFAULT NULL,
  p_exclude_qr_ref TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN := FALSE;
BEGIN
  IF p_email IS NOT NULL AND p_email != '' THEN
    SELECT EXISTS (
      SELECT 1 FROM registrations 
      WHERE event_id = p_event_id 
        AND email ILIKE p_email 
        AND (p_exclude_qr_ref IS NULL OR qr_ref != p_exclude_qr_ref)
    ) INTO v_exists;
    
    IF v_exists THEN RETURN TRUE; END IF;
  END IF;

  IF p_member_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM registrations 
      WHERE event_id = p_event_id 
        AND member_id = p_member_id 
        AND (p_exclude_qr_ref IS NULL OR qr_ref != p_exclude_qr_ref)
    ) INTO v_exists;
    
    IF v_exists THEN RETURN TRUE; END IF;
  END IF;

  RETURN FALSE;
END;
$$;
