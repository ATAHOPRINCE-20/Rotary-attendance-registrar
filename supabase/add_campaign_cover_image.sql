-- Add cover_image_url column to donation_campaigns table
ALTER TABLE donation_campaigns ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
