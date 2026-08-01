-- Migration script to add club officer signature & leadership fields to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS president_name text,
  ADD COLUMN IF NOT EXISTS president_title text DEFAULT 'Impact President',
  ADD COLUMN IF NOT EXISTS president_signature_url text,
  ADD COLUMN IF NOT EXISTS secretary_name text,
  ADD COLUMN IF NOT EXISTS secretary_title text DEFAULT 'Impact Secretary',
  ADD COLUMN IF NOT EXISTS secretary_signature_url text;
