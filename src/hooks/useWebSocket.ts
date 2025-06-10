
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketEventData, Message, SupportedEmoji, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, User, Mood } from '@/types'; // Added Mood
import { useToast } from './use-toast';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000';

interface UseWebSocketOptions {
  token: string | null;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onMessageReceived: (message: Message) => void;
  onReactionUpdate: (data: MessageReactionUpdateEventData) => void; // Changed to use the specific event type
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
  const maxReconnectAttempts = 5;
  const reconnectInterval = 5000; // 5 seconds

  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${WS_BASE_URL}/ws/connect?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      onOpen?.();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as WebSocketEventData;
        console.log('WS Message Received:', data);
        switch (data.event_type) {
          case 'new_message':
            onMessageReceived((data as NewMessageEventData).message);
            break;
          case 'message_reaction_update':
            onReactionUpdate(data as MessageReactionUpdateEventData); // Directly pass the typed data
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
          // Handle other event types
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message or handle event:', error);
        toast({ variant: 'destructive', title: 'WebSocket Error', description: 'Received unparseable message.' });
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({ variant: 'destructive', title: 'WebSocket Connection Error' });
      // Reconnect logic will be handled by onclose
    };

    socket.onclose = (event) => {
      console.log('WebSocket disconnected:', event.reason, event.code);
      setIsConnected(false);
      onClose?.(event);

      if (event.code === 1008) { // Policy Violation (e.g. auth failed)
        toast({ variant: 'destructive', title: 'Connection Rejected', description: 'Authentication failed.' });
        return; // Don't attempt to reconnect on auth failure
      }
      
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        console.log(`Attempting to reconnect WebSocket (attempt ${reconnectAttemptsRef.current})...`);
        setTimeout(connect, reconnectInterval);
      } else {
        console.error('WebSocket max reconnect attempts reached.');
        toast({ variant: 'destructive', title: 'WebSocket Disconnected', description: 'Could not reconnect to the server.'});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, onOpen, onClose, onMessageReceived, onReactionUpdate, onPresenceUpdate, onTypingUpdate, onThinkingOfYouReceived, onUserProfileUpdate, toast]);

  useEffect(() => {
    if (token) {
      connect();
    } else {
      // If token becomes null (e.g., logout), close existing connection
      wsRef.current?.close(1000, "User logged out");
      wsRef.current = null;
      setIsConnected(false);
    }

    return () => {
      wsRef.current?.close(1000, "Component unmounting");
      wsRef.current = null;
    };
  }, [token, connect]);

  const sendMessage = useCallback((payload: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.error('WebSocket not connected. Cannot send message.');
      toast({ variant: 'destructive', title: 'Not Connected', description: 'Cannot send message. Connection lost.' });
    }
  }, [toast]);

  return { isConnected, sendMessage };
}
