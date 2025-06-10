import type { User, Message, Mood } from '@/types';

export const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'Alice',
    avatar: 'https://placehold.co/100x100.png?text=A',
    mood: 'Happy',
  },
  {
    id: 'user2',
    name: 'Bob',
    avatar: 'https://placehold.co/100x100.png?text=B',
    mood: 'Thoughtful',
  },
  {
    id: 'user3',
    name: 'Charlie',
    avatar: 'https://placehold.co/100x100.png?text=C',
    mood: 'Chilling',
  },
];

const now = Date.now();

export const mockMessages: Message[] = [
  {
    id: 'msg1',
    userId: 'user1',
    text: 'Hey Bob, how are you doing today?',
    timestamp: now - 1000 * 60 * 5, // 5 minutes ago
  },
  {
    id: 'msg2',
    userId: 'user2',
    text: "Hi Alice! I'm doing well, thanks for asking. Just working on a new project.",
    timestamp: now - 1000 * 60 * 4, // 4 minutes ago
  },
  {
    id: 'msg3',
    userId: 'user1',
    text: 'Oh, that sounds exciting! What kind of project?',
    timestamp: now - 1000 * 60 * 3, // 3 minutes ago
  },
  {
    id: 'msg4',
    userId: 'user2',
    text: "It's a chat application, actually. Trying to make something cool and user-friendly.",
    timestamp: now - 1000 * 60 * 2, // 2 minutes ago
  },
  {
    id: 'msg5',
    userId: 'user1',
    text: "That's awesome! Maybe we can brainstorm some ideas later?",
    timestamp: now - 1000 * 60 * 1, // 1 minute ago
  },
  {
    id: 'msg6',
    userId: 'user3',
    text: "Hey everyone, what's up?",
    timestamp: now - 1000 * 30, // 30 seconds ago
  },
];
