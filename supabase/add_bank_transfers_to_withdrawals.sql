-- ADD BANK TRANSFER COLUMNS TO WITHDRAWALS TABLE
ALTER TABLE withdrawals 
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'mobile_money' CHECK (payout_method IN ('mobile_money', 'bank_transfer')),
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS validation_reference TEXT,
  ADD COLUMN IF NOT EXISTS charge_amount DECIMAL(10, 2);

-- Index for searching validation references
CREATE INDEX IF NOT EXISTS idx_withdrawals_val_ref ON withdrawals(validation_reference);
