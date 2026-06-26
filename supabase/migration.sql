-- ============================================================
-- Rotary Connect — Supabase Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. ORGANIZATIONS (tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  logo_url   TEXT,
  district   TEXT,
  country    TEXT,
  website    TEXT,
  buddy_groups TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES (admin users, extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       TEXT,
  role            TEXT NOT NULL DEFAULT 'admin'
                  CHECK (role IN ('super_admin', 'admin', 'staff')),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EVENTS
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  date            TIMESTAMPTZ NOT NULL,
  end_date        TIMESTAMPTZ,
  location        TEXT,
  capacity        INTEGER,
  type            TEXT DEFAULT 'General',
  cover_image_url TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'closed')),
  buddy_groups    TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. REGISTRATIONS (attendees, no auth required)
CREATE TABLE IF NOT EXISTS registrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  is_member         BOOLEAN DEFAULT FALSE,
  club_name         TEXT,
  district          TEXT,
  buddy_group       TEXT,
  occupation        TEXT,
  organization_name TEXT,
  comments          TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'checked-in')),
  qr_ref            TEXT NOT NULL UNIQUE
                    DEFAULT ('ROT-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8))),
  checked_in_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DONATIONS (optional, linked to events/registrations)
CREATE TABLE IF NOT EXISTS donations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  full_name       TEXT,
  email           TEXT,
  amount          DECIMAL(10, 2) NOT NULL,
  currency        TEXT DEFAULT 'UGX',
  category        TEXT,
  payment_method  TEXT,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'failed')),
  receipt_number  TEXT UNIQUE
                  DEFAULT ('DON-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8))),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CAMPAIGNS (communications)
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  audience        TEXT,
  message         TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
  sent_count      INTEGER DEFAULT 0,
  opened_count    INTEGER DEFAULT 0,
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns      ENABLE ROW LEVEL SECURITY;

-- Helper: get current admin's organization_id
CREATE OR REPLACE FUNCTION my_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ORGANIZATIONS
CREATE POLICY "Public read organizations"
  ON organizations FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create orgs"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins update own org"
  ON organizations FOR UPDATE
  USING (id = my_org_id());


-- PROFILES
-- Allow a user to always read their own row (bootstraps my_org_id())
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can also read all profiles in their org
CREATE POLICY "Admins see org profiles"
  ON profiles FOR SELECT
  USING (organization_id = my_org_id());

CREATE POLICY "Admins manage org profiles"
  ON profiles FOR ALL
  USING (organization_id = my_org_id());

-- Allow inserting own profile (needed during signup)
CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- EVENTS
CREATE POLICY "Admins manage own org events"
  ON events FOR ALL
  USING (organization_id = my_org_id());

CREATE POLICY "Public view published events"
  ON events FOR SELECT
  USING (status = 'published');

-- REGISTRATIONS
CREATE POLICY "Admins manage org registrations"
  ON registrations FOR ALL
  USING (organization_id = my_org_id());

CREATE POLICY "Public can self-register"
  ON registrations FOR INSERT
  WITH CHECK (true);

-- Allow attendees to view their own registration by qr_ref (for confirmation page)
CREATE POLICY "Public view own registration"
  ON registrations FOR SELECT
  USING (true);  -- scoped by app logic via qr_ref lookup

-- DONATIONS
CREATE POLICY "Admins manage org donations"
  ON donations FOR ALL
  USING (organization_id = my_org_id());

CREATE POLICY "Public can donate"
  ON donations FOR INSERT
  WITH CHECK (true);

-- CAMPAIGNS
CREATE POLICY "Admins manage org campaigns"
  ON campaigns FOR ALL
  USING (organization_id = my_org_id());

-- ============================================================
-- INDEXES (performance)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_events_org       ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_status    ON events(status);
CREATE INDEX IF NOT EXISTS idx_regs_event       ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_regs_org         ON registrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_regs_qr_ref      ON registrations(qr_ref);
CREATE INDEX IF NOT EXISTS idx_donations_org    ON donations(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org    ON campaigns(organization_id);

-- Migration statement to add buddy_groups to events table and update default currency
ALTER TABLE events ADD COLUMN IF NOT EXISTS buddy_groups TEXT;
ALTER TABLE donations ALTER COLUMN currency SET DEFAULT 'UGX';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS buddy_groups TEXT;

-- ============================================================
-- Rotary Connect — Members Table Migration
-- ============================================================

-- Create MEMBERS table
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

-- Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies
CREATE POLICY "Admins manage org members"
  ON members FOR ALL
  USING (organization_id = my_org_id());

CREATE POLICY "Public read members"
  ON members FOR SELECT
  USING (true);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_members_org ON members(organization_id);
CREATE INDEX IF NOT EXISTS idx_members_org_name ON members(organization_id, full_name);

-- Trigger for updated_at auto-updating
CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update registrations table to support member mapping
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

