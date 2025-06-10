
export type Mood = "Happy" | "Sad" | "Neutral" | "Excited" | "Thoughtful" | "Chilling" | "Angry" | "Anxious" | "Content";
export const ALL_MOODS: Mood[] = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling", "Angry", "Anxious", "Content"];

export type SupportedEmoji = '👍' | '❤️' | '😂' | '😮' | '😢';
export const ALL_SUPPORTED_EMOJIS: SupportedEmoji[] = ['👍', '❤️', '😂', '😮', '😢'];

// User types aligned with backend schemas
export interface User {
  id: string; // UUID
  display_name: string;
  avatar_url: string | null;
  mood: Mood;
  phone?: string | null;
  is_online?: boolean;
  last_seen?: string | null; // ISO Date string
  email?: string; // Added for potential use, backend returns it
  "data-ai-hint"?: string; // Retained for frontend image hints
}

// User for token response - from backend Token schema
export interface UserInToken extends User {}


export type MessageClipType = 'audio' | 'video';

// Message type aligned with backend MessageInDB schema
export interface Message {
  id: string; // UUID
  user_id: string; // UUID of sender
  chat_id: string; // UUID of chat
  text?: string | null;
  timestamp?: string; // ISO Date string, will be created_at from backend
  created_at: string; // ISO Date string
  updated_at: string; // ISO Date string
  reactions?: Partial<Record<SupportedEmoji, string[] /* User IDs */>> | null;
  clip_type?: MessageClipType | null;
  clip_placeholder_text?: string | null;
  clip_url?: string | null;
  image_url?: string | null;
  client_temp_id?: string | null; // For optimistic UI updates
}

// Chat types aligned with backend
export interface ChatParticipant extends User {}

export interface Chat {
  id: string; // UUID
  participants: ChatParticipant[];
  last_message: Message | null;
  created_at: string; // ISO Date string
  updated_at: string; // ISO Date string
}


// For Phase 4 Sidebar - Event log, can be kept as is for client-side event logging
export interface AppEvent {
  id: string;
  timestamp: number;
  type: 'moodChange' | 'thoughtPingSent' | 'messageSent' | 'reactionAdded' | 'moodClipSent' | 'login' | 'logout' | 'profileUpdate' | 'apiError';
  description: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
}

// API service related types
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserInToken;
}

export interface ApiErrorResponse {
  detail?: string | { msg: string; type: string }[];
}

// WebSocket message types
export interface WebSocketMessagePayload {
  event_type: string;
  [key: string]: any;
}

export interface NewMessageEventData {
  event_type: "new_message";
  message: Message;
  chat_id: string;
}

export interface MessageReactionUpdateEventData {
  event_type: "message_reaction_update";
  message_id: string;
  chat_id: string;
  reactions: Partial<Record<SupportedEmoji, string[]>>;
}

export interface UserPresenceUpdateEventData {
  event_type: "user_presence_update";
  user_id: string;
  is_online: boolean;
  last_seen: string | null;
  mood: Mood;
}

export interface TypingIndicatorEventData {
  event_type: "typing_indicator";
  chat_id: string;
  user_id: string;
  is_typing: boolean;
}

export interface ThinkingOfYouReceivedEventData {
  event_type: "thinking_of_you_received";
  sender_id: string;
  sender_name: string;
}

export type WebSocketEventData =
  | NewMessageEventData
  | MessageReactionUpdateEventData
  | UserPresenceUpdateEventData
  | TypingIndicatorEventData
  | ThinkingOfYouReceivedEventData
  | { event_type: "error", detail: string }
  | { event_type: "authenticated" } // Example confirmation event
  | { event_type: "user_profile_update", user_id: string, mood?: Mood, display_name?: string, avatar_url?: string };


// Default chat partner response from backend
export interface DefaultChatPartnerResponse {
    user_id: string; // UUID
    display_name: string;
    avatar_url: string | null;
}
