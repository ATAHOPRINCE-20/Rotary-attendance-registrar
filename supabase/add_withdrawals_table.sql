-- CREATE WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS withdrawals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount          DECIMAL(10, 2) NOT NULL,
  currency        TEXT DEFAULT 'UGX',
  recipient_phone TEXT NOT NULL,
  recipient_name  TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  reference       TEXT UNIQUE DEFAULT ('WITH-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8))),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins manage organization's withdrawals
CREATE POLICY "Admins manage org withdrawals"
  ON withdrawals FOR ALL
  USING (organization_id = my_org_id());

-- Index for organization_id performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_org ON withdrawals(organization_id);
