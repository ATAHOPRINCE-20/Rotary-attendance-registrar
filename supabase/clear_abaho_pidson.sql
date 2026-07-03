-- =========================================================================
-- Rotary Connect — Target Database Cleanup (ROTARY CLUB OF NTINDA)
-- Admin: Abaho Pidson (Pidson Abaho)
-- Organization ID: 8cb26653-ff84-4dfc-a085-c89ccd544ff9
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- =========================================================================

-- WARNING: These actions are destructive! Please backup your data if needed.

-- 1. Clear donations for this organization
DELETE FROM donations 
WHERE organization_id = '8cb26653-ff84-4dfc-a085-c89ccd544ff9';

-- 2. Clear campaigns for this organization
DELETE FROM campaigns 
WHERE organization_id = '8cb26653-ff84-4dfc-a085-c89ccd544ff9';

-- 3. Clear registrations (attendees) for this organization
DELETE FROM registrations 
WHERE organization_id = '8cb26653-ff84-4dfc-a085-c89ccd544ff9';

-- 4. Clear events for this organization
DELETE FROM events 
WHERE organization_id = '8cb26653-ff84-4dfc-a085-c89ccd544ff9';
