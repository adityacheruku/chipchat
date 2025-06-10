
import type { User, Message, Mood } from '@/types';
import { ALL_MOODS as AppMoods } from '@/types'; // Use the extended ALL_MOODS

// Helper to safely pick a mood from the extended list
const getRandomMood = (): Mood => AppMoods[Math.floor(Math.random() * AppMoods.length)];

export const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'Alice',
    avatar: 'https://placehold.co/100x100.png?text=A',
    mood: getRandomMood(),
    phone: '+15551234567',
    'data-ai-hint': 'letter A',
    isOnline: true,
    lastSeen: Date.now() - 1000 * 60 * 1,
  },
  {
    id: 'user2',
    name: 'Bob',
    avatar: 'https://placehold.co/100x100.png?text=B',
    mood: getRandomMood(),
    phone: '+15557654321',
    'data-ai-hint': 'letter B',
    isOnline: true,
    lastSeen: Date.now() - 1000 * 60 * 2,
  },
];

const now = Date.now();

export const mockMessages: Message[] = [
  {
    id: 'msg1',
    userId: 'user1', // Alice
    text: 'Hey Bob, how are you doing today?',
    timestamp: now - 1000 * 60 * 5,
    reactions: {
      '👍': ['user2'] // Bob reacted
    }
  },
  {
    id: 'msg2',
    userId: 'user2', // Bob
    text: "Hi Alice! I'm doing well, thanks for asking. Just working on a new project.",
    timestamp: now - 1000 * 60 * 4,
  },
  {
    id: 'msg3',
    userId: 'user1', // Alice
    text: 'Oh, that sounds exciting! What kind of project?',
    timestamp: now - 1000 * 60 * 3,
    reactions: {
      '😮': ['user2'] // Bob reacted
    }
  },
  {
    id: 'msg4',
    userId: 'user2', // Bob
    text: "It's a chat application, actually. Trying to make something cool and user-friendly.",
    timestamp: now - 1000 * 60 * 2,
    reactions: {
      '❤️': ['user1'] // Alice reacted
    }
  },
  {
    id: 'msg5',
    userId: 'user1', // Alice
    text: "That's awesome! Maybe we can brainstorm some ideas later?",
    timestamp: now - 1000 * 60 * 1,
  },
];

// Export ALL_MOODS from here as well if it's used by other parts of the app that import from mock-data
export const ALL_MOODS = AppMoods;
