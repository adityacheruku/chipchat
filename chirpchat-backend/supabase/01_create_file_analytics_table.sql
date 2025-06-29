
-- Create the file_analytics table to store performance metrics for uploads.
-- This table is designed for Supabase and includes Row Level Security (RLS).
CREATE TABLE
  public.file_analytics (
    id uuid NOT NULL DEFAULT gen_random_uuid (),
    user_id uuid NOT NULL,
    message_id uuid NOT NULL,
    upload_duration_seconds double precision NOT NULL,
    file_size_bytes bigint NOT NULL,
    compressed_size_bytes bigint NULL,
    network_quality text NOT NULL,
    file_type text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT file_analytics_pkey PRIMARY KEY (id),
    CONSTRAINT file_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
    CONSTRAINT file_analytics_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages (id) ON DELETE SET NULL
  );

-- Add comments to the table and columns for clarity.
COMMENT ON TABLE public.file_analytics IS 'Stores performance and analytics data for each file upload.';
COMMENT ON COLUMN public.file_analytics.user_id IS 'The user who performed the upload.';
COMMENT ON COLUMN public.file_analytics.message_id IS 'The message associated with this file upload.';
COMMENT ON COLUMN public.file_analytics.upload_duration_seconds IS 'Total time taken for the upload process, including compression and transfer.';
COMMENT ON COLUMN public.file_analytics.file_size_bytes IS 'Original size of the file before any client-side compression.';
COMMENT ON COLUMN public.file_analytics.compressed_size_bytes IS 'Size of the file after client-side compression, just before upload.';
COMMENT ON COLUMN public.file_analytics.network_quality IS 'Network quality detected by the client at the time of upload (e.g., excellent, good, poor).';
COMMENT ON COLUMN public.file_analytics.file_type IS 'The type of file uploaded (e.g., image, video, document).';

-- Enable Row Level Security
ALTER TABLE public.file_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for file_analytics
-- Users cannot see analytics data directly. Only service roles can write to it.
-- This table is for internal analytics and should not be queryable by users.
CREATE POLICY "Allow service_role to do everything" ON public.file_analytics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
