
"use client";

import type { Message, MessageAckEventData, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, UserProfileUpdateEventData, EventPayload, ChatModeChangedEventData, MessageDeletedEventData, ChatHistoryClearedEventData } from '@/types';
import { api } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
const EVENTS_BASE_URL = API_BASE_URL;

const HEARTBEAT_INTERVAL = 30000;
const SERVER_ACTIVITY_TIMEOUT = 45000;
const LAST_SEQUENCE_KEY = 'chirpChat_lastSequence';
const RECONNECT_DELAY_MS = 5000;

export type RealtimeProtocol = 'connecting' | 'websocket' | 'sse' | 'disconnected' | 'fallback' | 'syncing';
type EventListener = (eventType: string, data: any) => void;

class RealtimeService {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private protocol: RealtimeProtocol = 'disconnected';
  private token: string | null = null;
  private lastSequence: number = 0;
  private isSyncing: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private activityTimeout: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<EventListener> = new Set();
  private pendingMessages = new Map<string, Record<string, any>>();

  constructor() { if (typeof window !== 'undefined') { this.lastSequence = parseInt(localStorage.getItem(LAST_SEQUENCE_KEY) || '0', 10); window.addEventListener('online', this.handleOnline); window.addEventListener('offline', this.handleOffline); }}
  public connect(authToken: string) { if (this.protocol !== 'disconnected' && this.token === authToken) return; this.token = authToken; this.startConnectionSequence(); }
  public disconnect() { this.token = null; this.cleanup(); this.setProtocol('disconnected'); }
  public sendMessage = (payload: Record<string, any>) => {
    if (payload.event_type === 'send_message' && payload.client_temp_id) this.pendingMessages.set(payload.client_temp_id, payload);
    if (this.protocol === 'websocket' && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
    else if (this.protocol === 'sse' || this.protocol === 'fallback') {
      const { chat_id, ...messageData } = payload;
      if (payload.event_type === 'send_message') api.sendMessageHttp(chat_id, messageData).catch(err => this.emit('error', { title: 'Send Failed', description: err.message }));
      else if (payload.event_type === 'ping_thinking_of_you') api.sendThinkingOfYouPing(payload.recipient_user_id).catch(err => this.emit('error', { title: 'Ping Failed', description: err.message }));
      else if (payload.event_type === 'toggle_reaction') api.toggleReactionHttp(payload.message_id, payload.emoji).catch(err => this.emit('error', { title: 'Reaction Failed', description: err.message }));
    } else this.emit('error', { title: 'Not Connected', description: 'Cannot send message.' });
  }
  public subscribe(l: EventListener) { this.listeners.add(l); l('protocol-change', this.protocol); }
  public unsubscribe(l: EventListener) { this.listeners.delete(l); }
  public getProtocol = () => this.protocol;

  private setProtocol(p: RealtimeProtocol) { if (this.protocol !== p) { this.protocol = p; this.emit('protocol-change', p); }}
  private emit(event: string, data: any) { this.listeners.forEach(l => l(event, data)); }
  private handleEvent(data: EventPayload) {
    if (data.sequence && data.sequence > this.lastSequence) { this.lastSequence = data.sequence; localStorage.setItem(LAST_SEQUENCE_KEY, String(data.sequence)); }
    if (data.event_type === 'message_ack' && data.client_temp_id) this.pendingMessages.delete(data.client_temp_id);
    this.emit('event', data);
  }
  private async syncEvents() {
    if (this.isSyncing) return; this.isSyncing = true; this.setProtocol('syncing');
    try { const events = await api.syncEvents(this.lastSequence); if (events?.length > 0) events.forEach(e => this.handleEvent(e));
    } catch (error: any) { this.emit('error', { title: 'Sync Failed', description: 'Could not retrieve missed messages.' });
    } finally { this.isSyncing = false; }
  }
  private startConnectionSequence = () => { if (!this.token || (typeof navigator !== 'undefined' && !navigator.onLine)) { this.setProtocol('disconnected'); return; } this.cleanup(); this.setProtocol('connecting'); this.connectWebSocket(); };
  private connectWebSocket() {
    if (!this.token) return; this.ws = new WebSocket(`${WS_BASE_URL}/ws/connect?token=${encodeURIComponent(this.token)}`);
    this.ws.onopen = async () => { await this.syncEvents(); this.setProtocol('websocket'); this.resetActivityTimeout(); this.startHeartbeat(); if (this.pendingMessages.size > 0) this.pendingMessages.forEach(p => this.ws?.send(JSON.stringify(p))); };
    this.ws.onmessage = (event) => { this.resetActivityTimeout(); const data = JSON.parse(event.data); if (data.event_type !== 'heartbeat_ack') this.handleEvent(data); };
    this.ws.onerror = () => {};
    this.ws.onclose = (event) => { this.stopHeartbeat(); this.ws = null; if (event.code === 1008) { this.emit('auth-error', { detail: 'Authentication failed' }); this.disconnect(); return; } if (this.token) this.connectSSE(); };
  }
  private connectSSE = async () => {
    if (!this.token) return; this.setProtocol('fallback'); this.sse = new EventSource(`${EVENTS_BASE_URL}/events/subscribe?token=${encodeURIComponent(this.token)}`);
    this.sse.onopen = async () => { await this.syncEvents(); this.setProtocol('sse'); };
    this.sse.onerror = () => { if (this.protocol !== 'disconnected') { this.sse?.close(); this.sse = null; this.scheduleReconnect(); }};
    this.sse.addEventListener("auth_error", () => { this.emit('auth-error', { detail: 'Authentication failed' }); this.disconnect(); });
    const ALL_EVENT_TYPES: Array<EventPayload['event_type']> = ["new_message", "message_deleted", "message_reaction_update", "user_presence_update", "typing_indicator", "thinking_of_you_received", "user_profile_update", "message_ack", "error", "chat_mode_changed", "chat_history_cleared"];
    ALL_EVENT_TYPES.forEach(type => this.sse?.addEventListener(type, (event: MessageEvent) => this.handleEvent(JSON.parse(event.data))));
  }
  private scheduleReconnect = () => { this.setProtocol('disconnected'); if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout); this.reconnectTimeout = setTimeout(() => { if(this.token) this.startConnectionSequence(); }, RECONNECT_DELAY_MS); }
  private startHeartbeat() { this.stopHeartbeat(); this.heartbeatInterval = setInterval(() => { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ event_type: "HEARTBEAT" })); }, HEARTBEAT_INTERVAL); }
  private stopHeartbeat() { if (this.heartbeatInterval) clearInterval(this.heartbeatInterval); }
  private resetActivityTimeout = () => { if(this.activityTimeout) clearTimeout(this.activityTimeout); this.activityTimeout = setTimeout(() => this.ws?.close(), SERVER_ACTIVITY_TIMEOUT); };
  private cleanup = () => { this.stopHeartbeat(); if(this.activityTimeout) clearTimeout(this.activityTimeout); if(this.reconnectTimeout) clearTimeout(this.reconnectTimeout); if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; } if (this.sse) { this.sse.close(); this.sse = null; }}
  private handleOnline = () => { if (this.protocol === 'disconnected') this.startConnectionSequence(); };
  private handleOffline = () => { this.cleanup(); this.setProtocol('disconnected'); };
}

export const realtimeService = new RealtimeService();
