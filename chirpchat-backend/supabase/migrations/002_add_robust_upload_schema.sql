-- Migration: Adds a robust file upload system with a queue and analytics.

-- Step 1: Create new ENUM types for status and media types.
-- It's best practice to create types before they are referenced.
CREATE TYPE public.media_type_enum AS ENUM ('text', 'image', 'video', 'audio', 'document');
CREATE TYPE public.upload_status_enum AS ENUM ('pending', 'uploading', 'completed', 'failed', 'cancelled');

-- Step 2: Enhance the existing 'messages' table with new columns for media handling.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type public.media_type_enum DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS preview_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_metadata JSONB;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS upload_status public.upload_status_enum DEFAULT 'completed';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;


-- Step 3: Create the new 'upload_queue' table to manage pending uploads.
CREATE TABLE public.upload_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id UUID NOT NULL,
    temp_message_id UUID NOT NULL UNIQUE, -- Reference to optimistic message on the client
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_metadata JSONB DEFAULT '{}',
    upload_priority INTEGER DEFAULT 5,
    status public.upload_status_enum DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_retry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments to the new upload_queue table for clarity
COMMENT ON TABLE public.upload_queue IS 'Manages background file uploads, allowing for retries and prioritization.';
COMMENT ON COLUMN public.upload_queue.temp_message_id IS 'Client-generated ID to link this queue item to the optimistic message in the UI.';
COMMENT ON COLUMN public.upload_queue.status IS 'The current status of the upload in the queue.';
COMMENT ON COLUMN public.upload_queue.scheduled_retry IS 'Timestamp for when the next retry attempt should be made for failed uploads.';

-- Create indexes for performance on the upload_queue table
CREATE INDEX IF NOT EXISTS idx_upload_queue_user_status ON public.upload_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_upload_queue_priority ON public.upload_queue(upload_priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_upload_queue_retry ON public.upload_queue(scheduled_retry) WHERE status = 'failed';


-- Step 4: Create the new 'file_analytics' table for monitoring and performance tracking.
CREATE TABLE public.file_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    upload_started_at TIMESTAMP WITH TIME ZONE,
    upload_completed_at TIMESTAMP WITH TIME ZONE,
    upload_duration_ms INTEGER,
    file_size BIGINT,
    compressed_size BIGINT,
    compression_ratio DECIMAL(5,2),
    network_type TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to the new file_analytics table
COMMENT ON TABLE public.file_analytics IS 'Tracks performance metrics and metadata for each file upload.';
