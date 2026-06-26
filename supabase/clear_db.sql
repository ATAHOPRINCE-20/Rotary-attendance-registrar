-- ============================================================
-- Rotary Connect — Database Cleanup Script
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- WARNING: These actions are destructive! Please backup your data if needed.

-- ============================================================
-- OPTION A: Clean Transaction Data (Recommended)
-- Wipes all events, registrations, donations, and campaigns.
-- Keeps your Organization settings and Admin/Staff accounts intact.
-- ============================================================

-- Clean donations
TRUNCATE TABLE donations CASCADE;

-- Clean registrations (attendees)
TRUNCATE TABLE registrations CASCADE;

-- Clean campaigns (comms)
TRUNCATE TABLE campaigns CASCADE;

-- Clean events
TRUNCATE TABLE events CASCADE;


-- ============================================================
-- OPTION B: Total Wipeout (Nuclear Option)
-- Deletes absolutely everything, including clubs (organizations) 
-- and admin profiles. Note: Auth users must be cleared from the 
-- Supabase Auth dashboard separately.
-- ============================================================

/*
-- Uncomment the statements below to perform a total database wipeout:

TRUNCATE TABLE donations CASCADE;
TRUNCATE TABLE registrations CASCADE;
TRUNCATE TABLE campaigns CASCADE;
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE organizations CASCADE;
*/
