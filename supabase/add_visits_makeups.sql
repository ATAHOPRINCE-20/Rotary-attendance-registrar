-- ============================================================
-- Rotary Connect — Add Visits & Make-ups Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Drop existing columns if they were created as text arrays previously
ALTER TABLE registrations DROP COLUMN IF EXISTS visits;
ALTER TABLE registrations DROP COLUMN IF EXISTS makeups;

-- Add visits and makeups JSONB columns to registrations table
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS visits JSONB DEFAULT '[]';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS makeups JSONB DEFAULT '[]';

-- Allow public to self-enroll as members (needed for manual checkin auto-enrollment)
CREATE POLICY "Public can self-enroll as members"
  ON members FOR INSERT
  WITH CHECK (true);


