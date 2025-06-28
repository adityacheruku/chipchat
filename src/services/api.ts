
import type {
  AuthResponse, User, UserInToken, Chat, Message, ApiErrorResponse, SupportedEmoji,
  VoiceMessageUploadResponse, StickerPackResponse, StickerListResponse, PushSubscriptionJSON,
  NotificationSettings, PartnerRequest, EventPayload, VerifyOtpResponse,
  CompleteRegistrationRequest, DocumentUploadResponse, PasswordChangeRequest
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
  sendOtp: async (phone: string) => handleResponse<{message: string}>(await fetch(`${API_BASE_URL}/auth/send-otp`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify({ phone }) })),
  verifyOtp: async (phone: string, otp: string) => handleResponse<VerifyOtpResponse>(await fetch(`${API_BASE_URL}/auth/verify-otp`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify({ phone, otp }) })),
  completeRegistration: async (userData: CompleteRegistrationRequest) => handleResponse<AuthResponse>(await fetch(`${API_BASE_URL}/auth/complete-registration`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify(userData) })),
  getCurrentUserProfile: async () => handleResponse<UserInToken>(await fetch(`${API_BASE_URL}/users/me`, { headers: getApiHeaders() })),
  getUserProfile: async (userId: string) => handleResponse<User>(await fetch(`${API_BASE_URL}/users/${userId}`, { headers: getApiHeaders() })),
  updateUserProfile: async (data: Partial<User>) => handleResponse<UserInToken>(await fetch(`${API_BASE_URL}/users/me/profile`, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify(data) })),
  uploadAvatar: async (file: File, onProgress: (p: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress(`${API_BASE_URL}/users/me/avatar`, formData, onProgress);
  },
  changePassword: async (passwordData: PasswordChangeRequest) => handleResponse<void>(await fetch(`${API_BASE_URL}/users/me/password`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(passwordData) })),
  getPartnerSuggestions: async () => handleResponse<{users: User[]}>(await fetch(`${API_BASE_URL}/partners/suggestions`, { headers: getApiHeaders() })),
  getIncomingRequests: async () => handleResponse<{requests: PartnerRequest[]}>(await fetch(`${API_BASE_URL}/partners/requests/incoming`, { headers: getApiHeaders() })),
  getOutgoingRequests: async () => handleResponse<{requests: PartnerRequest[]}>(await fetch(`${API_BASE_URL}/partners/requests/outgoing`, { headers: getApiHeaders() })),
  sendPartnerRequest: async (recipientId: string) => handleResponse<PartnerRequest>(await fetch(`${API_BASE_URL}/partners/request`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ recipient_id: recipientId }) })),
  respondToPartnerRequest: async (requestId: string, action: 'accept'|'reject') => handleResponse<void>(await fetch(`${API_BASE_URL}/partners/requests/${requestId}/respond`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ action }) })),
  disconnectPartner: async () => handleResponse<void>(await fetch(`${API_BASE_URL}/partners/me`, { method: 'DELETE', headers: getApiHeaders() })),
  createOrGetChat: async (recipientId: string) => handleResponse<Chat>(await fetch(`${API_BASE_URL}/chats/`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ recipient_id: recipientId }) })),
  listChats: async () => handleResponse<{chats: Chat[]}>(await fetch(`${API_BASE_URL}/chats/`, { headers: getApiHeaders() })),
  getMessages: async (chatId: string, limit = 50, before?: string) => handleResponse<{messages: Message[]}>(await fetch(`${API_BASE_URL}/chats/${chatId}/messages?${new URLSearchParams({ limit: String(limit), ...(before && { before_timestamp: before }) })}`, { headers: getApiHeaders() })),
  sendMessageHttp: async (chatId: string, data: Partial<Message>) => handleResponse<Message>(await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(data) })),
  toggleReactionHttp: async (messageId: string, emoji: SupportedEmoji) => handleResponse<Message>(await fetch(`${API_BASE_URL}/chats/messages/${messageId}/reactions`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ emoji }) })),
  deleteMessageForEveryone: async (messageId: string, chatId: string) => handleResponse<void>(await fetch(`${API_BASE_URL}/chats/messages/${messageId}?chat_id=${chatId}`, { method: 'DELETE', headers: getApiHeaders() })),
  uploadChatImage: async (file: File, onProgress: (p: number) => void) => { const fd = new FormData(); fd.append('file', file); return uploadWithProgress(`${API_BASE_URL}/uploads/chat_image`, fd, onProgress); },
  uploadMoodClip: async (file: File, type: string, onProgress: (p: number) => void) => { const fd = new FormData(); fd.append('file', file); fd.append('clip_type', type); return uploadWithProgress(`${API_BASE_URL}/uploads/mood_clip`, fd, onProgress); },
  uploadChatDocument: async (file: File, onProgress: (p: number) => void) => { const fd = new FormData(); fd.append('file', file); return uploadWithProgress<DocumentUploadResponse>(`${API_BASE_URL}/uploads/chat_document`, fd, onProgress); },
  uploadVoiceMessage: async (file: File, onProgress: (p: number) => void) => { const fd = new FormData(); fd.append('file', file); return uploadWithProgress<VoiceMessageUploadResponse>(`${API_BASE_URL}/uploads/voice_message`, fd, onProgress); },
  getStickerPacks: async () => handleResponse<StickerPackResponse>(await fetch(`${API_BASE_URL}/stickers/packs`, { headers: getApiHeaders() })),
  getStickersInPack: async (packId: string) => handleResponse<StickerListResponse>(await fetch(`${API_BASE_URL}/stickers/pack/${packId}`, { headers: getApiHeaders() })),
  searchStickers: async (query: string) => handleResponse<StickerListResponse>(await fetch(`${API_BASE_URL}/stickers/search`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ query }) })),
  getRecentStickers: async () => handleResponse<StickerListResponse>(await fetch(`${API_BASE_URL}/stickers/recent`, { headers: getApiHeaders() })),
  getFavoriteStickers: async () => handleResponse<StickerListResponse>(await fetch(`${API_BASE_URL}/stickers/favorites`, { headers: getApiHeaders() })),
  toggleFavoriteSticker: async (stickerId: string) => handleResponse<StickerListResponse>(await fetch(`${API_BASE_URL}/stickers/favorites/toggle`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ sticker_id: stickerId }) })),
  sendThinkingOfYouPing: async (recipientUserId: string) => handleResponse<{status: string}>(await fetch(`${API_BASE_URL}/users/${recipientUserId}/ping-thinking-of-you`, { method: 'POST', headers: getApiHeaders() })),
  sendPushSubscriptionToServer: async (sub: PushSubscriptionJSON) => handleResponse(await fetch(`${API_BASE_URL}/notifications/subscribe`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(sub) })),
  removePushSubscriptionFromServer: async (endpoint: string) => handleResponse(await fetch(`${API_BASE_URL}/notifications/unsubscribe`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ endpoint }) })),
  getNotificationSettings: async () => handleResponse<NotificationSettings>(await fetch(`${API_BASE_URL}/notifications/settings`, { headers: getApiHeaders() })),
  updateNotificationSettings: async (settings: Partial<NotificationSettings>) => handleResponse<NotificationSettings>(await fetch(`${API_BASE_URL}/notifications/settings`, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify(settings) })),
  syncEvents: async (since: number) => handleResponse<EventPayload[]>(await fetch(`${API_BASE_URL}/events/sync?since=${since}`, { headers: getApiHeaders() })),
};
