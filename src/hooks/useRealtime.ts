
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { realtimeService, type RealtimeProtocol } from '@/services/realtimeService';
import type { Message, MessageAckEventData, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, UserProfileUpdateEventData, EventPayload, ChatModeChangedEventData, MessageDeletedEventData } from '@/types';

interface UseRealtimeOptions {
  onMessageReceived: (message: Message) => void;
  onReactionUpdate: (data: MessageReactionUpdateEventData) => void;
  onPresenceUpdate: (data: UserPresenceUpdateEventData) => void;
  onTypingUpdate: (data: TypingIndicatorEventData) => void;
  onThinkingOfYouReceived: (data: ThinkingOfYouReceivedEventData) => void;
  onUserProfileUpdate: (data: UserProfileUpdateEventData) => void;
  onMessageAck: (data: MessageAckEventData) => void;
  onChatModeChanged: (data: ChatModeChangedEventData) => void;
  onMessageDeleted: (data: MessageDeletedEventData) => void;
}

export function useRealtime({
  onMessageReceived, onReactionUpdate, onPresenceUpdate, onTypingUpdate, onThinkingOfYouReceived, onUserProfileUpdate, onMessageAck, onChatModeChanged, onMessageDeleted
}: UseRealtimeOptions) {
  const { token, logout } = useAuth();
  const { toast } = useToast();
  const [protocol, setProtocol] = useState<RealtimeProtocol>(realtimeService.getProtocol());

  useEffect(() => {
    const handleEvent = (eventType: string, data: any) => {
      if (eventType === 'protocol-change') {
        setProtocol(data);
      } else if (eventType === 'auth-error') {
        toast({ variant: 'destructive', title: 'Authentication Failed', description: 'Please re-login.' });
        logout();
      } else if (eventType === 'error') {
        toast({ variant: 'destructive', title: data.title, description: data.description });
      } else if (eventType === 'event') {
        const payload = data as EventPayload;
        switch (payload.event_type) {
          case 'new_message': onMessageReceived((payload as NewMessageEventData).message); break;
          case 'message_deleted': onMessageDeleted(payload as MessageDeletedEventData); break;
          case 'message_reaction_update': onReactionUpdate(payload as MessageReactionUpdateEventData); break;
          case 'user_presence_update': onPresenceUpdate(payload as UserPresenceUpdateEventData); break;
          case 'typing_indicator': onTypingUpdate(payload as TypingIndicatorEventData); break;
          case 'thinking_of_you_received': onThinkingOfYouReceived(payload as ThinkingOfYouReceivedEventData); break;
          case 'user_profile_update': onUserProfileUpdate(payload as UserProfileUpdateEventData); break;
          case 'message_ack': onMessageAck(payload as MessageAckEventData); break;
          case 'chat_mode_changed': onChatModeChanged(payload as ChatModeChangedEventData); break;
          case 'error': toast({ variant: 'destructive', title: 'Server Error', description: payload.detail }); break;
        }
      }
    };
    
    realtimeService.subscribe(handleEvent);

    if (token) {
      realtimeService.connect(token);
    } else {
      realtimeService.disconnect();
    }
    
    return () => {
      realtimeService.unsubscribe(handleEvent);
    };
  }, [token, logout, toast, onMessageReceived, onReactionUpdate, onPresenceUpdate, onTypingUpdate, onThinkingOfYouReceived, onUserProfileUpdate, onMessageAck, onChatModeChanged, onMessageDeleted]);


  return { 
    protocol, 
    sendMessage: realtimeService.sendMessage, 
    isBrowserOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
  };
}

    