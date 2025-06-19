
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketEventData, Message, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, User, Mood, HeartbeatClientEvent } from '@/types';
import { useToast } from './use-toast';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000';
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
  onUserProfileUpdate: (data: {user_id: string, mood?: Mood, display_name?: string, avatar_url?: string}) => void;
}

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
        wsRef.current.close(1006, 'Server activity timeout'); // 1006 for abnormal closure
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      if (payload.event_type !== "HEARTBEAT") { // Reset timeout on client sending message too
          resetServerActivityTimeout();
      }
    } else {
      console.error('WebSocket not connected. Cannot send message:', payload.event_type);
      // toast({ variant: 'destructive', title: 'Not Connected', description: 'Cannot send message. Connection lost.' });
    }
  }, [resetServerActivityTimeout]);


  const connect = useCallback(() => {
    if (!token || (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED)) {
        // If no token, or if socket exists and is not in CLOSED state (i.e. OPEN, CONNECTING, CLOSING), don't try to connect.
        // This prevents multiple connection attempts if already connecting or open.
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
             console.log(`WebSocket: Connection attempt skipped. State: ${wsRef.current.readyState}`);
        }
        return;
    }

    if (!isBrowserOnline) {
        console.warn('WebSocket: Browser is offline. Delaying connection attempt.');
        return;
    }
    
    clearAllTimeouts(); // Clear any pending timeouts before new connection attempt

    console.log('WebSocket: Attempting to connect...');
    const wsUrl = `${WS_BASE_URL}/ws/connect?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      onOpen?.();
      
      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        sendMessage({ event_type: "HEARTBEAT" } as HeartbeatClientEvent);
      }, HEARTBEAT_INTERVAL);
      resetServerActivityTimeout(); // Start activity timer
    };

    socket.onmessage = (event) => {
      resetServerActivityTimeout(); // Reset timeout on any server message
      try {
        const data = JSON.parse(event.data as string) as WebSocketEventData;
        switch (data.event_type) {
          case 'new_message': onMessageReceived((data as NewMessageEventData).message); break;
          case 'message_reaction_update': onReactionUpdate(data as MessageReactionUpdateEventData); break;
          case 'user_presence_update': onPresenceUpdate(data as UserPresenceUpdateEventData); break;
          case 'typing_indicator': onTypingUpdate(data as TypingIndicatorEventData); break;
          case 'thinking_of_you_received': onThinkingOfYouReceived(data as ThinkingOfYouReceivedEventData); break;
          case 'user_profile_update': onUserProfileUpdate(data as {user_id: string, mood?: Mood, display_name?: string, avatar_url?: string}); break;
          case 'error': toast({ variant: 'destructive', title: 'WebSocket Server Error', description: data.detail }); break;
          // HEARTBEAT from server is not explicitly handled, any message resets timeout
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
      clearAllTimeouts(); // Clear intervals and timeouts on close
      wsRef.current = null; // Ensure ref is cleared to allow reconnect
      onClose?.(event);

      if (event.code === 1008) { // Policy Violation (auth failed)
        toast({ variant: 'destructive', title: 'Connection Rejected', description: 'Authentication problem. Please re-login if this persists.' });
        return; // Do not attempt to reconnect on auth failure
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, onOpen, onClose, onMessageReceived, onReactionUpdate, onPresenceUpdate, onTypingUpdate, onThinkingOfYouReceived, onUserProfileUpdate, toast, clearAllTimeouts, resetServerActivityTimeout, sendMessage, isBrowserOnline]);


  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser came online.');
      setIsBrowserOnline(true);
      if (token && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
        console.log('Attempting to reconnect WebSocket after browser came online.');
        reconnectAttemptsRef.current = 0; // Reset attempts for a fresh start
        connect();
      }
    };
    const handleOffline = () => {
      console.warn('Browser went offline.');
      setIsBrowserOnline(false);
      // The onclose handler of WebSocket will manage reconnection attempts when it fails.
      // We could force close here, but it might be abrupt: wsRef.current?.close(1000, 'Browser offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsBrowserOnline(typeof navigator !== 'undefined' ? navigator.onLine : true); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearAllTimeouts(); // Ensure all timers are cleared on hook unmount
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
    // This effect handles initial connection and connection termination if token/online status changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isBrowserOnline]); // `connect` is memoized

  return { isConnected, sendMessage, isBrowserOnline };
}
