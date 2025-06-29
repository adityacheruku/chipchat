-- This script is idempotent, meaning it can be run multiple times without causing errors.
-- It creates the file_analytics table for storing performance metrics on file uploads.

CREATE TABLE IF NOT EXISTS public.file_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    upload_duration_seconds NUMERIC, -- The duration of the upload in seconds.
    file_size_bytes BIGINT, -- Original file size in bytes.
    compressed_size_bytes BIGINT, -- File size after client-side compression, if any.
    network_quality TEXT, -- e.g., 'excellent', 'good', 'poor', 'offline'
    file_type TEXT, -- e.g., 'image', 'video', 'document'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add comments to the columns for clarity in the Supabase dashboard.
COMMENT ON COLUMN public.file_analytics.upload_duration_seconds IS 'The total duration of the file upload in seconds.';
COMMENT ON COLUMN public.file_analytics.file_size_bytes IS 'Original file size in bytes before any client-side compression.';
COMMENT ON COLUMN public.file_analytics.compressed_size_bytes IS 'File size in bytes after client-side compression, just before upload.';
COMMENT ON COLUMN public.file_analytics.network_quality IS 'Network quality reported by the client at the time of upload.';
COMMENT ON COLUMN public.file_analytics.file_type IS 'The type of file uploaded (e.g., image, video, document).';
