-- ============================================================
-- Rotary Connect — Buddy Group of the Day & WhatsApp Integration Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add Buddy Group of the Day column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS buddy_group_of_the_day TEXT;

-- 2. Add WhatsApp integration columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_webhook_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_welcome_template TEXT;

-- 3. Allow public inserts to members table (so unauthenticated registration forms can auto-enroll manual entries in the member directory)
CREATE POLICY "Public insert members"
  ON members FOR INSERT
  WITH CHECK (true);

-- 4. Add is_archived column to events table for soft-deletion (retains registration records in reports)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
