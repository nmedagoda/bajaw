-- Fix the check constraint to allow 'webm' file type for recorded files
-- First let's see what the current constraint allows
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%uploaded_songs%';