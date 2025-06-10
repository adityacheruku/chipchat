
export type Mood = "Happy" | "Sad" | "Neutral" | "Excited" | "Thoughtful" | "Chilling";

export const ALL_MOODS: Mood[] = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling"];

// For Phase 3: Emoji Reactions
export type SupportedEmoji = '👍' | '❤️' | '😂' | '😮' | '😢';
export const ALL_SUPPORTED_EMOJIS: SupportedEmoji[] = ['👍', '❤️', '😂', '😮', '😢'];

export interface User {
  id: string;
  name: string;
  avatar: string; // URL to placeholder or data URI
  mood: Mood;
  "data-ai-hint"?: string; // For placeholder images
  isOnline?: boolean; 
  lastSeen?: number; // Timestamp
}

export interface Message {
  id: string;
  userId: string; // Corresponds to User.id
  text: string;
  timestamp: number; // Unix timestamp
  reactions?: Partial<Record<SupportedEmoji, string[]>>; // Emoji -> array of user IDs who reacted.
}

