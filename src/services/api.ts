
import type {
  AuthResponse,
  User,
  UserInToken,
  Chat,
  Message,
  DefaultChatPartnerResponse,
  ApiErrorResponse,
  SupportedEmoji, // Added SupportedEmoji
} from '@/types';
// Adjust the import path for UserCreate if it's different in your backend structure
// Assuming UserCreate from backend will now take phone.
import type { UserCreate as BackendUserCreate } from '@/chirpchat-backend/app/auth/schemas'; 

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
  // Handle cases where response might be empty for 200/204
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    if (response.headers.get("content-length") === "0" && response.status === 200) {
        return {} as T; // Return empty object for empty JSON response
    }
    return response.json() as Promise<T>;
  } else if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T; // Return empty object for No Content or empty response
  }
  // For non-JSON responses, or if you expect text/plain, handle differently
  // For now, assuming JSON or empty as primary cases
  return response.text().then(text => { throw new Error(`Unexpected response type: ${contentType}, content: ${text.substring(0,100)}`) }) as Promise<T>;
}


export const api = {
  // AUTH
  login: async (phone: string, password_plaintext: string): Promise<AuthResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', phone); // Backend's OAuth2PasswordRequestForm expects 'username' field for the phone number
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

  // Use the backend's UserCreate schema directly for the body
  register: async (userData: BackendUserCreate): Promise<AuthResponse> => {
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

  // Backend UserUpdate schema might differ slightly, ensure frontend sends compatible data
  updateUserProfile: async (profileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone' | 'email'>>): Promise<UserInToken> => {
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
        return null; 
    }
     if (response.status === 204) return null; 
    return handleResponse<DefaultChatPartnerResponse | null>(response);
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

  // UPLOADS
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
    // The backend doesn't have a /users/{recipient_user_id}/ping.
    // It should be handled via WebSocket event "ping_thinking_of_you" sent by the client.
    // Or a new HTTP endpoint like /chats/ping could be created if HTTP is preferred for this.
    // For now, this API function is problematic as there's no matching backend HTTP endpoint.
    // This functionality is better suited for a WebSocket message from the client.
    // I'll leave this as a placeholder, but it won't work with current backend.
    // A better approach would be to use the WebSocket connection to send this ping.
    console.warn("sendThinkingOfYouPing via HTTP is not directly supported by the current backend. Use WebSocket.");
    
    // Mocking a success for now, but this needs a backend change or use WebSocket
    // return Promise.resolve({ status: "Ping sent (mocked)" });
    
    // If there was a backend endpoint:
    // const response = await fetch(`${API_BASE_URL}/users/${recipientUserId}/ping`, { // This path is hypothetical
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${token}` },
    // });
    // return handleResponse<{ status: string }>(response);
    throw new Error("sendThinkingOfYouPing via HTTP is not implemented on the backend. Use WebSockets.");
  },
};
