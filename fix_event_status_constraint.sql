-- 1. Drop the existing constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;

-- 2. Add the updated constraint including 'pending'
ALTER TABLE events ADD CONSTRAINT events_status_check 
CHECK (status IN ('draft', 'pending', 'published', 'cancelled', 'completed'));
