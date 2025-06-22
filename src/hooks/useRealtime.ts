
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketEventData, Message, MessageAckEventData, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, HeartbeatClientEvent, UserProfileUpdateEventData, ALL_EVENT_TYPES } from '@/types';
import { useToast } from './use-toast';
import { api } from '@/services/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ded3-49-43-230-78.ngrok-free.app';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');
const EVENTS_BASE_URL = API_BASE_URL;

const INITIAL_RECONNECT_INTERVAL = 1000;
const MAX_RECONNECT_INTERVAL = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL = 30000;
const SERVER_ACTIVITY_TIMEOUT = 45000;

export type RealtimeProtocol = 'connecting' | 'websocket' | 'sse' | 'disconnected' | 'fallback';

interface UseRealtimeOptions {
  token: string | null;
  onMessageReceived: (message: Message) => void;
  onReactionUpdate: (data: MessageReactionUpdateEventData) => void;
  onPresenceUpdate: (data: UserPresenceUpdateEventData) => void;
  onTypingUpdate: (data: TypingIndicatorEventData) => void;
  onThinkingOfYouReceived: (data: ThinkingOfYouReceivedEventData) => void;
  onUserProfileUpdate: (data: UserProfileUpdateEventData) => void;
  onMessageAck: (data: MessageAckEventData) => void;
}

const pendingMessages = new Map<string, Record<string, any>>();

export function useRealtime({
  token,
  onMessageReceived, onReactionUpdate, onPresenceUpdate, onTypingUpdate, onThinkingOfYouReceived, onUserProfileUpdate, onMessageAck,
}: UseRealtimeOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const [protocol, setProtocol] = useState<RealtimeProtocol>('disconnected');
  const [isBrowserOnline, setIsBrowserOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const { toast } = useToast();
  
  const reconnectAttemptsRef = useRef(0);
  const cleanupRef = useRef<() => void>(() => {});

  const handleEvent = useCallback((data: WebSocketEventData) => {
    switch (data.event_type) {
      case 'new_message': onMessageReceived((data as NewMessageEventData).message); break;
      case 'message_reaction_update': onReactionUpdate(data as MessageReactionUpdateEventData); break;
      case 'user_presence_update': onPresenceUpdate(data as UserPresenceUpdateEventData); break;
      case 'typing_indicator': onTypingUpdate(data as TypingIndicatorEventData); break;
      case 'thinking_of_you_received': onThinkingOfYouReceived(data as ThinkingOfYouReceivedEventData); break;
      case 'user_profile_update': onUserProfileUpdate(data as UserProfileUpdateEventData); break;
      case 'message_ack': 
        onMessageAck(data as MessageAckEventData);
        pendingMessages.delete(data.client_temp_id);
        break;
      case 'error': toast({ variant: 'destructive', title: 'Server Error', description: data.detail }); break;
    }
  }, [onMessageReceived, onReactionUpdate, onPresenceUpdate, onTypingUpdate, onThinkingOfYouReceived, onUserProfileUpdate, onMessageAck, toast]);

  const connect = useCallback(() => {
    if (!token || !isBrowserOnline) {
      setProtocol('disconnected');
      return;
    }

    cleanupRef.current();
    setProtocol('connecting');
    reconnectAttemptsRef.current = 0;

    let heartbeatInterval: NodeJS.Timeout;
    let activityTimeout: NodeJS.Timeout;

    const resetActivityTimeout = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        console.warn('Realtime: Server activity timeout. Closing connection.');
        wsRef.current?.close(1006, 'Server activity timeout');
      }, SERVER_ACTIVITY_TIMEOUT);
    };

    const startSSEFallback = () => {
        if (!token) return;
        console.log("WebSocket failed. Falling back to SSE.");
        setProtocol('fallback');
        wsRef.current = null;

        const sseUrl = `${EVENTS_BASE_URL}/events/subscribe?token=${encodeURIComponent(token)}`;
        const eventSource = new EventSource(sseUrl, { withCredentials: false });
        sseRef.current = eventSource;

        eventSource.onopen = () => {
            console.log("SSE connection established.");
            setProtocol('sse');
            reconnectAttemptsRef.current = 0;
        };

        eventSource.onerror = (err) => {
            console.error("SSE connection error:", err);
            eventSource.close();
            sseRef.current = null;
            setProtocol('disconnected');
        };
        
        const sseMessageHandler = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data) as WebSocketEventData;
                handleEvent(data);
            } catch (e) {
                console.error("Failed to parse SSE event data:", e);
            }
        };
        
        ALL_EVENT_TYPES.forEach(type => eventSource.addEventListener(type, sseMessageHandler));

        cleanupRef.current = () => {
            console.log("Cleaning up SSE connection.");
            ALL_EVENT_TYPES.forEach(type => eventSource.removeEventListener(type, sseMessageHandler));
            eventSource.close();
            sseRef.current = null;
        };
    };
    
    const wsUrl = `${WS_BASE_URL}/ws/connect?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    
    socket.onopen = () => {
      console.log('WebSocket connected.');
      setProtocol('websocket');
      reconnectAttemptsRef.current = 0;
      resetActivityTimeout();
      if (pendingMessages.size > 0) {
        console.log(`WebSocket: Resending ${pendingMessages.size} pending messages.`);
        pendingMessages.forEach(payload => socket.send(JSON.stringify(payload)));
      }
      heartbeatInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ event_type: "HEARTBEAT" } as HeartbeatClientEvent));
        }
      }, HEARTBEAT_INTERVAL);
    };

    socket.onmessage = (event) => {
        resetActivityTimeout();
        try {
            const data = JSON.parse(event.data as string) as WebSocketEventData;
            handleEvent(data);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    };

    socket.onclose = (event) => {
        console.warn(`WebSocket disconnected. Code: ${event.code}, Clean: ${event.wasClean}`);
        clearInterval(heartbeatInterval);
        clearTimeout(activityTimeout);
        wsRef.current = null;
        
        if (event.code === 1008) {
            setProtocol('disconnected');
            toast({ variant: 'destructive', title: 'Authentication Failed', description: 'Please re-login.' });
            return;
        }

        if (protocol === 'connecting' || !event.wasClean) {
            startSSEFallback();
        } else {
            setProtocol('disconnected');
        }
    };

    cleanupRef.current = () => {
        console.log("Cleaning up WebSocket connection.");
        clearInterval(heartbeatInterval);
        clearTimeout(activityTimeout);
        if(socket && socket.readyState !== WebSocket.CLOSED) {
           socket.close(1000, 'Client initiated cleanup');
        }
        wsRef.current = null;
    };
  }, [token, isBrowserOnline, handleEvent, toast, protocol]);

  const sendMessage = useCallback((payload: Record<string, any>) => {
    if (payload.event_type === 'send_message' && payload.client_temp_id) {
        pendingMessages.set(payload.client_temp_id, payload);
    }
    
    if (protocol === 'websocket' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else if (protocol === 'sse' && payload.event_type !== 'start_typing' && payload.event_type !== 'stop_typing') {
      // Send via HTTP for SSE, but ignore transient events like typing
      if (payload.event_type === 'send_message') {
          const { chat_id, ...messageData } = payload;
          api.sendMessageHttp(chat_id, messageData).catch(err => {
              toast({ variant: 'destructive', title: 'Send Failed (HTTP)', description: err.message });
              pendingMessages.delete(payload.client_temp_id);
          });
      } else {
           console.warn(`Cannot send event type "${payload.event_type}" over SSE/HTTP channel.`);
      }
    } else if (protocol !== 'websocket' && protocol !== 'sse') {
        toast({ variant: 'destructive', title: 'Not Connected', description: 'Cannot send message. Please check your connection.' });
        // Message remains in pending queue
    }
  }, [protocol, toast]);

  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      if (!wsRef.current && !sseRef.current) connect();
    };
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (token) connect();
    
    return () => {
      cleanupRef.current();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { protocol, sendMessage, isBrowserOnline };
}
