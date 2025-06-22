
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketEventData, Message, MessageAckEventData, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, HeartbeatClientEvent, UserProfileUpdateEventData } from '@/types';
import { useToast } from './use-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://a93b-49-43-230-78.ngrok-free.app';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

const INITIAL_RECONNECT_INTERVAL = 1000;
const MAX_RECONNECT_INTERVAL = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const SERVER_ACTIVITY_TIMEOUT = 45000; // Expect server activity within 45s

interface UseWebSocketOptions {
  token: string | null;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onMessageReceived: (message: Message) => void;
  onReactionUpdate: (data: MessageReactionUpdateEventData) => void;
  onPresenceUpdate: (data: UserPresenceUpdateEventData) => void;
  onTypingUpdate: (data: TypingIndicatorEventData) => void;
  onThinkingOfYouReceived: (data: ThinkingOfYouReceivedEventData) => void;
  onUserProfileUpdate: (data: UserProfileUpdateEventData) => void;
  onMessageAck: (data: MessageAckEventData) => void;
}

// Queue for messages waiting for ACK
const pendingMessages = new Map<string, Record<string, any>>();

export function useWebSocket({
  token,
  onOpen,
  onClose,
  onMessageReceived,
  onReactionUpdate,
  onPresenceUpdate,
  onTypingUpdate,
  onThinkingOfYouReceived,
  onUserProfileUpdate,
  onMessageAck,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isBrowserOnline, setIsBrowserOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const { toast } = useToast();
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const serverActivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetServerActivityTimeout = useCallback(() => {
    if (serverActivityTimeoutRef.current) {
      clearTimeout(serverActivityTimeoutRef.current);
    }
    serverActivityTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.warn('WebSocket: Server activity timeout. Closing connection.');
        wsRef.current.close(1006, 'Server activity timeout');
      }
    }, SERVER_ACTIVITY_TIMEOUT);
  }, []);

  const clearAllTimeouts = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (serverActivityTimeoutRef.current) clearTimeout(serverActivityTimeoutRef.current);
    reconnectTimeoutRef.current = null;
    heartbeatIntervalRef.current = null;
    serverActivityTimeoutRef.current = null;
  }, []);

  const sendMessage = useCallback((payload: Record<string, any>) => {
    if (payload.event_type === 'send_message' && payload.client_temp_id) {
        pendingMessages.set(payload.client_temp_id, payload);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      if (payload.event_type !== "HEARTBEAT") {
          resetServerActivityTimeout();
      }
    } else {
      console.error('WebSocket not connected. Message queued:', payload.event_type);
      // The message is already in the pending queue, it will be sent on reconnect.
    }
  }, [resetServerActivityTimeout]);

  const connect = useCallback(() => {
    if (!token || (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED)) {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
             console.log(`WebSocket: Connection attempt skipped. State: ${wsRef.current.readyState}`);
        }
        return;
    }

    if (!isBrowserOnline) {
        console.warn('WebSocket: Browser is offline. Delaying connection attempt.');
        return;
    }
    
    clearAllTimeouts();

    console.log('WebSocket: Attempting to connect...');
    const wsUrl = `${WS_BASE_URL}/ws/connect?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      onOpen?.();

      // Resend any pending messages
      if (pendingMessages.size > 0) {
        console.log(`WebSocket: Resending ${pendingMessages.size} pending messages.`);
        pendingMessages.forEach(payload => {
          socket.send(JSON.stringify(payload));
        });
      }
      
      heartbeatIntervalRef.current = setInterval(() => {
        sendMessage({ event_type: "HEARTBEAT" } as HeartbeatClientEvent);
      }, HEARTBEAT_INTERVAL);
      resetServerActivityTimeout();
    };

    socket.onmessage = (event) => {
      resetServerActivityTimeout();
      try {
        const data = JSON.parse(event.data as string) as WebSocketEventData;
        switch (data.event_type) {
          case 'new_message': onMessageReceived((data as NewMessageEventData).message); break;
          case 'message_reaction_update': onReactionUpdate(data as MessageReactionUpdateEventData); break;
          case 'user_presence_update': onPresenceUpdate(data as UserPresenceUpdateEventData); break;
          case 'typing_indicator': onTypingUpdate(data as TypingIndicatorEventData); break;
          case 'thinking_of_you_received': onThinkingOfYouReceived(data as ThinkingOfYouReceivedEventData); break;
          case 'user_profile_update': onUserProfileUpdate(data as UserProfileUpdateEventData); break;
          case 'message_ack':
            onMessageAck(data as MessageAckEventData);
            pendingMessages.delete(data.client_temp_id); // Remove from queue on ACK
            break;
          case 'error': toast({ variant: 'destructive', title: 'WebSocket Server Error', description: data.detail }); break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message or handle event:', error);
        toast({ variant: 'destructive', title: 'WebSocket Error', description: 'Received unparseable message.' });
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error event:', error);
    };

    socket.onclose = (event) => {
      console.warn(`WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
      setIsConnected(false);
      clearAllTimeouts();
      wsRef.current = null;
      onClose?.(event);

      if (event.code === 1008) {
        toast({ variant: 'destructive', title: 'Connection Rejected', description: 'Authentication problem. Please re-login.' });
        return;
      }
      
      if (token && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && isBrowserOnline) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(INITIAL_RECONNECT_INTERVAL * Math.pow(2, reconnectAttemptsRef.current - 1), MAX_RECONNECT_INTERVAL);
        console.log(`WebSocket: Attempting to reconnect (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${delay / 1000}s...`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else if (token && reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('WebSocket: Maximum reconnect attempts reached.');
        toast({ variant: 'destructive', title: 'WebSocket Disconnected', description: 'Could not reconnect. Please check your connection or try refreshing.'});
      }
    };
  }, [token, isBrowserOnline, clearAllTimeouts, onOpen, onClose, onMessageReceived, onReactionUpdate, onPresenceUpdate, onTypingUpdate, onThinkingOfYouReceived, onUserProfileUpdate, onMessageAck, toast, resetServerActivityTimeout, sendMessage]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser came online.');
      setIsBrowserOnline(true);
      if (token && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
        console.log('Attempting to reconnect WebSocket after browser came online.');
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };
    const handleOffline = () => {
      console.warn('Browser went offline.');
      setIsBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsBrowserOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearAllTimeouts();
    };
  }, [token, connect, clearAllTimeouts]);

  useEffect(() => {
    if (token && isBrowserOnline) {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
         connect();
      }
    } else if (!token || !isBrowserOnline) {
      clearAllTimeouts();
      wsRef.current?.close(1000, "Token removed or browser offline");
      wsRef.current = null;
      setIsConnected(false);
      if (!token) reconnectAttemptsRef.current = 0; 
    }
  }, [token, isBrowserOnline, connect, clearAllTimeouts]);

  return { isConnected, sendMessage, isBrowserOnline };
}
