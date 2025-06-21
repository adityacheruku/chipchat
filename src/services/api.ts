
import type {
  AuthResponse,
  User,
  UserInToken,
  Chat,
  Message,
  ApiErrorResponse,
  SupportedEmoji,
  VoiceMessageUploadResponse,
  StickerPackResponse,
  StickerListResponse,
  PushSubscriptionJSON,
  NotificationSettings,
  PartnerRequest,
} from '@/types';
import type { UserCreate as BackendUserCreate } from '@/chirpchat-backend/app/auth/schemas';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://192.168.29.167:8000';

let currentAuthToken: string | null = null;

function getAuthToken(): string | null {
  if (currentAuthToken) return currentAuthToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('chirpChatToken');
  }
  return null;
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
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    if (response.headers.get("content-length") === "0" && response.status === 200) {
        return {} as T;
    }
    return response.json() as Promise<T>;
  } else if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T;
  }
  return response.text().then(text => { throw new Error(`Unexpected response type: ${contentType}, content: ${text.substring(0,100)}`) }) as Promise<T>;
}


export const api = {
  setAuthToken: (token: string | null) => {
    currentAuthToken = token;
  },
  // AUTH
  login: async (phone: string, password_plaintext: string): Promise<AuthResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', phone);
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

  // PARTNERS
  getPartnerSuggestions: async (): Promise<{users: User[]}> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/partners/suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{users: User[]}>(response);
  },

  getIncomingRequests: async (): Promise<{requests: PartnerRequest[]}> => {
     const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/partners/requests/incoming`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{requests: PartnerRequest[]}>(response);
  },
  
  getOutgoingRequests: async (): Promise<{requests: PartnerRequest[]}> => {
     const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/partners/requests/outgoing`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<{requests: PartnerRequest[]}>(response);
  },

  sendPartnerRequest: async (recipientId: string): Promise<PartnerRequest> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/partners/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipient_id: recipientId }),
    });
    return handleResponse<PartnerRequest>(response);
  },

  respondToPartnerRequest: async (requestId: string, action: 'accept' | 'reject'): Promise<void> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/partners/requests/${requestId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });
    return handleResponse<void>(response);
  },


  // CHATS
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

  sendMessageHttp: async (chatId: string, messageData: Partial<Omit<Message, 'id' | 'user_id' | 'chat_id' | 'created_at' | 'updated_at' | 'reactions'>>): Promise<Message> => {
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
  uploadChatImage: async (file: File): Promise<{ image_url: string; image_thumbnail_url: string; }> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/uploads/chat_image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    return handleResponse<{ image_url: string; image_thumbnail_url: string; }>(response);
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

  uploadChatDocument: async (file: File): Promise<{ file_url: string, file_name: string }> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/uploads/chat_document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    return handleResponse<{ file_url: string, file_name: string }>(response);
  },

  uploadVoiceMessage: async (file: File): Promise<VoiceMessageUploadResponse> => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/uploads/voice_message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    return handleResponse<VoiceMessageUploadResponse>(response);
  },

  // STICKERS
  getStickerPacks: async (): Promise<StickerPackResponse> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/stickers/packs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<StickerPackResponse>(response);
  },

  getStickersInPack: async (packId: string): Promise<StickerListResponse> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/stickers/pack/${packId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<StickerListResponse>(response);
  },

  searchStickers: async (query: string): Promise<StickerListResponse> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/stickers/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    return handleResponse<StickerListResponse>(response);
  },

  getRecentStickers: async (): Promise<StickerListResponse> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/stickers/recent`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<StickerListResponse>(response);
  },

  toggleFavoriteSticker: async (stickerId: string): Promise<StickerListResponse> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/stickers/favorites/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sticker_id: stickerId }),
    });
    return handleResponse<StickerListResponse>(response);
  },

  // PWA SHORTCUT ACTIONS
  sendThinkingOfYouPing: async (recipientUserId: string): Promise<{ status: string }> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Authentication token not found. Please log in.");
    }
    const response = await fetch(`${API_BASE_URL}/users/${recipientUserId}/ping-thinking-of-you`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json' // Even if body is empty, good practice
      },
      // No body needed for this request
    });
    return handleResponse<{ status: string }>(response);
  },

  // PUSH NOTIFICATIONS
  sendPushSubscriptionToServer: async (subscription: PushSubscriptionJSON): Promise<{ msg: string }> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(subscription),
    });
    return handleResponse<{ msg: string }>(response);
  },

  removePushSubscriptionFromServer: async (endpoint: string): Promise<{ msg: string }> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/notifications/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint }),
    });
    return handleResponse<{ msg: string }>(response);
  },

  getNotificationSettings: async (): Promise<NotificationSettings> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<NotificationSettings>(response);
  },

  updateNotificationSettings: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
          method: 'PUT',
          headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(settings),
      });
      return handleResponse<NotificationSettings>(response);
  },
};
