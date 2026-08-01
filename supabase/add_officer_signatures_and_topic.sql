-- Migration script to add club officer signature & leadership fields to organizations table, and topic to events table

-- 1. Add officer & leadership columns to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS president_name text,
  ADD COLUMN IF NOT EXISTS president_title text DEFAULT 'Impact President',
  ADD COLUMN IF NOT EXISTS president_signature_url text,
  ADD COLUMN IF NOT EXISTS secretary_name text,
  ADD COLUMN IF NOT EXISTS secretary_title text DEFAULT 'Impact Secretary',
  ADD COLUMN IF NOT EXISTS secretary_signature_url text,
  ADD COLUMN IF NOT EXISTS monthly_theme text,
  ADD COLUMN IF NOT EXISTS monthly_theme_description text,
  ADD COLUMN IF NOT EXISTS monthly_message text;

-- 2. Add topic column to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS topic text;

-- 3. Add board_role column to registrations table
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS board_role text;


