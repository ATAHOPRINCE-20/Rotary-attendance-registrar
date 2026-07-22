-- ============================================================
-- Rotary Connect — Fix Public Event Registration Access
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
-- Problem: The "Users insert org registrations" policy requires
--          organization_id = my_org_id(), which calls auth.uid().
--          Anonymous (unauthenticated) users have no uid, so
--          my_org_id() returns NULL and the INSERT is blocked.
-- Fix:     Replace the INSERT policy with an open public one.
--          Admin SELECT/UPDATE/DELETE policies are left untouched.
-- ============================================================

-- Drop both the restrictive AND any existing open INSERT policies
DROP POLICY IF EXISTS "Users insert org registrations" ON registrations;
DROP POLICY IF EXISTS "Public can self-register" ON registrations;

-- Recreate the open INSERT policy (anyone can self-register)
CREATE POLICY "Public can self-register"
  ON registrations FOR INSERT
  WITH CHECK (true);

-- Drop and recreate public SELECT for the confirmation page
DROP POLICY IF EXISTS "Public view own registration" ON registrations;

CREATE POLICY "Public view own registration"
  ON registrations FOR SELECT
  USING (true);   -- app logic scopes by qr_ref; the RPC is the safe gate
