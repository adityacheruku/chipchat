
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
  // Handle successful responses with no content first.
  if (response.status === 204) {
    return {} as T;
  }

  // Handle error responses (non-2xx).
  if (!response.ok) {
    let errorData: ApiErrorResponse = { detail: `HTTP error ${response.status}` };
    try {
      // Try to parse the error response as JSON, as this is the expected format.
      errorData = await response.json();
    } catch (e) {
      // If parsing fails, it's not a JSON error. The status itself is the best info we have.
      // The default errorData message is sufficient.
    }
    
    // Extract a clean error message from the JSON detail if possible.
    const errorMessage = typeof errorData.detail === 'string'
      ? errorData.detail
      : Array.isArray(errorData.detail) && errorData.detail[0]?.msg
      ? errorData.detail[0].msg
      : `HTTP error ${response.status}`;
      
    throw new Error(errorMessage);
  }

  // Handle successful (2xx) responses.
  try {
    // For successful responses, we expect JSON.
    return await response.json() as T;
  } catch (e) {
    // This can happen if a 200 OK has an empty body, which is valid.
    // Treat it like a 204 No Content.
    return {} as T;
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
  sendOtp: (phone: string) => handleResponse<{message: string}>(fetch(`${API_BASE_URL}/auth/send-otp`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify({ phone }) })),
  verifyOtp: (phone: string, otp: string) => handleResponse<VerifyOtpResponse>(fetch(`${API_BASE_URL}/auth/verify-otp`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify({ phone, otp }) })),
  completeRegistration: (userData: CompleteRegistrationRequest) => handleResponse<AuthResponse>(fetch(`${API_BASE_URL}/auth/complete-registration`, { method: 'POST', headers: getApiHeaders({ includeAuth: false }), body: JSON.stringify(userData) })),
  getCurrentUserProfile: () => handleResponse<UserInToken>(fetch(`${API_BASE_URL}/users/me`, { headers: getApiHeaders() })),
  getUserProfile: (userId: string) => handleResponse<User>(fetch(`${API_BASE_URL}/users/${userId}`, { headers: getApiHeaders() })),
  updateUserProfile: (data: Partial<User>) => handleResponse<UserInToken>(fetch(`${API_BASE_URL}/users/me/profile`, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify(data) })),
  uploadAvatar: (file: File, onProgress: (p: number) => void) => uploadWithProgress(`${API_BASE_URL}/users/me/avatar`, new FormData().append('file', file) && new FormData(), onProgress),
  changePassword: (passwordData: PasswordChangeRequest) => handleResponse<void>(fetch(`${API_BASE_URL}/users/me/password`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(passwordData) })),
  getPartnerSuggestions: () => handleResponse<{users: User[]}>(fetch(`${API_BASE_URL}/partners/suggestions`, { headers: getApiHeaders() })),
  getIncomingRequests: () => handleResponse<{requests: PartnerRequest[]}>(fetch(`${API_BASE_URL}/partners/requests/incoming`, { headers: getApiHeaders() })),
  getOutgoingRequests: () => handleResponse<{requests: PartnerRequest[]}>(fetch(`${API_BASE_URL}/partners/requests/outgoing`, { headers: getApiHeaders() })),
  sendPartnerRequest: (recipientId: string) => handleResponse<PartnerRequest>(fetch(`${API_BASE_URL}/partners/request`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ recipient_id: recipientId }) })),
  respondToPartnerRequest: (requestId: string, action: 'accept'|'reject') => handleResponse<void>(fetch(`${API_BASE_URL}/partners/requests/${requestId}/respond`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ action }) })),
  disconnectPartner: () => handleResponse<void>(fetch(`${API_BASE_URL}/partners/me`, { method: 'DELETE', headers: getApiHeaders() })),
  createOrGetChat: (recipientId: string) => handleResponse<Chat>(fetch(`${API_BASE_URL}/chats/`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ recipient_id: recipientId }) })),
  listChats: () => handleResponse<{chats: Chat[]}>(fetch(`${API_BASE_URL}/chats/`, { headers: getApiHeaders() })),
  getMessages: (chatId: string, limit = 50, before?: string) => handleResponse<{messages: Message[]}>(fetch(`${API_BASE_URL}/chats/${chatId}/messages?${new URLSearchParams({ limit: String(limit), ...(before && { before_timestamp: before }) })}`, { headers: getApiHeaders() })),
  sendMessageHttp: (chatId: string, data: Partial<Message>) => handleResponse<Message>(fetch(`${API_BASE_URL}/chats/${chatId}/messages`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(data) })),
  toggleReactionHttp: (messageId: string, emoji: SupportedEmoji) => handleResponse<Message>(fetch(`${API_BASE_URL}/chats/messages/${messageId}/reactions`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ emoji }) })),
  deleteMessageForEveryone: (messageId: string, chatId: string) => handleResponse<void>(fetch(`${API_BASE_URL}/chats/messages/${messageId}?chat_id=${chatId}`, { method: 'DELETE', headers: getApiHeaders() })),
  uploadChatImage: (file: File, onProgress: (p: number) => void) => { const fd = new FormData(); fd.append('file', file); return uploadWithProgress(`${API_BASE_URL}/uploads/chat_image`, fd, onProgress); },
  uploadMoodClip: (file: File, type: string, onProgress: (p: number) => void) => { const fd = new FormData(); fd.append('file', file); fd.append('clip_type', type); return uploadWithProgress(`${API_BASE_URL}/uploads/mood_clip`, fd, onProgress); },
  uploadChatDocument: (file: File, onProgress: (p: number) => void) => { const fd = new FormData(); fd.append('file', file); return uploadWithProgress<DocumentUploadResponse>(`${API_BASE_URL}/uploads/chat_document`, fd, onProgress); },
  uploadVoiceMessage: (file: File, onProgress: (p: number) => void) => { const fd = new FormData(); fd.append('file', file); return uploadWithProgress<VoiceMessageUploadResponse>(`${API_BASE_URL}/uploads/voice_message`, fd, onProgress); },
  getStickerPacks: () => handleResponse<StickerPackResponse>(fetch(`${API_BASE_URL}/stickers/packs`, { headers: getApiHeaders() })),
  getStickersInPack: (packId: string) => handleResponse<StickerListResponse>(fetch(`${API_BASE_URL}/stickers/pack/${packId}`, { headers: getApiHeaders() })),
  searchStickers: (query: string) => handleResponse<StickerListResponse>(fetch(`${API_BASE_URL}/stickers/search`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ query }) })),
  getRecentStickers: () => handleResponse<StickerListResponse>(fetch(`${API_BASE_URL}/stickers/recent`, { headers: getApiHeaders() })),
  getFavoriteStickers: () => handleResponse<StickerListResponse>(fetch(`${API_BASE_URL}/stickers/favorites`, { headers: getApiHeaders() })),
  toggleFavoriteSticker: (stickerId: string) => handleResponse<StickerListResponse>(fetch(`${API_BASE_URL}/stickers/favorites/toggle`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ sticker_id: stickerId }) })),
  sendThinkingOfYouPing: (recipientUserId: string) => handleResponse<{status: string}>(fetch(`${API_BASE_URL}/users/${recipientUserId}/ping-thinking-of-you`, { method: 'POST', headers: getApiHeaders() })),
  sendPushSubscriptionToServer: (sub: PushSubscriptionJSON) => handleResponse(fetch(`${API_BASE_URL}/notifications/subscribe`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(sub) })),
  removePushSubscriptionFromServer: (endpoint: string) => handleResponse(fetch(`${API_BASE_URL}/notifications/unsubscribe`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ endpoint }) })),
  getNotificationSettings: () => handleResponse<NotificationSettings>(fetch(`${API_BASE_URL}/notifications/settings`, { headers: getApiHeaders() })),
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => handleResponse<NotificationSettings>(fetch(`${API_BASE_URL}/notifications/settings`, { method: 'PUT', headers: getApiHeaders(), body: JSON.stringify(settings) })),
  syncEvents: (since: number) => handleResponse<EventPayload[]>(fetch(`${API_BASE_URL}/events/sync?since=${since}`, { headers: getApiHeaders() })),
};
