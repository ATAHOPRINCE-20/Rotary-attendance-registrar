-- ============================================================
-- Rotary Connect — Add email column to profiles table
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
