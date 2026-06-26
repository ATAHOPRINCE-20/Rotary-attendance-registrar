-- ============================================================
-- Rotary Connect — Members Table Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create MEMBERS table
CREATE TABLE IF NOT EXISTS members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  buddy_group     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies
-- Admins can manage (ALL) members in their organization
CREATE POLICY "Admins manage org members"
  ON members FOR ALL
  USING (organization_id = my_org_id());

-- Public can read (SELECT) members of organizations (for registration dropdown auto-complete)
CREATE POLICY "Public read members"
  ON members FOR SELECT
  USING (true);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_members_org ON members(organization_id);
CREATE INDEX IF NOT EXISTS idx_members_org_name ON members(organization_id, full_name);

-- 5. Trigger for updated_at auto-updating
CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Update registrations table to support member mapping (optional but recommended)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;
