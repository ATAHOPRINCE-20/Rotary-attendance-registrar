-- ============================================================
-- Rotary Connect — Relworx Payments Integration Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Add phone_number column to donations table to track mobile money numbers
ALTER TABLE donations ADD COLUMN IF NOT EXISTS phone_number TEXT;
