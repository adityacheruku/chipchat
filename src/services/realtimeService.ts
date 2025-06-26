
"use client";

import type { Message, WebSocketEventData, MessageAckEventData, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, UserProfileUpdateEventData, HeartbeatClientEvent, EventPayload, ChatModeChangedEventData } from '@/types';
import { api } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ef9e-49-43-230-78.ngrok-free.app';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
const EVENTS_BASE_URL = API_BASE_URL;

const HEARTBEAT_INTERVAL = 30000;
const SERVER_ACTIVITY_TIMEOUT = 45000;
const LAST_SEQUENCE_KEY = 'chirpChat_lastSequence';
const RECONNECT_DELAY_MS = 5000;

export type RealtimeProtocol = 'connecting' | 'websocket' | 'sse' | 'disconnected' | 'fallback' | 'syncing';

type EventListener = (eventType: string, data: any) => void;
const listeners: Set<EventListener> = new Set();
const pendingMessages = new Map<string, Record<string, any>>();


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

  constructor() {
    if (typeof window !== 'undefined') {
      const storedSeq = localStorage.getItem(LAST_SEQUENCE_KEY);
      this.lastSequence = storedSeq ? parseInt(storedSeq, 10) : 0;

      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  // --- Public API ---

  public connect(authToken: string) {
    if (this.protocol !== 'disconnected' && this.token === authToken) {
      return; // Already connected or connecting with the same token
    }
    this.token = authToken;
    this.startConnectionSequence();
  }

  public disconnect() {
    this.token = null;
    this.cleanup();
    this.setProtocol('disconnected');
  }

  public sendMessage = (payload: Record<string, any>) => {
    if (payload.event_type === 'send_message' && payload.client_temp_id) {
        pendingMessages.set(payload.client_temp_id, payload);
    }
    
    if (this.protocol === 'websocket' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else if (this.protocol === 'sse' && payload.event_type !== 'start_typing' && payload.event_type !== 'stop_typing') {
      if (payload.event_type === 'send_message') {
          const { chat_id, ...messageData } = payload;
          api.sendMessageHttp(chat_id, messageData).catch(err => {
              this.emit('error', { title: 'Send Failed (HTTP)', description: err.message });
              pendingMessages.delete(payload.client_temp_id);
          });
      } else {
           console.warn(`Cannot send event type "${payload.event_type}" over SSE/HTTP channel.`);
      }
    } else if (this.protocol !== 'websocket' && this.protocol !== 'sse') {
        this.emit('error', { title: 'Not Connected', description: 'Cannot send message. Please check your connection.' });
    }
  }

  public subscribe(listener: EventListener) {
    listeners.add(listener);
    // Immediately notify the new subscriber of the current status
    listener('protocol-change', this.protocol);
  }

  public unsubscribe(listener: EventListener) {
    listeners.delete(listener);
  }

  public getProtocol(): RealtimeProtocol {
    return this.protocol;
  }

  // --- Internal Logic ---

  private setProtocol(newProtocol: RealtimeProtocol) {
    if (this.protocol !== newProtocol) {
      this.protocol = newProtocol;
      this.emit('protocol-change', this.protocol);
    }
  }

  private emit(eventType: string, data: any) {
    listeners.forEach(listener => listener(eventType, data));
  }

  private handleEvent(data: EventPayload) {
    if (data.sequence && data.sequence > this.lastSequence) {
        this.lastSequence = data.sequence;
        if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_SEQUENCE_KEY, String(data.sequence));
        }
    }
    
    if (data.event_type === 'message_ack') {
        pendingMessages.delete(data.client_temp_id);
    }
    
    this.emit('event', data);
  }

  private async syncEvents() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.setProtocol('syncing');
    try {
        const missedEvents = await api.syncEvents(this.lastSequence);
        if (missedEvents && missedEvents.length > 0) {
            console.log(`Sync: processing ${missedEvents.length} missed events.`);
            missedEvents.forEach(event => this.handleEvent(event));
        }
    } catch (error: any) {
        console.error("Failed to sync events:", error);
        this.emit('error', { title: 'Sync Failed', description: 'Could not retrieve missed messages.' });
    } finally {
        this.isSyncing = false;
    }
  }

  private startConnectionSequence = () => {
    if (!this.token || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      this.setProtocol('disconnected');
      return;
    }

    this.cleanup();
    this.setProtocol('connecting');
    this.connectWebSocket();
  };

  private connectWebSocket() {
    if (!this.token) return;
    const wsUrl = `${WS_BASE_URL}/ws/connect?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = async () => {
      await this.syncEvents();
      this.setProtocol('websocket');
      this.resetActivityTimeout();
      this.startHeartbeat();
      if (pendingMessages.size > 0) {
        console.log(`WebSocket: Resending ${pendingMessages.size} pending messages.`);
        pendingMessages.forEach(payload => this.ws?.send(JSON.stringify(payload)));
      }
    };

    this.ws.onmessage = (event) => {
      this.resetActivityTimeout();
      try {
        const data = JSON.parse(event.data as string) as EventPayload;
        if (data.event_type === 'heartbeat_ack') {
            return; // It's just a keep-alive, do nothing else.
        }
        this.handleEvent(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      // onclose will handle the fallback
    };
    
    this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.ws = null;
        if (event.code === 1008) { // Policy Violation - auth failed
            this.emit('auth-error');
            this.disconnect();
            return;
        }
        if (this.token) { // If token is null, it means disconnect was intentional
          this.connectSSE();
        }
    };
  }

  private connectSSE = async () => {
    if (!this.token) return;
    console.log("WebSocket failed. Falling back to SSE.");
    
    this.setProtocol('sse');
    const sseUrl = `${EVENTS_BASE_URL}/events/subscribe?token=${encodeURIComponent(this.token)}`;
    this.sse = new EventSource(sseUrl, { withCredentials: false });

    this.sse.onopen = async () => {
      console.log("SSE connection established.");
      await this.syncEvents();
      this.setProtocol('sse'); // Move back to SSE state after sync
    };

    this.sse.onerror = (err) => {
      console.error("SSE connection error:", err);
      // Don't fall back here if the error is due to auth failure,
      // as the 'auth_error' event will handle it.
      if (this.protocol !== 'disconnected') {
        this.sse?.close();
        this.sse = null;
        this.scheduleReconnect();
      }
    };
    
    this.sse.addEventListener("auth_error", (event: MessageEvent) => {
        console.error("SSE Authentication failed via event.");
        this.emit('auth-error');
        this.disconnect(); // This will close the SSE connection and reset state
    });

    this.sse.addEventListener("sse_connected", (event: MessageEvent) => {
        // This confirms the generator has started successfully on the backend.
        console.log("SSE stream connected by server:", event.data);
    });

    const sseMessageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as EventPayload;
        this.handleEvent(data);
      } catch (e) {
        console.error("Failed to parse SSE event data:", e);
      }
    };

    // Use a set of known event types to add listeners
    const ALL_EVENT_TYPES = ["new_message", "message_reaction_update", "user_presence_update", "typing_indicator", "thinking_of_you_received", "user_profile_update", "message_ack", "error", "ping", "chat_mode_changed"];
    ALL_EVENT_TYPES.forEach(type => this.sse?.addEventListener(type, sseMessageHandler));
  }

  private scheduleReconnect = () => {
    this.setProtocol('disconnected');
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
        if(this.token) this.startConnectionSequence();
    }, RECONNECT_DELAY_MS);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event_type: "HEARTBEAT" } as HeartbeatClientEvent));
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }

  private resetActivityTimeout = () => {
    if(this.activityTimeout) clearTimeout(this.activityTimeout);
    this.activityTimeout = setTimeout(() => {
      console.warn('Realtime: Server activity timeout. Closing connection.');
      this.ws?.close(1000, 'Server activity timeout'); // Use valid close code
    }, SERVER_ACTIVITY_TIMEOUT);
  };

  private cleanup = () => {
    this.stopHeartbeat();
    if(this.activityTimeout) clearTimeout(this.activityTimeout);
    if(this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    
    if (this.ws) {
        this.ws.onclose = null; // Prevent onclose handler from firing during manual cleanup
        this.ws.close(1000, 'Client initiated cleanup');
        this.ws = null;
    }
    if (this.sse) {
        this.sse.close();
        this.sse = null;
    }
  };
  
  private handleOnline = () => {
    console.log("Browser is online.");
    if (this.protocol === 'disconnected') {
      this.startConnectionSequence();
    }
  };
  
  private handleOffline = () => {
    console.log("Browser is offline.");
    this.cleanup();
    this.setProtocol('disconnected');
  };
}

export const realtimeService = new RealtimeService();
