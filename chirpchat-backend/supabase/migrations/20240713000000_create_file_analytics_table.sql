-- Create the file_analytics table if it doesn't already exist.
-- This script is idempotent and can be run multiple times safely.

CREATE TABLE IF NOT EXISTS file_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    upload_duration_seconds REAL,
    file_size_bytes BIGINT,
    compressed_size_bytes BIGINT,
    network_quality TEXT,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE file_analytics IS 'Stores performance metrics for file uploads.';
COMMENT ON COLUMN file_analytics.upload_duration_seconds IS 'Total time from starting upload process to completion, in seconds.';
COMMENT ON COLUMN file_analytics.file_size_bytes IS 'Original size of the file before any client-side compression.';
COMMENT ON COLUMN file_analytics.compressed_size_bytes IS 'Size of the file after client-side compression, which was actually uploaded.';
COMMENT ON COLUMN file_analytics.network_quality IS 'Network quality detected at the time of upload (e.g., excellent, good, poor).';
COMMENT ON COLUMN file_analytics.file_type IS 'The subtype of the message (e.g., image, video, document).';
