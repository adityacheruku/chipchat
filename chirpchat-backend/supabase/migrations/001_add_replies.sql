-- This migration adds the 'reply_to_message_id' column to the 'messages' table,
-- which is necessary for the message reply functionality to work.
--
-- How to apply this migration:
-- 1. Go to your Supabase project dashboard.
-- 2. In the left sidebar, click on the "SQL Editor" icon.
-- 3. Click "New query" or open an existing query tab.
-- 4. Copy the entire content of this file and paste it into the SQL Editor.
-- 5. Click "Run".
--
-- After running this, your database will be ready for the reply feature.
-- Supabase automatically refreshes its API schema cache, so no server restart is needed.

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID NULL;

-- First, drop the constraint if it exists, to avoid errors on re-running the script.
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS fk_reply_to_message;

-- Then, add the foreign key constraint.
-- This ensures that a reply can only point to a message that actually exists.
-- If the original message is deleted, the reply link will be set to NULL,
-- preventing broken references.
ALTER TABLE public.messages
ADD CONSTRAINT fk_reply_to_message
  FOREIGN KEY(reply_to_message_id) 
  REFERENCES public.messages(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.messages.reply_to_message_id IS 'Stores the ID of the message this message is a reply to.';
