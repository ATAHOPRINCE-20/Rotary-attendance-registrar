-- ============================================================
-- Rotary Connect — Bulk Fix: Replace Synthetic Emails with Real Member Emails
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. OVERWRITE GENERATED EMAILS (member-% / attendee-%) USING LINKED member_id
UPDATE registrations r
SET email = m.email
FROM members m
WHERE r.member_id = m.id
  AND m.email IS NOT NULL AND m.email != '' AND m.email NOT LIKE 'member-%'
  AND (r.email LIKE 'member-%' OR r.email LIKE 'attendee-%');

-- 2. OVERWRITE GENERATED EMAILS BY MATCHING ATTENDEE FULL NAME WITH MEMBERS ROSTER
UPDATE registrations r
SET 
  email = m.email,
  member_id = m.id,
  is_member = TRUE,
  club_name = NULL,
  district = NULL
FROM members m
WHERE TRIM(LOWER(r.full_name)) = TRIM(LOWER(m.full_name))
  AND m.email IS NOT NULL AND m.email != '' AND m.email NOT LIKE 'member-%'
  AND (r.email LIKE 'member-%' OR r.email LIKE 'attendee-%');

-- 3. CONVERT VISITING ROTARIANS MATCHING CLUB MEMBERS BACK TO HOME CLUB MEMBERS
UPDATE registrations r
SET 
  is_member = TRUE,
  member_id = m.id,
  club_name = NULL,
  district = NULL,
  buddy_group = COALESCE(r.buddy_group, m.buddy_group)
FROM members m
WHERE r.organization_id = m.organization_id 
  AND TRIM(LOWER(r.full_name)) = TRIM(LOWER(m.full_name));

-- 4. NULL OUT REMAINING SYNTHETIC FALLBACK EMAILS FOR MEMBERS WITHOUT AN EMAIL ON FILE
UPDATE registrations
SET email = NULL
WHERE email LIKE 'member-%' OR email LIKE 'attendee-%';
