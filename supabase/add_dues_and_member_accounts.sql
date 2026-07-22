-- ============================================================
-- Rotary Connect — Dues & Member Accounts Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Alter MEMBERS table to link to Auth.Users
ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);

-- 2. Create DUES_CATEGORIES table
CREATE TABLE IF NOT EXISTS dues_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('one-off', 'monthly', 'quarterly', 'annually')),
  default_amount  DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'UGX',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for dues_categories
ALTER TABLE dues_categories ENABLE ROW LEVEL SECURITY;

-- 3. Create MEMBER_DUES_BALANCES table
CREATE TABLE IF NOT EXISTS member_dues_balances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  dues_category_id UUID NOT NULL REFERENCES dues_categories(id) ON DELETE CASCADE,
  amount_due       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_paid      DECIMAL(12, 2) NOT NULL DEFAULT 0,
  due_date         TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for member_dues_balances
ALTER TABLE member_dues_balances ENABLE ROW LEVEL SECURITY;

-- 4. Create MEMBER_LOGIN_OTPS table (temp storage for phone/email OTP fallback)
CREATE TABLE IF NOT EXISTS member_login_otps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT,
  email           TEXT,
  otp_code        TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for member_login_otps (Only service role or specific triggers handle this)
ALTER TABLE member_login_otps ENABLE ROW LEVEL SECURITY;

-- 5. Modify DONATIONS (dues payments) to support member & category mapping
ALTER TABLE donations ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS dues_category_id UUID REFERENCES dues_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_donations_member ON donations(member_id);
CREATE INDEX IF NOT EXISTS idx_donations_dues_cat ON donations(dues_category_id);

-- 6. Row Level Security (RLS) Policies

-- Members Policies
DROP POLICY IF EXISTS "Members view own row" ON members;
CREATE POLICY "Members view own row" ON members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Dues Categories Policies
DROP POLICY IF EXISTS "Admins manage dues categories" ON dues_categories;
CREATE POLICY "Admins manage dues categories" ON dues_categories
  FOR ALL TO authenticated
  USING (organization_id = my_org_id());

DROP POLICY IF EXISTS "Members view dues categories" ON dues_categories;
CREATE POLICY "Members view dues categories" ON dues_categories
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Member Dues Balances Policies
DROP POLICY IF EXISTS "Admins manage dues balances" ON member_dues_balances;
CREATE POLICY "Admins manage dues balances" ON member_dues_balances
  FOR ALL TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE organization_id = my_org_id()
    )
  );

DROP POLICY IF EXISTS "Members view own dues balances" ON member_dues_balances;
CREATE POLICY "Members view own dues balances" ON member_dues_balances
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Donations (Dues payments) Policies
DROP POLICY IF EXISTS "Members view own dues payments" ON donations;
CREATE POLICY "Members view own dues payments" ON donations
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members insert own dues payments" ON donations;
CREATE POLICY "Members insert own dues payments" ON donations
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- 7. Trigger to automatically link auth.users to members based on email match
CREATE OR REPLACE FUNCTION link_member_on_auth_signup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.members
  SET user_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email)
  AND user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_link_member ON auth.users;
CREATE TRIGGER on_auth_user_created_link_member
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION link_member_on_auth_signup();

-- 8. Auto-updating trigger for member_dues_balances
CREATE TRIGGER member_dues_balances_updated_at
  BEFORE UPDATE ON member_dues_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 9. Trigger to auto-update dues balance when donation/payment is completed
CREATE OR REPLACE FUNCTION update_member_due_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status <> 'completed') THEN
    
    IF NEW.member_id IS NOT NULL AND NEW.dues_category_id IS NOT NULL THEN
      UPDATE member_dues_balances
      SET amount_paid = amount_paid + NEW.amount,
          status = CASE 
            WHEN amount_paid + NEW.amount >= amount_due THEN 'paid'
            WHEN amount_paid + NEW.amount > 0 THEN 'partially_paid'
            ELSE 'unpaid'
          END,
          updated_at = NOW()
      WHERE member_id = NEW.member_id 
      AND dues_category_id = NEW.dues_category_id;
    END IF;
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_member_due_balance_on_payment ON donations;
CREATE TRIGGER trg_update_member_due_balance_on_payment
  AFTER INSERT OR UPDATE OF status ON donations
  FOR EACH ROW
  EXECUTE FUNCTION update_member_due_balance_on_payment();

