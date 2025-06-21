
export type Mood = string;
export const ALL_MOODS: Mood[] = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling", "Angry", "Anxious", "Content"];

export type SupportedEmoji = '👍' | '❤️' | '😂' | '😮' | '😢' | '🙏' | '🔥' | '🎉' | '🤔' | '💯';
export const ALL_SUPPORTED_EMOJIS: SupportedEmoji[] = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '🤔', '💯'];

// User types aligned with backend schemas
export interface User {
  id: string; // UUID
  display_name: string;
  avatar_url: string | null;
  mood: Mood;
  phone: string; // Phone is now the primary identifier from client perspective for login/signup
  email?: string | null; // Email is optional
  is_online?: boolean;
  last_seen?: string | null; // ISO Date string
  "data-ai-hint"?: string; 
}

export interface UserInToken extends User {}


export type MessageClipType = 'audio' | 'video';
export type MessageStatus = "sending" | "sent_to_server" | "delivered_to_recipient" | "read_by_recipient" | "failed";


export interface Message {
  id: string; 
  user_id: string; 
  chat_id: string; 
  text?: string | null;
  created_at: string; 
  updated_at: string; 
  reactions?: Partial<Record<SupportedEmoji, string[] /* User IDs */>> | null;
  clip_type?: MessageClipType | null;
  clip_placeholder_text?: string | null;
  clip_url?: string | null;
  image_url?: string | null;
  image_thumbnail_url?: string | null; // For optimized image loading
  document_url?: string | null;
  document_name?: string | null;
  sticker_url?: string | null;
  client_temp_id?: string | null; // Client-generated temporary ID
  status?: MessageStatus | null; // Message status
  // Voice message metadata
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  audio_format?: string | null;
  transcription?: string | null;
}

export interface ChatParticipant extends User {}

export interface Chat {
  id: string; 
  participants: ChatParticipant[];
  last_message: Message | null;
  created_at: string; 
  updated_at: string; 
}

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

export interface VoiceMessageUploadResponse {
    file_url: string;
    clip_type: 'audio';
    duration_seconds: number | null;
    file_size_bytes: number | null;
    audio_format: string | null;
}


// WebSocket message types
export interface WebSocketMessagePayload {
  event_type: string;
  [key: string]: any;
}

export interface NewMessageEventData {
  event_type: "new_message";
  message: Message; // Should now include client_temp_id and status from server
  chat_id: string;
}

export interface MessageReactionUpdateEventData {
  event_type: "message_reaction_update";
  message_id: string; // Changed from messageId
  chat_id: string;    // Changed from chatId
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

export type UserProfileUpdateEventData = {
  event_type: "user_profile_update";
  user_id: string;
  mood?: Mood;
  display_name?: string;
  avatar_url?: string;
  // Add other updatable fields if necessary
};

export interface HeartbeatClientEvent {
  event_type: "HEARTBEAT";
}


export type WebSocketEventData =
  | NewMessageEventData
  | MessageReactionUpdateEventData
  | UserPresenceUpdateEventData
  | TypingIndicatorEventData
  | ThinkingOfYouReceivedEventData
  | UserProfileUpdateEventData
  | { event_type: "error", detail: string }
  | { event_type: "authenticated" }
  | HeartbeatClientEvent; // Client sends this, server acknowledges or just uses it for activity


export interface DefaultChatPartnerResponse {
    user_id: string; 
    display_name: string;
    avatar_url: string | null;
}

// For frontend form, matching backend UserCreate with phone
export interface UserCreateFrontend {
  phone: string;
  password_plaintext: string; // To match AuthContext
  display_name: string;
  email?: string; // Optional email
}

// Sticker System Types
export interface StickerPack {
  id: string; // UUID
  name: string;
  description?: string | null;
  thumbnail_url?: string | null;
  is_active: boolean;
  created_at: string; // ISO Date string
}

export interface Sticker {
  id: string; // UUID
  pack_id: string; // UUID of the sticker pack
  name?: string | null;
  image_url: string;
  tags?: string[] | null;
  order_index?: number;
}

export interface UserStickerPack {
    user_id: string; // UUID
    pack_id: string; // UUID
    unlocked_at: string; // ISO Date string
}
