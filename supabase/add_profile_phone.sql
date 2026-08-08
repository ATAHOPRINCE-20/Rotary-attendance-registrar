-- Add phone contact column to admin profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
