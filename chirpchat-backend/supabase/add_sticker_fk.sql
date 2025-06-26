-- This script adds the foreign key constraint from the 'sticker_id' in the 'messages' table
-- to the 'id' in the 'stickers' table. This relationship is required for the backend
-- to correctly join sticker information with messages.
--
-- Run this script in your Supabase SQL Editor to fix the "Could not find a relationship" error.

ALTER TABLE public.messages
ADD CONSTRAINT messages_sticker_id_fkey FOREIGN KEY (sticker_id)
REFERENCES public.stickers (id) ON DELETE SET NULL;

-- After running this, you may need to refresh the PostgREST schema cache.
-- You can do this by going to the API Docs section in your Supabase dashboard and clicking "Reload schema".
