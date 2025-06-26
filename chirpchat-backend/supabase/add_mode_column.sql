-- This script adds the 'mode' column to the 'messages' table to support different chat modes.
-- It also sets a default value for existing messages.
--
-- To apply this change:
-- 1. Go to your Supabase project dashboard.
-- 2. In the left sidebar, click on the "SQL Editor" icon.
-- 3. Click "+ New query".
-- 4. Paste the entire content of this file into the editor.
-- 5. Click the "RUN" button.

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS mode TEXT CHECK (mode IN ('normal', 'fight', 'incognito')) DEFAULT 'normal';

-- After running this, it is also a good practice to reload the schema cache.
-- In your Supabase dashboard, go to API Docs -> "Reload schema" button at the top.
