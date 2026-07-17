-- Add custom Brevo email settings to organizations
ALTER TABLE organizations
ADD COLUMN brevo_api_key text,
ADD COLUMN brevo_sender_email text,
ADD COLUMN brevo_sender_name text;
