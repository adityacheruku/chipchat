-- This script corrects the column name and type in the file_analytics table
-- to match the application code, changing 'upload_duration' (INTERVAL)
-- to 'upload_duration_seconds' (NUMERIC).
-- It is safe to run this script multiple times.

-- Add the correct column if it doesn't exist
ALTER TABLE public.file_analytics
ADD COLUMN IF NOT EXISTS upload_duration_seconds NUMERIC;

-- Drop the incorrect old column if it exists
ALTER TABLE public.file_analytics
DROP COLUMN IF EXISTS upload_duration;

-- Add a comment to the new column for clarity.
COMMENT ON COLUMN public.file_analytics.upload_duration_seconds IS 'The total duration of the file upload in seconds.';

