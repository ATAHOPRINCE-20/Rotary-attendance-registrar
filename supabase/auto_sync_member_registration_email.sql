-- ============================================================
-- Rotary Connect — Auto-Sync Member Email & Phone on Registration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. DROP NOT NULL CONSTRAINT ON REGISTRATIONS.EMAIL TO ALLOW OPTIONAL EMAILS
ALTER TABLE registrations ALTER COLUMN email DROP NOT NULL;

-- 2. UPDATE get_public_org_members RPC TO INCLUDE EMAIL AND PHONE FOR ROSTER PRE-FILL
DROP FUNCTION IF EXISTS get_public_org_members(UUID);

CREATE OR REPLACE FUNCTION get_public_org_members(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  buddy_group TEXT,
  email TEXT,
  phone TEXT,
  club_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, full_name, buddy_group, email, phone, null AS club_name 
  FROM members 
  WHERE organization_id = p_org_id 
  ORDER BY full_name ASC;
$$;

-- 3. TRIGGER FUNCTION TO SYNC REAL MEMBER EMAIL AND PHONE ON INSERT/UPDATE
CREATE OR REPLACE FUNCTION sync_registration_member_contact()
RETURNS TRIGGER AS $$
DECLARE
  v_member_id UUID;
  v_member_email TEXT;
  v_member_phone TEXT;
BEGIN
  -- If member_id is not passed, match by organization_id and full_name
  IF NEW.member_id IS NULL AND NEW.full_name IS NOT NULL THEN
    SELECT id, email, phone INTO v_member_id, v_member_email, v_member_phone
    FROM members
    WHERE organization_id = NEW.organization_id
      AND LOWER(TRIM(full_name)) = LOWER(TRIM(NEW.full_name))
    LIMIT 1;

    IF v_member_id IS NOT NULL THEN
      NEW.member_id := v_member_id;
      NEW.is_member := TRUE;
      NEW.club_name := NULL;
    END IF;
  END IF;

  IF NEW.member_id IS NOT NULL THEN
    SELECT email, phone INTO v_member_email, v_member_phone
    FROM members
    WHERE id = NEW.member_id;

    -- Always sync real email if member profile has an email address
    IF v_member_email IS NOT NULL AND v_member_email != '' AND v_member_email NOT LIKE 'member-%' THEN
      NEW.email := v_member_email;
    ELSIF NEW.email LIKE 'member-%' OR NEW.email LIKE 'attendee-%' THEN
      NEW.email := NULL;
    END IF;

    -- Always sync real phone if member profile has a phone number
    IF v_member_phone IS NOT NULL AND v_member_phone != '' THEN
      IF NEW.phone IS NULL OR NEW.phone = '' OR NEW.phone NOT LIKE '+%' THEN
        NEW.phone := v_member_phone;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_registration_member_contact ON registrations;
CREATE TRIGGER trg_sync_registration_member_contact
  BEFORE INSERT OR UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION sync_registration_member_contact();

-- 4. RETROACTIVE BACKFILL FOR ALL REGISTRATIONS WITH MATCHED MEMBERS
UPDATE registrations r
SET 
  member_id = m.id,
  is_member = TRUE,
  club_name = NULL,
  email = CASE 
    WHEN m.email IS NOT NULL AND m.email != '' AND m.email NOT LIKE 'member-%' THEN m.email
    ELSE NULL
  END,
  phone = COALESCE(NULLIF(r.phone, ''), m.phone)
FROM members m
WHERE (r.member_id = m.id OR (r.organization_id = m.organization_id AND LOWER(TRIM(r.full_name)) = LOWER(TRIM(m.full_name))));

UPDATE registrations
SET email = NULL
WHERE email LIKE 'member-%' OR email LIKE 'attendee-%';
