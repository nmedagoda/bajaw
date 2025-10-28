-- First, delete orphaned votes that reference non-existent performances
DELETE FROM votes
WHERE performance_id NOT IN (SELECT id FROM performances);

-- Drop existing constraint
ALTER TABLE votes
DROP CONSTRAINT IF EXISTS votes_performance_id_fkey;

-- Add foreign key constraint with CASCADE deletion
ALTER TABLE votes
ADD CONSTRAINT votes_performance_id_fkey
FOREIGN KEY (performance_id)
REFERENCES performances(id)
ON DELETE CASCADE;