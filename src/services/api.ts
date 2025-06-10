
import type {
  AuthResponse,
  User,
  UserInToken,
  Chat,
  Message,
  DefaultChatPartnerResponse,
  ApiErrorResponse,
  Mood,
} from '@/types';
import type { UserCreate } from '@/chirpchat-backend/app/auth/schemas'; // Assuming this path is resolvable or adjust as needed

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('chirpChatToken');
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiErrorResponse = {};
    try {
      errorData = await response.json();
    } catch (e) {
      // Ignore if response is not JSON
    }
    const errorMessage =
      typeof errorData.detail === 'string' ? errorData.detail :
      Array.isArray(errorData.detail) && errorData.detail[0]?.msg ? errorData.detail[0].msg :
      `HTTP error ${response.status}: ${response.statusText}`;

    console.error('API Error:', errorMessage, 'Full Response:', errorData);
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}


export const api = {
  // AUTH
  login: async (username_email: string, password_plaintext: string): Promise<AuthResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', username_email); // Backend expects 'username' for email
    formData.append('password', password_plaintext);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    return handleResponse<AuthResponse>(response);
  },

  register: async (userData: UserCreate): Promise<AuthResponse> => {
     // UserCreate from backend is {email, password, display_name}
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return handleResponse<AuthResponse>(response);
  },

  // USERS
  getCurrentUserProfile: async (): Promise<UserInToken> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<UserInToken>(response);
  },

  getUserProfile: async (userId: string): Promise<User> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<User>(response);
  },

  updateUserProfile: async (profileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone'>>): Promise<UserInToken> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/users/me/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });
    return handleResponse<UserInToken>(response);
  },

  uploadAvatar: async (file: File): Promise<UserInToken> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return handleResponse<UserInToken>(response);
  },

  // CHATS
  getDefaultChatPartner: async (): Promise<DefaultChatPartnerResponse | null> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/chats/me/default-chat-partner`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 200 && response.headers.get("content-length") === "0") {
        return null; // Handle empty 200 response gracefully
    }
     if (response.status === 204) return null; // No content
    return handleResponse<DefaultChatPartnerResponse>(response);
  },

  createOrGetChat: async (recipientId: string): Promise<Chat> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/chats/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipient_id: recipientId }),
    });
    return handleResponse<Chat>(response);
  },

  listChats: async (): Promise<{chats: Chat[]}> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/chats/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{chats: Chat[]}>(response);
  },

  getMessages: async (chatId: string, limit: number = 50, beforeTimestamp?: string): Promise<{messages: Message[]}> => {
    const token = getAuthToken();
    const params = new URLSearchParams({ limit: String(limit) });
    if (beforeTimestamp) params.append('before_timestamp', beforeTimestamp);
    
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{messages: Message[]}>(response);
  },

  // Use WebSocket for sending messages primarily. This is a fallback.
  sendMessageHttp: async (chatId: string, messageData: { text?: string; clip_type?: string; clip_placeholder_text?: string; clip_url?: string; image_url?: string; client_temp_id?: string }): Promise<Message> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(messageData),
    });
    return handleResponse<Message>(response);
  },

  // Use WebSocket for reactions primarily. This is a fallback.
  toggleReactionHttp: async (messageId: string, emoji: SupportedEmoji): Promise<Message> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ emoji }),
    });
    return handleResponse<Message>(response);
  },

  // UPLOADS (frontend might call these directly, or via user profile updates)
  uploadChatImage: async (file: File): Promise<{ image_url: string }> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/uploads/chat_image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    return handleResponse<{ image_url: string }>(response);
  },

  uploadMoodClip: async (file: File, clip_type: 'audio' | 'video'): Promise<{ file_url: string, clip_type: string }> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clip_type', clip_type);
    const response = await fetch(`${API_BASE_URL}/uploads/mood_clip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    return handleResponse<{ file_url: string, clip_type: string }>(response);
  },

  // PWA SHORTCUT ACTIONS
  sendThinkingOfYouPing: async (recipientUserId: string): Promise<{ status: string }> => {
    const token = getAuthToken();
    // Backend uses POST /users/{recipient_user_id}/ping, but that seems more like a direct user action.
    // For simplicity, assuming the chat router has a ping mechanism.
    // If backend changed this to /chats/ping or similar, adjust here.
    // The current backend has POST /users/{user_id}/ping, so this seems okay but should be confirmed.
    const response = await fetch(`${API_BASE_URL}/users/${recipientUserId}/ping`, { // Check this path with backend.
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{ status: string }>(response);
  },
};
