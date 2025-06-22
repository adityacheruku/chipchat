

export type Mood = string;
export const ALL_MOODS: Mood[] = ["Happy", "Sad", "Neutral", "Excited", "Thoughtful", "Chilling", "Angry", "Anxious", "Content"];

// =================================================================
// CUSTOMIZE YOUR EMOJIS HERE (FRONTEND)
// =================================================================
// This list controls which emojis appear in the reaction pop-up in the chat UI.
// Add or remove emojis as single-character strings.
// Example: export const ALL_SUPPORTED_EMOJIS: SupportedEmoji[] = ['😊', '🎉', '👍', '❤️'];
//
export type SupportedEmoji = string; // Using string to allow any emoji
export const ALL_SUPPORTED_EMOJIS: SupportedEmoji[] = [
  // Add your custom emojis here. For example:
  // '👍', '❤️', '😂', '😮', '😢', '🙏'
];


// User types aligned with backend schemas
export interface User {
  id: string; // UUID
  display_name: string;
  avatar_url: string | null;
  mood: Mood;
  phone?: string | null; 
  email?: string | null; 
  is_online?: boolean;
  last_seen?: string | null; // ISO Date string
  "data-ai-hint"?: string; 
  partner_id?: string | null; // UUID
}

export interface UserInToken extends User {}


export type MessageClipType = 'audio' | 'video';
export type MessageStatus = "uploading" | "sending" | "sent_to_server" | "delivered_to_recipient" | "read_by_recipient" | "failed";
export type MessageSubtype = 'text' | 'sticker' | 'clip' | 'image' | 'document' | 'voice_message' | 'emoji_only';


export interface Message {
  id: string; 
  user_id: string; 
  chat_id: string; 
  text?: string | null;
  created_at: string; 
  updated_at: string; 
  reactions?: Partial<Record<SupportedEmoji, string[] /* User IDs */>> | null;
  message_subtype?: MessageSubtype | null;
  clip_type?: MessageClipType | null;
  clip_placeholder_text?: string | null;
  clip_url?: string | null;
  image_url?: string | null;
  image_thumbnail_url?: string | null; // For optimized image loading
  document_url?: string | null;
  document_name?: string | null;
  sticker_id?: string | null; // The ID of the sticker sent
  sticker_image_url?: string | null; // The actual image URL, joined from the backend
  client_temp_id: string; // Client-generated temporary ID - now mandatory
  status: MessageStatus; // Message status - now mandatory
  // Voice message metadata
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  audio_format?: string | null;
  transcription?: string | null;

  // --- Client-side only properties for upload progress ---
  uploadProgress?: number; // A number from 0 to 100
  file?: File; // The file being uploaded
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

export type EventPayload = {
    sequence?: number; // Now includes the event sequence number
} & (
  | NewMessageEventData
  | MessageReactionUpdateEventData
  | UserPresenceUpdateEventData
  | TypingIndicatorEventData
  | ThinkingOfYouReceivedEventData
  | UserProfileUpdateEventData
  | MessageAckEventData
  | { event_type: "error", detail: string }
  | { event_type: "authenticated" }
  | { event_type: "sse_connected", data: string }
  | { event_type: "ping", data: string }
);

// WebSocket and SSE message types
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

export type UserProfileUpdateEventData = {
  event_type: "user_profile_update";
  user_id: string;
  mood?: Mood;
  display_name?: string;
  avatar_url?: string;
};

export interface HeartbeatClientEvent {
  event_type: "HEARTBEAT";
}

export interface MessageAckEventData {
    event_type: "message_ack";
    client_temp_id: string;
    server_assigned_id: string;
    status: MessageStatus;
    timestamp: string;
}

export type WebSocketEventData = EventPayload;

// Constant to help SSE client subscribe to all relevant events
export const ALL_EVENT_TYPES = [
    "new_message", "message_reaction_update", "user_presence_update",
    "typing_indicator", "thinking_of_you_received", "user_profile_update",
    "message_ack", "error", "sse_connected", "ping"
];


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
  is_premium: boolean;
  updated_at: string; // ISO Date string
}

export interface Sticker {
  id: string; // UUID
  pack_id: string; // UUID of the sticker pack
  name?: string | null;
  image_url: string;
  tags?: string[] | null;
  order_index?: number;
  created_at: string;
}

export interface StickerPackResponse {
  packs: StickerPack[];
}

export interface StickerListResponse {
  stickers: Sticker[];
}


export interface UserStickerPack {
    user_id: string; // UUID
    pack_id: string; // UUID
    unlocked_at: string; // ISO Date string
}

// Push Notifications
export interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: PushSubscriptionKeys;
}

export interface NotificationSettings {
  user_id: string;
  messages: boolean;
  mood_updates: boolean;
  thinking_of_you: boolean;
  voice_messages: boolean;
  media_sharing: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null; // e.g., "22:00:00"
  quiet_hours_end: string | null;   // e.g., "08:00:00"
  quiet_hours_weekdays_only: boolean;
  timezone: string;
}

// Partner System Types
export interface PartnerRequest {
    id: string;
    sender: User;
    recipient: User;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    created_at: string;
}
