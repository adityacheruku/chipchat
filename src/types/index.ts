
export type Mood = "Happy" | "Sad" | "Neutral" | "Excited" | "Thoughtful" | "Chilling" | "Angry" | "Anxious" | "Content";

// Extended ALL_MOODS to include more nuanced moods the AI might suggest.
// Ensure these are reasonable and manageable for the UI.
export const ALL_MOODS: Mood[] = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling", "Angry", "Anxious", "Content"];

export type SupportedEmoji = '👍' | '❤️' | '😂' | '😮' | '😢';
export const ALL_SUPPORTED_EMOJIS: SupportedEmoji[] = ['👍', '❤️', '😂', '😮', '😢'];

export interface User {
  id: string;
  name: string;
  avatar: string; 
  mood: Mood;
  "data-ai-hint"?: string; 
  isOnline?: boolean; 
  lastSeen?: number; 
}

export type MessageClipType = 'audio' | 'video';

export interface Message {
  id: string;
  userId: string; 
  text?: string; // Text is now optional for clip messages
  timestamp: number; 
  reactions?: Partial<Record<SupportedEmoji, string[]>>; 
  clipType?: MessageClipType;
  clipPlaceholderText?: string; // e.g., "User sent an audio mood clip"
}

// For Phase 4 Sidebar
export interface AppEvent {
  id: string;
  timestamp: number;
  type: 'moodChange' | 'thoughtPingSent' | 'messageSent' | 'reactionAdded' | 'moodClipSent';
  description: string;
  userId?: string; // Optional: ID of the user who initiated the event
  userName?: string; // Optional: Name of the user
}
