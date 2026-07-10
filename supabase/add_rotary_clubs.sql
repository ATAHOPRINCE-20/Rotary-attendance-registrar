-- ============================================================
-- Rotary Connect — Rotary Clubs Database Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create ROTARY_CLUBS table
CREATE TABLE IF NOT EXISTS rotary_clubs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  district    TEXT NOT NULL,
  area        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE rotary_clubs ENABLE ROW LEVEL SECURITY;

-- Public Select Policy (needed for anyone registering for events)
DROP POLICY IF EXISTS "Public read rotary_clubs" ON rotary_clubs;
CREATE POLICY "Public read rotary_clubs"
  ON rotary_clubs FOR SELECT
  USING (true);

-- Admin Manage Policy
DROP POLICY IF EXISTS "Admins manage rotary_clubs" ON rotary_clubs;
CREATE POLICY "Admins manage rotary_clubs"
  ON rotary_clubs FOR ALL
  USING (true);

-- 2. Seed Ugandan Rotary Clubs
INSERT INTO rotary_clubs (name, district, area) VALUES
  -- AREA A: KAMPALA CENTRAL & METROPOLITAN REGION
  ('Rotary Club of Kampala', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala Central', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala South', '9214', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala North', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala East', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala West', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala Ssese Islands', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala Impala', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala Day Break', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kampala 7 Hills', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kololo', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Bugolobi', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Bugolobi Morningtide', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kiwatule', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Muyenga', '9214', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Muyenga Sunday Sunset', '9214', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Sunrise Kampala', '9214', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Kitante', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Gaba', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Mengo', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Rubaga', '9213', 'Kampala Central & Metropolitan Region'),
  ('Rotary Club of Nsambya', '9214', 'Kampala Central & Metropolitan Region'),

  -- AREA B: KIRA, WAKISO & MUKONO CORRIDOR
  ('Rotary Club of Mukono', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Mukono Central', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Nsasa', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Sonde', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Bulindo', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Ntinda', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary E-Club of Ntinda', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Kulambiro', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Bukoto', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Najjeera', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Gayaza', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Kasangati', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Buloba', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Nansana', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Bweyogerere Namboole', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotary Club of Wobulenzi', '9213', 'Kira, Wakiso & Mukono Corridor'),

  -- AREA C: ENTEBBE ROAD & WAKISO SOUTH CORRIDOR
  ('Rotary Club of Lubowa', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Akright City', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Kajjansi', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Kigo', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Bwebajja', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Nsangi', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Kyengera', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Nkumba', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Entebbe', '9214', 'Entebbe Road & Wakiso South Corridor'),
  ('Rotary Club of Kisugu Victoria View', '9214', 'Entebbe Road & Wakiso South Corridor'),

  -- AREA D: EASTERN UGANDA REGION
  ('Rotary Club of Jinja', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Jinja City', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Jinja Metro', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Source of the Nile', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Njeru', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Iganga', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Bugiri', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Busia', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Tororo', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Mbale', '9213', 'Eastern Uganda Region'),
  ('Rotary Club of Mbale Metropolitan', '9213', 'Eastern Uganda Region'),

  -- AREA E: WESTERN & SOUTH-WESTERN UGANDA REGION
  ('Rotary Club of Mbarara', '9214', 'Western & South-Western Uganda Region'),
  ('Rotary Club of Igoma', '9214', 'Western & South-Western Uganda Region'),
  ('Rotary Club of Kabale', '9214', 'Western & South-Western Uganda Region'),
  ('Rotary Club of Fort Portal', '9213', 'Western & South-Western Uganda Region'),
  ('Rotary Club of Masindi', '9213', 'Western & South-Western Uganda Region'),
  ('Rotary Club of Hoima', '9213', 'Western & South-Western Uganda Region'),
  ('Rotary Club of Mityana', '9213', 'Western & South-Western Uganda Region'),

  -- AREA F: NORTHERN & WEST NILE REGION
  ('Rotary Club of Gulu', '9213', 'Northern & West Nile Region'),
  ('Rotary Club of Gulu City', '9213', 'Northern & West Nile Region'),
  ('Rotary Club of Arua', '9213', 'Northern & West Nile Region'),
  ('Rotary Club of Arua Eco City', '9213', 'Northern & West Nile Region'),
  ('Rotary Club of Yumbe', '9213', 'Northern & West Nile Region'),
  ('Rotary Club of Lira', '9213', 'Northern & West Nile Region'),
  ('Rotary Club of Adjumani', '9213', 'Northern & West Nile Region'),
  ('Rotary Club of Abim', '9213', 'Northern & West Nile Region'),

  -- AREA G: DIGITAL & GLOBAL SPACE
  ('Rotary E-Club of Uganda Global', '9213', 'Digital & Global Space'),

  -- ROTARACT CLUBS DIRECTORY (District 9213 & 9214)
  -- University & Institutional Clubs (Campus-Based)
  ('Rotaract Club of Makerere University (MUK)', '9213', 'University & Institutional Clubs'),
  ('Rotaract Club of Kampala International University (KIU)', '9213', 'University & Institutional Clubs'),
  ('Rotaract Club of Kyambogo University (KYU)', '9213', 'University & Institutional Clubs'),
  ('Rotaract Club of Makerere University Business School (MUBS)', '9213', 'University & Institutional Clubs'),
  ('Rotaract Club of Uganda Christian University (UCU Mukono)', '9213', 'University & Institutional Clubs'),
  ('Rotaract Club of Mbarara University of Science and Technology (MUST)', '9214', 'University & Institutional Clubs'),
  ('Rotaract Club of Gulu University', '9213', 'University & Institutional Clubs'),
  ('Rotaract Club of Busitema University', '9213', 'University & Institutional Clubs'),
  ('Rotaract Club of Nkumba University', '9214', 'University & Institutional Clubs'),
  ('Rotaract Club of International University of East Africa (IUEA)', '9213', 'University & Institutional Clubs'),
  ('Rotaract Club of Ndejje University', '9213', 'University & Institutional Clubs'),

  -- Kampala Metropolitan Community Clubs
  ('Rotaract Club of Kampala Central', '9213', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Kampala South', '9214', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Kampala City Vibrant', '9213', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Kololo', '9213', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Bugolobi', '9213', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Bukoto', '9213', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Ntinda', '9213', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Muyenga', '9214', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Makindye', '9214', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Rubaga', '9213', 'Kampala Metropolitan Community Clubs'),
  ('Rotaract Club of Mengo', '9213', 'Kampala Metropolitan Community Clubs'),

  -- Kira, Wakiso & Mukono Corridor
  ('Rotaract Club of Kira', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotaract Club of Mukono Central', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotaract Club of Nsasa', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotaract Club of Sonde', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotaract Club of Bulindo', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotaract Club of Najjeera', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotaract Club of Gayaza', '9213', 'Kira, Wakiso & Mukono Corridor'),
  ('Rotaract Club of Bweyogerere', '9213', 'Kira, Wakiso & Mukono Corridor'),

  -- Eastern Uganda Region
  ('Rotaract Club of Jinja', '9213', 'Eastern Uganda Region'),
  ('Rotaract Club of Jinja City', '9213', 'Eastern Uganda Region'),
  ('Rotaract Club of Source of the Nile', '9213', 'Eastern Uganda Region'),
  ('Rotaract Club of Mbale', '9213', 'Eastern Uganda Region'),
  ('Rotaract Club of Tororo', '9213', 'Eastern Uganda Region'),
  ('Rotaract Club of Iganga', '9213', 'Eastern Uganda Region'),

  -- Western & Northern Uganda Region
  ('Rotaract Club of Mbarara', '9214', 'Western & Northern Uganda Region'),
  ('Rotaract Club of Kabale', '9214', 'Western & Northern Uganda Region'),
  ('Rotaract Club of Fort Portal', '9213', 'Western & Northern Uganda Region'),
  ('Rotaract Club of Gulu', '9213', 'Western & Northern Uganda Region'),
  ('Rotaract Club of Lira', '9213', 'Western & Northern Uganda Region'),
  ('Rotaract Club of Arua', '9213', 'Western & Northern Uganda Region')
ON CONFLICT (name) DO UPDATE SET
  district = EXCLUDED.district,
  area = EXCLUDED.area;
