-- Drop the existing foreign key constraint
ALTER TABLE votes
DROP CONSTRAINT IF EXISTS votes_performance_id_fkey;

-- Add foreign key constraint to reference uploaded_songs instead of performances
ALTER TABLE votes
ADD CONSTRAINT votes_performance_id_fkey
FOREIGN KEY (performance_id)
REFERENCES uploaded_songs(id)
ON DELETE CASCADE;