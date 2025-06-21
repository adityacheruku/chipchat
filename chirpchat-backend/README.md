# ChirpChat Backend

This directory contains the FastAPI backend for the ChirpChat application.

## Structure

- `app/` - Main application code
- `supabase/` - SQL scripts for database management
  - `schema.sql` - (If you export it) The main database schema
  - `seed_stickers.sql` - Script to populate the database with initial sticker data
- `requirements.txt` - Python dependencies
- `.env.example` - Example environment variables
- `.gitignore` - Git ignore rules
- `README.md` - Project documentation

## Initial Data Seeding

To populate your Supabase database with the default sticker packs, follow these steps:

1.  Navigate to your Supabase project dashboard.
2.  In the left sidebar, click on the **SQL Editor** icon.
3.  Click on **+ New query**.
4.  Copy the entire content of the `supabase/seed_stickers.sql` file from this repository.
5.  Paste the content into the SQL Editor.
6.  Click the **RUN** button.

This will insert the default sticker packs and stickers into your database, making them available in the application.
