
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketEventData, Message, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, User, Mood } from '@/types';
import { useToast } from './use-toast';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000';
const INITIAL_RECONNECT_INTERVAL = 1000; // Start with 1 second
const MAX_RECONNECT_INTERVAL = 30000;   // Cap at 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;      // Max number of reconnect attempts

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
  const { toast } = useToast();
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('WebSocket: Browser is offline. Delaying connection attempt.');
        // Optionally, schedule a retry when browser comes back online, or increase attempts less aggressively.
        // For now, we'll let the standard reconnect logic handle it when onclose is triggered.
        // Or, we could set a longer timeout here before trying to connect.
        // To keep it simple, if it's offline and connect is called, it might fail and then onclose will handle retries.
        // A more advanced strategy would listen to online/offline events.
    }

    const wsUrl = `${WS_BASE_URL}/ws/connect?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      onOpen?.();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as WebSocketEventData;
        // console.log('WS Message Received:', data); // Can be verbose
        switch (data.event_type) {
          case 'new_message':
            onMessageReceived((data as NewMessageEventData).message);
            break;
          case 'message_reaction_update':
            onReactionUpdate(data as MessageReactionUpdateEventData);
            break;
          case 'user_presence_update':
            onPresenceUpdate(data as UserPresenceUpdateEventData);
            break;
          case 'typing_indicator':
            onTypingUpdate(data as TypingIndicatorEventData);
            break;
          case 'thinking_of_you_received':
            onThinkingOfYouReceived(data as ThinkingOfYouReceivedEventData);
            break;
          case 'user_profile_update':
             onUserProfileUpdate(data as {user_id: string, mood?: Mood, display_name?: string, avatar_url?: string});
            break;
          case 'error':
            toast({ variant: 'destructive', title: 'WebSocket Error', description: data.detail });
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message or handle event:', error);
        toast({ variant: 'destructive', title: 'WebSocket Error', description: 'Received unparseable message.' });
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error event:', error);
      // This event usually precedes onclose when there's a connection issue.
      // No need to toast here as onclose will handle it.
    };

    socket.onclose = (event) => {
      console.warn(`WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
      setIsConnected(false);
      onClose?.(event);
      wsRef.current = null; // Ensure ref is cleared

      if (event.code === 1008) { // Policy Violation (e.g. auth failed)
        toast({ variant: 'destructive', title: 'Connection Rejected', description: 'Authentication problem. Please re-login if this persists.' });
        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS +1; // Prevent retries
        return;
      }
      
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, then cap at MAX_RECONNECT_INTERVAL
        const delay = Math.min(INITIAL_RECONNECT_INTERVAL * Math.pow(2, reconnectAttemptsRef.current - 1), MAX_RECONNECT_INTERVAL);
        
        console.log(`WebSocket: Attempting to reconnect (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${delay / 1000}s...`);
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

        reconnectTimeoutRef.current = setTimeout(() => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                console.warn('WebSocket: Reconnect attempt skipped, browser offline.');
                // Schedule another check, or rely on next onclose if connection fails immediately
                // For simplicity, we let it try and fail if offline, which will trigger onclose again.
                // A listener for 'online' event would be more robust here.
            }
            console.log('WebSocket: Executing reconnect attempt...');
            connect();
        }, delay);

      } else {
        console.error('WebSocket: Maximum reconnect attempts reached.');
        toast({ variant: 'destructive', title: 'WebSocket Disconnected', description: 'Could not reconnect to the server. Please check your connection or try again later.'});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, onOpen, onClose, onMessageReceived, onReactionUpdate, onPresenceUpdate, onTypingUpdate, onThinkingOfYouReceived, onUserProfileUpdate, toast]);

  useEffect(() => {
    if (token) {
      // Only connect if not already connected or trying to connect
      if (!wsRef.current || (wsRef.current.readyState !== WebSocket.OPEN && wsRef.current.readyState !== WebSocket.CONNECTING)) {
         connect();
      }
    } else {
      // If token becomes null (e.g., logout), close existing connection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      wsRef.current?.close(1000, "User logged out"); // 1000 is normal closure
      wsRef.current = null;
      setIsConnected(false);
      reconnectAttemptsRef.current = 0; // Reset for next login
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Don't close with 1000 if it was an abnormal closure (e.g. 1006) to allow reconnect logic.
      // Only close normally if the component is unmounting for reasons other than a connection drop.
      // This cleanup is tricky. If token is still valid, we might want it to stay connected.
      // The current logic in the main effect (if token -> connect, else -> close) might be sufficient.
      // For a strict cleanup on component unmount regardless of token:
      // wsRef.current?.close(1000, "Component unmounting");
      // wsRef.current = null;
    };
  }, [token, connect]);

  const sendMessage = useCallback((payload: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.error('WebSocket not connected. Cannot send message.');
      toast({ variant: 'destructive', title: 'Not Connected', description: 'Cannot send message. Connection lost.' });
      // Optionally, queue the message and try to send when reconnected.
    }
  }, [toast]);

  return { isConnected, sendMessage };
}

