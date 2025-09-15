-- Check current table definition to see constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'uploaded_songs' AND column_name IN ('recorded_file_type', 'original_file_type');

-- Also check if there are any check constraints
\d+ uploaded_songs;