-- ============================================================
-- Rotary Connect — Donation Campaigns Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create donation_campaigns table
CREATE TABLE IF NOT EXISTS donation_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  goal_amount     DECIMAL(12, 2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE donation_campaigns ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Admins manage donation campaigns" ON donation_campaigns;
CREATE POLICY "Admins manage donation campaigns"
  ON donation_campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = donation_campaigns.organization_id
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Public read active donation campaigns" ON donation_campaigns;
CREATE POLICY "Public read active donation campaigns"
  ON donation_campaigns FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 4. Add campaign_id column to donations table
ALTER TABLE donations ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES donation_campaigns(id) ON DELETE SET NULL;
