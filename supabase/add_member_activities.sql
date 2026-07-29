-- Add visits and makeups JSONB columns to members table for member activity persistence
ALTER TABLE members ADD COLUMN IF NOT EXISTS visits JSONB DEFAULT '[]';
ALTER TABLE members ADD COLUMN IF NOT EXISTS makeups JSONB DEFAULT '[]';

-- Update RLS policies to allow members to view and update their own activity records
DROP POLICY IF EXISTS "Members can update own activities" ON members;
CREATE POLICY "Members can update own activities"
  ON members FOR UPDATE
  USING (auth.uid() = user_id OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
  WITH CHECK (auth.uid() = user_id OR LOWER(email) = LOWER(auth.jwt() ->> 'email'));
