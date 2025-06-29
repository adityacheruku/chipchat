
import type {
  AuthResponse, User, UserInToken, Chat, Message, ApiErrorResponse, SupportedEmoji,
  VoiceMessageUploadResponse, StickerPackResponse, StickerListResponse, PushSubscriptionJSON,
  NotificationSettings, PartnerRequest, EventPayload, VerifyOtpResponse,
  CompleteRegistrationRequest, DocumentUploadResponse, PasswordChangeRequest, DeleteAccountRequest
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
let currentAuthToken: string | null = null;

function getAuthToken(): string | null {
  if (currentAuthToken) return currentAuthToken;
  if (typeof window !== 'undefined') return localStorage.getItem('chirpChatToken');
  return null;
}

function getApiHeaders(options: { contentType?: string | null, includeAuth?: boolean } = {}): HeadersInit {
  const { contentType = 'application/json', includeAuth = true } = options;
  const headers: HeadersInit = { 'ngrok-skip-browser-warning': 'true' };
  if (includeAuth) {
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  
  if (!response.ok) {
    let errorData: ApiErrorResponse = { detail: `HTTP error ${response.status}` };
    try {
      if (text) errorData = JSON.parse(text);
    } catch (e) {
      errorData.detail = text || `HTTP error ${response.status}`;
    }
    
    const errorMessage = typeof errorData.detail === 'string'
      ? errorData.detail
      : Array.isArray(errorData.detail) && errorData.detail[0]?.msg
      ? errorData.detail[0].msg
      : `HTTP error ${response.status}`;
      
    throw new Error(errorMessage);
  }

  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (e) {
    throw new Error("Failed to parse JSON response");
  }
}


async function uploadWithProgress<T>(url: string, formData: FormData, onProgress: (progress: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(new Error('Failed to parse server response.')); }
      } else {
        let errorData: ApiErrorResponse = {}; try { errorData = JSON.parse(xhr.responseText); } catch (e) {}
        reject(new Error(typeof errorData.detail === 'string' ? errorData.detail : `Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(formData);
  });
}

export const api = {
  setAuthToken: (token: string | null) => { currentAuthToken = token; },
  login: async (phone: string, password_plaintext: string): Promise<AuthResponse> => {
    const formData = new URLSearchParams({ username: phone, password: password_plaintext });
    const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: getApiHeaders({ contentType: 'application/x-www-form-urlencoded', includeAuth: false }), body: formData.toString() });
    return handleResponse<AuthResponse>(response);
  },
  sendOtp: async (phone: string): Promise<{message: string}> => {
    const response = await fetch(`${API_BASE_URL}/auth/send-otp`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify({ phone }) });
    return handleResponse<{message: string}>(response);
  },
  verifyOtp: async (phone: string, otp: string): Promise<VerifyOtpResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify({ phone, otp }) });
    return handleResponse<VerifyOtpResponse>(response);
  },
  completeRegistration: async (userData: CompleteRegistrationRequest): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/complete-registration`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify(userData) });
    return handleResponse<AuthResponse>(response);
  },
  getCurrentUserProfile: async (): Promise<UserInToken> => {
    const response = await fetch(`${API_BASE_URL}/users/me`, { headers: getApiHeaders() });
    return handleResponse<UserInToken>(response);
  },
  getUserProfile: async (userId: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, { headers: getApiHeaders() });
    return handleResponse<User>(response);
  },
  updateUserProfile: async (data: Partial<User>): Promise<UserInToken> => {
    const response = await fetch(`${API_BASE_URL}/users/me/profile`, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify(data) });
    return handleResponse<UserInToken>(response);
  },
  uploadAvatar: async (file: File, onProgress: (p: number) => void): Promise<{ file_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress<{ file_url: string }>(`${API_BASE_URL}/users/me/avatar`, formData, onProgress);
  },
  changePassword: async (passwordData: PasswordChangeRequest): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/me/password`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(passwordData) });
    await handleResponse<void>(response);
  },
  deleteAccount: async (data: DeleteAccountRequest): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: 'DELETE',
      headers: getApiHeaders(),
      body: JSON.stringify(data),
    });
    await handleResponse<void>(response);
  },
  getPartnerSuggestions: async (): Promise<{users: User[]}> => {
    const response = await fetch(`${API_BASE_URL}/partners/suggestions`, { headers: getApiHeaders() });
    return handleResponse<{users: User[]}>(response);
  },
  getIncomingRequests: async (): Promise<{requests: PartnerRequest[]}> => {
    const response = await fetch(`${API_BASE_URL}/partners/requests/incoming`, { headers: getApiHeaders() });
    return handleResponse<{requests: PartnerRequest[]}>(response);
  },
  getOutgoingRequests: async (): Promise<{requests: PartnerRequest[]}> => {
    const response = await fetch(`${API_BASE_URL}/partners/requests/outgoing`, { headers: getApiHeaders() });
    return handleResponse<{requests: PartnerRequest[]}>(response);
  },
  sendPartnerRequest: async (recipientId: string): Promise<PartnerRequest> => {
    const response = await fetch(`${API_BASE_URL}/partners/request`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ recipient_id: recipientId }) });
    return handleResponse<PartnerRequest>(response);
  },
  respondToPartnerRequest: async (requestId: string, action: 'accept'|'reject'): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/partners/requests/${requestId}/respond`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ action }) });
    return handleResponse<void>(response);
  },
  disconnectPartner: async (): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/partners/me`, { method: 'DELETE', headers: getApiHeaders() });
    await handleResponse<void>(response);
  },
  createOrGetChat: async (recipientId: string): Promise<Chat> => {
    const response = await fetch(`${API_BASE_URL}/chats/`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ recipient_id: recipientId }) });
    return handleResponse<Chat>(response);
  },
  listChats: async (): Promise<{chats: Chat[]}> => {
    const response = await fetch(`${API_BASE_URL}/chats/`, { headers: getApiHeaders() });
    return handleResponse<{chats: Chat[]}>(response);
  },
  getMessages: async (chatId: string, limit = 50, before?: string): Promise<{messages: Message[]}> => {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages?${new URLSearchParams({ limit: String(limit), ...(before && { before_timestamp: before }) })}`, { headers: getApiHeaders() });
    return handleResponse<{messages: Message[]}>(response);
  },
  sendMessageHttp: async (chatId: string, data: Partial<Message>): Promise<Message> => {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(data) });
    return handleResponse<Message>(response);
  },
  toggleReactionHttp: async (messageId: string, emoji: SupportedEmoji): Promise<Message> => {
    const response = await fetch(`${API_BASE_URL}/chats/messages/${messageId}/reactions`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ emoji }) });
    return handleResponse<Message>(response);
  },
  deleteMessageForEveryone: async (messageId: string, chatId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/chats/messages/${messageId}?chat_id=${chatId}`, { method: 'DELETE', headers: getApiHeaders() });
    await handleResponse<void>(response);
  },
  clearChatHistory: async (chatId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/clear`, { method: 'POST', headers: getApiHeaders() });
    await handleResponse<void>(response);
  },
  uploadChatImage: async (file: File, onProgress: (p: number) => void): Promise<{ image_url: string; image_thumbnail_url: string | null; }> => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadWithProgress<{ image_url: string; image_thumbnail_url: string | null; }>(`${API_BASE_URL}/uploads/chat_image`, fd, onProgress);
  },
  uploadMoodClip: async (file: File, type: string, onProgress: (p: number) => void): Promise<{ file_url: string; clip_type: string; }> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('clip_type', type);
    return uploadWithProgress<{ file_url: string; clip_type: string; }>(`${API_BASE_URL}/uploads/mood_clip`, fd, onProgress);
  },
  uploadChatDocument: async (file: File, onProgress: (p: number) => void): Promise<DocumentUploadResponse> => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadWithProgress<DocumentUploadResponse>(`${API_BASE_URL}/uploads/chat_document`, fd, onProgress);
  },
  uploadVoiceMessage: async (file: File, onProgress: (p: number) => void): Promise<VoiceMessageUploadResponse> => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadWithProgress<VoiceMessageUploadResponse>(`${API_BASE_URL}/uploads/voice_message`, fd, onProgress);
  },
  getStickerPacks: async (): Promise<StickerPackResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/packs`, { headers: getApiHeaders() });
    return handleResponse<StickerPackResponse>(response);
  },
  getStickersInPack: async (packId: string): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/pack/${packId}`, { headers: getApiHeaders() });
    return handleResponse<StickerListResponse>(response);
  },
  searchStickers: async (query: string): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/search`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ query }) });
    return handleResponse<StickerListResponse>(response);
  },
  getRecentStickers: async (): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/recent`, { headers: getApiHeaders() });
    return handleResponse<StickerListResponse>(response);
  },
  getFavoriteStickers: async (): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/favorites`, { headers: getApiHeaders() });
    return handleResponse<StickerListResponse>(response);
  },
  toggleFavoriteSticker: async (stickerId: string): Promise<StickerListResponse> => {
    const response = await fetch(`${API_BASE_URL}/stickers/favorites/toggle`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ sticker_id: stickerId }) });
    return handleResponse<StickerListResponse>(response);
  },
  sendThinkingOfYouPing: async (recipientUserId: string): Promise<{status: string}> => {
    const response = await fetch(`${API_BASE_URL}/users/${recipientUserId}/ping-thinking-of-you`, { method: 'POST', headers: getApiHeaders() });
    return handleResponse<{status: string}>(response);
  },
  sendPushSubscriptionToServer: async (sub: PushSubscriptionJSON): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(sub) });
    return await handleResponse(response);
  },
  removePushSubscriptionFromServer: async (endpoint: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/notifications/unsubscribe`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ endpoint }) });
    return await handleResponse(response);
  },
  getNotificationSettings: async (): Promise<NotificationSettings> => {
    const response = await fetch(`${API_BASE_URL}/notifications/settings`, { headers: getApiHeaders() });
    return handleResponse<NotificationSettings>(response);
  },
  updateNotificationSettings: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
    const response = await fetch(`${API_BASE_URL}/notifications/settings`, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify(settings) });
    return handleResponse<NotificationSettings>(response);
  },
  syncEvents: async (since: number): Promise<EventPayload[]> => {
    const response = await fetch(`${API_BASE_URL}/events/sync?since=${since}`, { headers: getApiHeaders() });
    return handleResponse<EventPayload[]>(response);
  },
};
