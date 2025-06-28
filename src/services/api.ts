
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
  EventPayload,
  VerifyOtpResponse,
  CompleteRegistrationRequest,
  DocumentUploadResponse,
  PasswordChangeRequest,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://d87c-49-43-230-78.ngrok-free.app';

let currentAuthToken: string | null = null;

function getAuthToken(): string | null {
  if (currentAuthToken) return currentAuthToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('chirpChatToken');
  }
  return null;
}

function getApiHeaders(options: { contentType?: string | null, includeAuth?: boolean } = {}): HeadersInit {
  const { contentType = 'application/json', includeAuth = true } = options;
  const headers: HeadersInit = {
    'ngrok-skip-browser-warning': 'true',
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  if (contentType) {
     headers['Content-Type'] = contentType;
  }
  
  return headers;
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

  // If the response is 204 No Content, there's no body to parse. Return a successful empty object.
  if (response.status === 204) {
    return {} as T;
  }

  // For other successful responses, try to parse a body.
  const text = await response.text();
  if (text.length === 0) {
    // Handle cases like 200 OK with an empty body
    return {} as T;
  }
  
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error("API Error: Expected JSON but received non-JSON response.", text.substring(0, 100));
    throw new Error("Received an invalid response from the server.");
  }
}

async function uploadWithProgress<T>(
  url: string,
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const jsonResponse = JSON.parse(xhr.responseText);
          resolve(jsonResponse);
        } catch (e) {
          reject(new Error('Failed to parse server response.'));
        }
      } else {
        let errorData: ApiErrorResponse = {};
        try {
          errorData = JSON.parse(xhr.responseText);
        } catch (e) { /* ignore */ }
        const errorMessage =
          typeof errorData.detail === 'string' ? errorData.detail :
          `Upload failed with status ${xhr.status}`;
        reject(new Error(errorMessage));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload.'));
    };

    xhr.send(formData);
  });
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
      headers: getApiHeaders({ contentType: 'application/x-www-form-urlencoded', includeAuth: false }),
      body: formData.toString(),
    });
    return handleResponse<AuthResponse>(response);
  },

  sendOtp: async (phone: string): Promise<{message: string}> => {
    const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: getApiHeaders({ includeAuth: false }),
      body: JSON.stringify({ phone }),
    });
    return handleResponse<{message: string}>(response);
  },
  
  verifyOtp: async (phone: string, otp: string): Promise<VerifyOtpResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: getApiHeaders({ includeAuth: false }),
      body: JSON.stringify({ phone, otp }),
    });
    return handleResponse<VerifyOtpResponse>(response);
  },
  
  completeRegistration: async (userData: CompleteRegistrationRequest): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/complete-registration`, {
      method: 'POST',
      headers: getApiHeaders({ includeAuth: false }),
      body: JSON.stringify(userData),
    });
    return handleResponse<AuthResponse>(response);
  },

  // USERS
  getCurrentUserProfile: async (): Promise<UserInToken> => {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      headers: getApiHeaders(),
    });
    return handleResponse<UserInToken>(response);
  },

  getUserProfile: async (userId: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      headers: getApiHeaders(),
    });
    return handleResponse<User>(response);
  },

  updateUserProfile: async (profileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone' | 'email'>>): Promise<UserInToken> => {
    const response = await fetch(`${API_BASE_URL}/users/me/profile`, {
      method: 'PUT',
      headers: getApiHeaders(),
      body: JSON.stringify(profileData),
    });
    return handleResponse<UserInToken>(response);
  },

  uploadAvatar: async (file: File, onProgress: (progress: number) => void): Promise<UserInToken> => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress(`${API_BASE_URL}/users/me/avatar`, formData, onProgress);
  },

  changePassword: async (passwordData: PasswordChangeRequest): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/me/password`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(passwordData),
    });
    return handleResponse<void>(response);
  },

  // PARTNERS
  getPartnerSuggestions: async (): Promise<{users: User[]}> => {
    const response = await fetch(`${API_BASE_URL}/partners/suggestions`, {
      headers: getApiHeaders(),
    });
    return handleResponse<{users: User[]}>(response);
  },

  getIncomingRequests: async (): Promise<{requests: PartnerRequest[]}> => {
     const response = await fetch(`${API_BASE_URL}/partners/requests/incoming`, {
      headers: getApiHeaders(),
    });
    return handleResponse<{requests: PartnerRequest[]}>(response);
  },
  
  getOutgoingRequests: async (): Promise<{requests: PartnerRequest[]}> => {
     const response = await fetch(`${API_BASE_URL}/partners/requests/outgoing`, {
      headers: getApiHeaders(),
    });
    return handleResponse<{requests: PartnerRequest[]}>(response);
  },

  sendPartnerRequest: async (recipientId: string): Promise<PartnerRequest> => {
    const response = await fetch(`${API_BASE_URL}/partners/request`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ recipient_id: recipientId }),
    });
    return handleResponse<PartnerRequest>(response);
  },

  respondToPartnerRequest: async (requestId: string, action: 'accept' | 'reject'): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/partners/requests/${requestId}/respond`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ action }),
    });
    return handleResponse<void>(response);
  },

  disconnectPartner: async (): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/partners/me`, {
        method: 'DELETE',
        headers: getApiHeaders(),
    });
    return handleResponse<void>(response);
  },


  // CHATS
  createOrGetChat: async (recipientId: string): Promise<Chat> => {
    const response = await fetch(`${API_BASE_URL}/chats/`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ recipient_id: recipientId }),
    });
    return handleResponse<Chat>(response);
  },

  listChats: async (): Promise<{chats: Chat[]}> => {
    const response = await fetch(`${API_BASE_URL}/chats/`, {
      headers: getApiHeaders(),
    });
    return handleResponse<{chats: Chat[]}>(response);
  },

  getMessages: async (chatId: string, limit: number = 50, beforeTimestamp?: string): Promise<{messages: Message[]}> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (beforeTimestamp) params.append('before_timestamp', beforeTimestamp);
    
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages?${params.toString()}`, {
      headers: getApiHeaders(),
    });
    return handleResponse<{messages: Message[]}>(response);
  },

  sendMessageHttp: async (chatId: string, messageData: Partial<Omit<Message, 'id' | 'user_id' | 'chat_id' | 'created_at' | 'updated_at' | 'reactions'>>): Promise<Message> => {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(messageData),
    });
    return handleResponse<Message>(response);
  },

  toggleReactionHttp: async (messageId: string, emoji: SupportedEmoji): Promise<Message> => {
    const response = await fetch(`${API_BASE_URL}/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ emoji }),
    });
    return handleResponse<Message>(response);
  },
  
  deleteMessageForMe: async (messageId: string): Promise<void> => {
    // This would be a real endpoint in a full implementation
    console.log(`API: Deleting message ${messageId} for current user only.`);
    // const response = await fetch(`${API_BASE_URL}/messages/${messageId}/self`, {
    //   method: 'DELETE',
    //   headers: getApiHeaders(),
    // });
    // return handleResponse<void>(response);
    return Promise.resolve();
  },

  deleteMessageForEveryone: async (messageId: string, chatId: string): Promise<void> => {
     // This would be a real endpoint in a full implementation that sends a 'delete_message' event
    console.log(`API: Deleting message ${messageId} for everyone in chat ${chatId}.`);
    // const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
    //   method: 'DELETE',
    //   headers: getApiHeaders(),
    //   body: JSON.stringify({ chat_id: chatId })
    // });
    // return handleResponse<void>(response);
    return Promise.resolve();
  },

  // UPLOADS
  uploadChatImage: async (file: File, onProgress: (progress: number) => void): Promise<{ image_url: string; image_thumbnail_url: string; }> => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress(`${API_BASE_URL}/uploads/chat_image`, formData, onProgress);
  },

  uploadMoodClip: async (file: File, clip_type: 'audio' | 'video', onProgress: (progress: number) => void): Promise<{ file_url: string, clip_type: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clip_type', clip_type);
    return uploadWithProgress(`${API_BASE_URL}/uploads/mood_clip`, formData, onProgress);
  },

  uploadChatDocument: async (file: File, onProgress: (progress: number) => void): Promise<DocumentUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress(`${API_BASE_URL}/uploads/chat_document`, formData, onProgress);
  },

  uploadVoiceMessage: async (file: File, onProgress: (progress: number) => void): Promise<VoiceMessageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress(`${API_BASE_URL}/uploads/voice_message`, formData, onProgress);
  },

  // STICKERS
  getStickerPacks: async (): Promise<StickerPackResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/packs`, {
      headers: getApiHeaders(),
    });
    return handleResponse<StickerPackResponse>(response);
  },

  getStickersInPack: async (packId: string): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/pack/${packId}`, {
      headers: getApiHeaders(),
    });
    return handleResponse<StickerListResponse>(response);
  },

  searchStickers: async (query: string): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/search`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ query }),
    });
    return handleResponse<StickerListResponse>(response);
  },

  getRecentStickers: async (): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/recent`, {
      headers: getApiHeaders(),
    });
    return handleResponse<StickerListResponse>(response);
  },

  getFavoriteStickers: async (): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/favorites`, {
      headers: getApiHeaders(),
    });
    return handleResponse<StickerListResponse>(response);
  },

  toggleFavoriteSticker: async (stickerId: string): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/favorites/toggle`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ sticker_id: stickerId }),
    });
    return handleResponse<StickerListResponse>(response);
  },

  // PWA SHORTCUT ACTIONS
  sendThinkingOfYouPing: async (recipientUserId: string): Promise<{ status: string }> => {
    const response = await fetch(`${API_BASE_URL}/users/${recipientUserId}/ping-thinking-of-you`, {
      method: 'POST',
      headers: getApiHeaders(),
    });
    return handleResponse<{ status: string }>(response);
  },

  // PUSH NOTIFICATIONS
  sendPushSubscriptionToServer: async (subscription: PushSubscriptionJSON): Promise<{ msg: string }> => {
    const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(subscription),
    });
    return handleResponse<{ msg: string }>(response);
  },

  removePushSubscriptionFromServer: async (endpoint: string): Promise<{ msg: string }> => {
    const response = await fetch(`${API_BASE_URL}/notifications/unsubscribe`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ endpoint }),
    });
    return handleResponse<{ msg: string }>(response);
  },

  getNotificationSettings: async (): Promise<NotificationSettings> => {
    const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
        headers: getApiHeaders(),
    });
    return handleResponse<NotificationSettings>(response);
  },

  updateNotificationSettings: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
      const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
          method: 'PUT',
          headers: getApiHeaders(),
          body: JSON.stringify(settings),
      });
      return handleResponse<NotificationSettings>(response);
  },

  // EVENT SYNC
  syncEvents: async (since: number): Promise<EventPayload[]> => {
    const response = await fetch(`${API_BASE_URL}/events/sync?since=${since}`, {
      headers: getApiHeaders(),
    });
    return handleResponse<EventPayload[]>(response);
  },
};
