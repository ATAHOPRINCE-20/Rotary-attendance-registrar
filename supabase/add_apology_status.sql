-- Alter status check constraint to support 'apology' status
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_status_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_status_check CHECK (status IN ('pending', 'checked-in', 'apology'));
