
import type { User, Message, Mood } from '@/types';
import { ALL_MOODS as AppMoods } from '@/types';
import { v4 as uuidv4 } from 'uuid'; // For generating UUIDs if needed for new mock items

// Helper to safely pick a mood from the extended list
const getRandomMood = (): Mood => AppMoods[Math.floor(Math.random() * AppMoods.length)];

// Generate UUIDs for mock users
const user1Id = 'a1b2c3d4-e5f6-7890-1234-567890abcdef'; // Example fixed UUID
const user2Id = 'b2c3d4e5-f6a7-8901-2345-67890abcdef0'; // Example fixed UUID

export const mockUsers: User[] = [
  {
    id: user1Id,
    display_name: 'Alice',
    avatar_url: 'https://placehold.co/100x100.png?text=A',
    mood: getRandomMood(),
    phone: '+15551234567',
    'data-ai-hint': 'letter A',
    is_online: true,
    last_seen: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
  },
  {
    id: user2Id,
    display_name: 'Bob',
    avatar_url: 'https://placehold.co/100x100.png?text=B',
    mood: getRandomMood(),
    phone: '+15557654321',
    'data-ai-hint': 'letter B',
    is_online: false,
    last_seen: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
];

const now = new Date();

export const mockMessages: Message[] = [
  {
    id: uuidv4(),
    chat_id: uuidv4(), // Assign a mock chat_id
    user_id: user1Id, // Alice
    text: 'Hey Bob, how are you doing today?',
    created_at: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
    updated_at: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
    reactions: {
      '👍': [user2Id] // Bob reacted
    }
  },
  {
    id: uuidv4(),
    chat_id: mockMessages[0]?.chat_id || uuidv4(), // Use same chat_id
    user_id: user2Id, // Bob
    text: "Hi Alice! I'm doing well, thanks for asking. Just working on a new project.",
    created_at: new Date(now.getTime() - 1000 * 60 * 4).toISOString(),
    updated_at: new Date(now.getTime() - 1000 * 60 * 4).toISOString(),
  },
  {
    id: uuidv4(),
    chat_id: mockMessages[0]?.chat_id || uuidv4(),
    user_id: user1Id, // Alice
    text: 'Oh, that sounds exciting! What kind of project?',
    created_at: new Date(now.getTime() - 1000 * 60 * 3).toISOString(),
    updated_at: new Date(now.getTime() - 1000 * 60 * 3).toISOString(),
    reactions: {
      '😮': [user2Id] // Bob reacted
    }
  },
  {
    id: uuidv4(),
    chat_id: mockMessages[0]?.chat_id || uuidv4(),
    user_id: user2Id, // Bob
    text: "It's a chat application, actually. Trying to make something cool and user-friendly.",
    created_at: new Date(now.getTime() - 1000 * 60 * 2).toISOString(),
    updated_at: new Date(now.getTime() - 1000 * 60 * 2).toISOString(),
    reactions: {
      '❤️': [user1Id] // Alice reacted
    }
  },
  {
    id: uuidv4(),
    chat_id: mockMessages[0]?.chat_id || uuidv4(),
    user_id: user1Id, // Alice
    text: "That's awesome! Maybe we can brainstorm some ideas later?",
    created_at: new Date(now.getTime() - 1000 * 60 * 1).toISOString(),
    updated_at: new Date(now.getTime() - 1000 * 60 * 1).toISOString(),
  },
];

export const ALL_MOODS = AppMoods;
