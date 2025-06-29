-- Migration: Reset the file_analytics table.
-- This script will completely remove the existing file_analytics table
-- and recreate it with the correct schema.
-- WARNING: This will delete all data currently in the table.

-- Drop the table if it exists to ensure a clean start.
DROP TABLE IF EXISTS public.file_analytics;

-- Recreate the table with the corrected schema.
CREATE TABLE public.file_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    message_id UUID NOT NULL,
    upload_duration_seconds NUMERIC, -- The duration of the upload in seconds.
    file_size_bytes BIGINT,          -- The original size of the file in bytes.
    compressed_size_bytes BIGINT,    -- The size of the file after any client-side compression, in bytes.
    network_quality TEXT,            -- The network quality reported by the client (e.g., 'excellent', 'poor').
    file_type TEXT,                  -- The type of file uploaded (e.g., 'image', 'video', 'document').
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add comments to the table and columns for clarity in the database schema.
COMMENT ON TABLE public.file_analytics IS 'Stores performance and metadata for file uploads.';
COMMENT ON COLUMN public.file_analytics.upload_duration_seconds IS 'The total time taken for the upload process in seconds.';
COMMENT ON COLUMN public.file_analytics.file_size_bytes IS 'Original file size before any compression.';
COMMENT ON COLUMN public.file_analytics.compressed_size_bytes IS 'File size after client-side compression, if any.';
COMMENT ON COLUMN public.file_analytics.network_quality IS 'Client-reported network quality at the time of upload.';
