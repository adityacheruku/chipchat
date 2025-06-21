-- This script seeds the database with initial sticker packs and stickers.
-- It's designed to be idempotent - it will not create duplicate data if run multiple times.

-- Pack UUIDs (replace with your own if needed, but keep consistent)
-- Emotion Pack: a1b2c3d4-0001-4001-8001-000000000001
-- Relationship Pack: a1b2c3d4-0002-4002-8002-000000000002
-- Daily Life Pack: a1b2c3d4-0003-4003-8003-000000000003
-- Animal Pack: a1b2c3d4-0004-4004-8004-000000000004
-- Reaction Pack: a1b2c3d4-0005-4005-8005-000000000005

DO $$
DECLARE
    emotion_pack_id UUID := 'a1b2c3d4-0001-4001-8001-000000000001';
    relationship_pack_id UUID := 'a1b2c3d4-0002-4002-8002-000000000002';
    daily_life_pack_id UUID := 'a1b2c3d4-0003-4003-8003-000000000003';
    animal_pack_id UUID := 'a1b2c3d4-0004-4004-8004-000000000004';
    reaction_pack_id UUID := 'a1b2c3d4-0005-4005-8005-000000000005';
BEGIN

-- Insert Sticker Packs
INSERT INTO sticker_packs (id, name, description, thumbnail_url) VALUES
(emotion_pack_id, 'Emotions', 'Express how you feel.', 'https://placehold.co/64x64/F9F5A2/333?text=😊'),
(relationship_pack_id, 'Couples', 'For you and your special someone.', 'https://placehold.co/64x64/FFB6C1/333?text=❤️'),
(daily_life_pack_id, 'Daily Life', 'Stickers for everyday moments.', 'https://placehold.co/64x64/A2C4F9/333?text=☀️'),
(animal_pack_id, 'Cute Animals', 'Furry friends to share.', 'https://placehold.co/64x64/BCA2F9/333?text=🐶'),
(reaction_pack_id, 'Reactions', 'Quick responses for any message.', 'https://placehold.co/64x64/A2F9D5/333?text=👍')
ON CONFLICT (id) DO NOTHING;

-- Delete existing stickers for these packs to ensure a clean slate on re-run
DELETE FROM stickers WHERE pack_id IN (emotion_pack_id, relationship_pack_id, daily_life_pack_id, animal_pack_id, reaction_pack_id);

-- Insert Stickers for Emotion Pack
INSERT INTO stickers (pack_id, name, image_url, tags) VALUES
(emotion_pack_id, 'Happy', 'https://placehold.co/128x128/FFF5BB/333?text=😄', ARRAY['happy', 'joy', 'smile']),
(emotion_pack_id, 'Sad', 'https://placehold.co/128x128/C7DFFF/333?text=😢', ARRAY['sad', 'cry', 'upset']),
(emotion_pack_id, 'Love', 'https://placehold.co/128x128/FFD1D1/333?text=😍', ARRAY['love', 'heart', 'adore']),
(emotion_pack_id, 'Angry', 'https://placehold.co/128x128/FFC8C8/333?text=😠', ARRAY['angry', 'mad', 'furious']),
(emotion_pack_id, 'Surprised', 'https://placehold.co/128x128/C4F5C4/333?text=😮', ARRAY['surprised', 'shocked', 'wow']),
(emotion_pack_id, 'Confused', 'https://placehold.co/128x128/E0E0E0/333?text=🤔', ARRAY['confused', 'thinking', 'hmm']);

-- Insert Stickers for Relationship Pack
INSERT INTO stickers (pack_id, name, image_url, tags) VALUES
(relationship_pack_id, 'Holding Hands', 'https://placehold.co/128x128/FFB6C1/333?text=🤝', ARRAY['couple', 'love', 'together']),
(relationship_pack_id, 'Kiss', 'https://placehold.co/128x128/FFB6C1/333?text=😘', ARRAY['kiss', 'love', 'romance']),
(relationship_pack_id, 'Thinking of You', 'https://placehold.co/128x128/FFB6C1/333?text=💭❤️', ARRAY['thinking', 'love', 'miss you']),
(relationship_pack_id, 'Movie Night', 'https://placehold.co/128x128/D8BFD8/333?text=🍿', ARRAY['date', 'movie', 'chill']),
(relationship_pack_id, 'I Love You', 'https://placehold.co/128x128/FF69B4/333?text=ILY', ARRAY['i love you', 'confession']),
(relationship_pack_id, 'Sorry', 'https://placehold.co/128x128/ADD8E6/333?text=Sorry', ARRAY['apology', 'forgive me']);

-- Insert Stickers for Daily Life Pack
INSERT INTO stickers (pack_id, name, image_url, tags) VALUES
(daily_life_pack_id, 'Good Morning', 'https://placehold.co/128x128/FFFACD/333?text=☀️', ARRAY['good morning', 'gm', 'sunrise']),
(daily_life_pack_id, 'Good Night', 'https://placehold.co/128x128/483D8B/eee?text=🌙', ARRAY['good night', 'gn', 'sleep']),
(daily_life_pack_id, 'Working', 'https://placehold.co/128x128/B0C4DE/333?text=💻', ARRAY['work', 'busy', 'typing']),
(daily_life_pack_id, 'Eating', 'https://placehold.co/128x128/98FB98/333?text=🍕', ARRAY['food', 'lunch', 'dinner']),
(daily_life_pack_id, 'On my way', 'https://placehold.co/128x128/F0E68C/333?text=🚗', ARRAY['omw', 'driving', 'travel']);

-- Insert Stickers for Animal Pack
INSERT INTO stickers (pack_id, name, image_url, tags) VALUES
(animal_pack_id, 'Happy Dog', 'https://placehold.co/128x128/DEB887/333?text=🐶', ARRAY['dog', 'happy', 'cute']),
(animal_pack_id, 'Grumpy Cat', 'https://placehold.co/128x128/D3D3D3/333?text=😼', ARRAY['cat', 'grumpy', 'annoyed']),
(animal_pack_id, 'Sleepy Panda', 'https://placehold.co/128x128/F5F5F5/333?text=🐼', ARRAY['panda', 'sleepy', 'tired']),
(animal_pack_id, 'Playful Otter', 'https://placehold.co/128x128/CD853F/333?text=🦦', ARRAY['otter', 'playful', 'cute']),
(animal_pack_id, 'Blushing Bunny', 'https://placehold.co/128x128/FFF0F5/333?text=🐰', ARRAY['bunny', 'shy', 'blush']);

-- Insert Stickers for Reaction Pack
INSERT INTO stickers (pack_id, name, image_url, tags) VALUES
(reaction_pack_id, 'Thumbs Up', 'https://placehold.co/128x128/90EE90/333?text=👍', ARRAY['ok', 'sounds good', 'agree']),
(reaction_pack_id, 'Clapping', 'https://placehold.co/128x128/FFFFE0/333?text=👏', ARRAY['congrats', 'well done', 'bravo']),
(reaction_pack_id, 'Heart Eyes', 'https://placehold.co/128x128/FFC0CB/333?text=😍', ARRAY['love it', 'amazing', 'wow']),
(reaction_pack_id, 'Facepalm', 'https://placehold.co/128x128/DCDCDC/333?text=🤦', ARRAY['facepalm', 'oh no', 'smh']),
(reaction_pack_id, 'Celebrate', 'https://placehold.co/128x128/FFD700/333?text=🎉', ARRAY['celebrate', 'party', 'hooray']);

END $$;
