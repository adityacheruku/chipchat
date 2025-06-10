
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType, Mood, SupportedEmoji, MessageClipType, AppEvent, Chat, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData } from '@/types';
// import { mockUsers, mockMessages } from '@/lib/mock-data'; // No longer primary source
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import UserProfileModal from '@/components/chat/UserProfileModal';
import FullScreenAvatarModal from '@/components/chat/FullScreenAvatarModal';
import { useToast } from '@/hooks/use-toast';
import { useThoughtNotification } from '@/hooks/useThoughtNotification';
import { useAvatar } from '@/hooks/useAvatar';
import { useMoodSuggestion } from '@/hooks/useMoodSuggestion.tsx'; // Corrected path
import { THINKING_OF_YOU_DURATION, MAX_AVATAR_SIZE_KB, ENABLE_AI_MOOD_SUGGESTION } from '@/config/app-config';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Loader2 } from 'lucide-react';

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, token, logout, fetchAndUpdateUser, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(true); // For initial chat data load
  const [dynamicBgClass, setDynamicBgClass] = useState('bg-mood-default-chat-area');
  const [appEvents, setAppEvents] = useState<AppEvent[]>([]); // Kept for local event logging

  const [isFullScreenAvatarOpen, setIsFullScreenAvatarOpen] = useState(false);
  const [fullScreenUserData, setFullScreenUserData] = useState<User | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; isTyping: boolean }>>({});


  const lastReactionToggleTimes = useRef<Record<string, number>>({});
  const lastMessageTextRef = useRef<string>("");

  const addAppEvent = useCallback((type: AppEvent['type'], description: string, userId?: string, userName?: string, metadata?: Record<string, any>) => {
    setAppEvents(prevEvents => {
      const newEvent: AppEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        type,
        description,
        userId,
        userName,
        metadata,
      };
      // console.log("App Event:", newEvent);
      return [newEvent, ...prevEvents].slice(0, 50);
    });
  }, []);

  const {
    activeTargetId: activeThoughtNotificationFor,
    initiateThoughtNotification
  } = useThoughtNotification({
    duration: THINKING_OF_YOU_DURATION,
    toast: toast
  });

  const {
    avatarPreview,
    handleFileChange: handleAvatarFileChangeHook,
    setAvatarPreview,
  } = useAvatar({ maxSizeKB: MAX_AVATAR_SIZE_KB, toast });

  const handleMoodChangeForAISuggestion = useCallback(async (newMood: Mood) => {
    if (currentUser) {
      try {
        await api.updateUserProfile({ mood: newMood });
        fetchAndUpdateUser(); // Refresh currentUser from AuthContext
        addAppEvent('moodChange', `${currentUser.display_name} updated mood to ${newMood} via AI suggestion.`, currentUser.id, currentUser.display_name);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Mood Update Failed', description: error.message });
      }
    }
  }, [currentUser, fetchAndUpdateUser, addAppEvent, toast]);

  const {
    isLoadingAISuggestion,
    suggestMood: aiSuggestMood,
    ReasoningDialog
  } = useMoodSuggestion({
    currentUserMood: currentUser?.mood || 'Neutral',
    onMoodChange: handleMoodChangeForAISuggestion,
    currentMessageTextRef: lastMessageTextRef,
  });


  // WebSocket Handlers
  const handleWSMessageReceived = useCallback((newMessage: MessageType) => {
    setMessages(prevMessages => {
      // Prevent duplicates if message also came via HTTP (optimistic UI + WS)
      if (prevMessages.find(m => m.id === newMessage.id || (newMessage.client_temp_id && m.client_temp_id === newMessage.client_temp_id))) {
        // If it's an update to a temp message, replace it
        return prevMessages.map(m => (m.client_temp_id === newMessage.client_temp_id ? newMessage : m));
      }
      return [...prevMessages, newMessage].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    if (activeChat) { // Mark as read or update last seen message in chat list (future)
        setActiveChat(prev => prev ? ({...prev, last_message: newMessage, updated_at: newMessage.updated_at }) : null);
    }
  }, [activeChat]);

  const handleWSReactionUpdate = useCallback((data: MessageReactionUpdateEventData) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg
      )
    );
  }, []);

  const handleWSPresenceUpdate = useCallback((data: UserPresenceUpdateEventData) => {
    if (otherUser && data.user_id === otherUser.id) {
      setOtherUser(prev => prev ? { ...prev, is_online: data.is_online, last_seen: data.last_seen, mood: data.mood } : null);
    }
     if (currentUser && data.user_id === currentUser.id) {
      fetchAndUpdateUser(); // Current user's presence updated by another session
    }
  }, [otherUser, currentUser, fetchAndUpdateUser]);
  
  const handleWSUserProfileUpdate = useCallback((data: {user_id: string, mood?: Mood, display_name?: string, avatar_url?: string}) => {
    if (otherUser && data.user_id === otherUser.id) {
        setOtherUser(prev => prev ? { ...prev, ...data } : null);
    }
    if (currentUser && data.user_id === currentUser.id) {
        fetchAndUpdateUser(); // Current user's profile updated from another session
    }
  }, [currentUser, otherUser, fetchAndUpdateUser]);


  const handleWSTypingUpdate = useCallback((data: TypingIndicatorEventData) => {
    if (activeChat && data.chat_id === activeChat.id) {
      setTypingUsers(prev => ({
        ...prev,
        [data.user_id]: { userId: data.user_id, isTyping: data.is_typing },
      }));
    }
  }, [activeChat]);

  const handleWSThinkingOfYou = useCallback((data: ThinkingOfYouReceivedEventData) => {
    if (otherUser && data.sender_id === otherUser.id) {
      toast({
        title: "❤️ Thinking of You!",
        description: `${otherUser.display_name} is thinking of you.`,
        duration: THINKING_OF_YOU_DURATION
      });
      // Optionally, trigger visual effect for `isTargetUserBeingThoughtOf` on ChatHeader for current user
    }
  }, [otherUser, toast]);


  const { isConnected: isWsConnected, sendMessage: sendWsMessage } = useWebSocket({
    token,
    onMessageReceived: handleWSMessageReceived,
    onReactionUpdate: handleWSReactionUpdate,
    onPresenceUpdate: handleWSPresenceUpdate,
    onTypingUpdate: handleWSTypingUpdate,
    onThinkingOfYouReceived: handleWSThinkingOfYou,
    onUserProfileUpdate: handleWSUserProfileUpdate,
    onOpen: () => addAppEvent('apiError', 'WebSocket connected', currentUser?.id, currentUser?.display_name),
    onClose: (event) => addAppEvent('apiError', `WebSocket disconnected: ${event.reason}`, currentUser?.id, currentUser?.display_name, {code: event.code}),
  });


  // Effect for initial data loading when currentUser is available
  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading) {
      router.push('/');
      return;
    }

    if (currentUser && token) {
      setIsChatLoading(true);
      const loadChatData = async () => {
        try {
          // 1. Fetch default chat partner
          const partner = await api.getDefaultChatPartner();
          if (!partner) {
            toast({ variant: 'destructive', title: "Chat Setup Error", description: "Could not find a chat partner. Please ensure two users are registered." });
            setIsChatLoading(false);
            // For a 2-user system, this means the other user is not registered or DB is empty.
            // Logout or show an error message.
            logout(); // Simple solution for now
            return;
          }
          
          // Fetch full profile of other user
          const otherUserDetails = await api.getUserProfile(partner.user_id);
          setOtherUser(otherUserDetails);
          setAvatarPreview(currentUser.avatar_url); // Initialize avatar for profile modal

          // 2. Create or get the chat session with this partner
          const chatSession = await api.createOrGetChat(partner.user_id);
          setActiveChat(chatSession);

          // 3. Fetch messages for this chat
          if (chatSession) {
            const messagesData = await api.getMessages(chatSession.id);
            setMessages(messagesData.messages.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
          }
        } catch (error: any) {
          toast({ variant: 'destructive', title: 'Failed to load chat data', description: error.message });
          addAppEvent('apiError', 'Failed to load initial chat data', currentUser?.id, currentUser?.display_name, { error: error.message });
          // Potentially logout or redirect
        } finally {
          setIsChatLoading(false);
        }
      };
      loadChatData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, token, isAuthenticated, isAuthLoading, router, toast, logout]); // Removed addAppEvent, setAvatarPreview from deps


  const handleSendMessage = (text: string) => {
    if (!currentUser || !activeChat || !isWsConnected) return;

    const clientTempId = `temp_${Date.now()}`;
    const optimisticMessage: MessageType = {
      id: clientTempId, // Temporary ID
      user_id: currentUser.id,
      chat_id: activeChat.id,
      text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reactions: {},
      client_temp_id: clientTempId,
    };
    // Optimistic UI update
    setMessages(prev => [...prev, optimisticMessage]);

    sendWsMessage({
      event_type: "send_message",
      chat_id: activeChat.id,
      text,
      client_temp_id: clientTempId,
    });
    addAppEvent('messageSent', `${currentUser.display_name} sent: "${text.substring(0,30)}"`, currentUser.id, currentUser.display_name);

    if (ENABLE_AI_MOOD_SUGGESTION && currentUser.mood) {
      lastMessageTextRef.current = text;
      aiSuggestMood(text);
    }
  };

  const handleSendMoodClip = async (clipType: MessageClipType, file: File) => {
    if (!currentUser || !activeChat || !isWsConnected) return;
    toast({ title: "Uploading clip..."});
    try {
        const uploadResponse = await api.uploadMoodClip(file, clipType);
        const placeholderText = clipType === 'audio' 
            ? `${currentUser.display_name} sent an audio mood clip.` 
            : `${currentUser.display_name} sent a video mood clip.`;

        sendWsMessage({
            event_type: "send_message",
            chat_id: activeChat.id,
            clip_type: clipType,
            clip_url: uploadResponse.file_url,
            clip_placeholder_text: placeholderText,
        });
        addAppEvent('moodClipSent', `${currentUser.display_name} sent a ${clipType} clip.`, currentUser.id, currentUser.display_name);
        toast({ title: "Mood Clip Sent!" });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Clip Upload Failed', description: error.message });
    }
  };


  const handleToggleReaction = (messageId: string, emoji: SupportedEmoji) => {
    if (!currentUser || !activeChat || !isWsConnected) return;

    const RATE_LIMIT_MS = 1000; // Kept client-side rate limiting
    const key = `${messageId}_${emoji}`;
    const now = Date.now();
    if (lastReactionToggleTimes.current[key] && (now - lastReactionToggleTimes.current[key] < RATE_LIMIT_MS)) {
      toast({ title: "Woah there!", description: "You're reacting a bit too quickly.", duration: 2000 });
      return;
    }
    lastReactionToggleTimes.current[key] = now;

    sendWsMessage({
      event_type: "toggle_reaction",
      message_id: messageId,
      chat_id: activeChat.id,
      emoji: emoji,
    });
    // Optimistic UI update can be tricky with reactions if not careful.
    // The WS response will update the state via handleWSReactionUpdate.
    addAppEvent('reactionAdded', `${currentUser.display_name} toggled ${emoji} reaction.`, currentUser.id, currentUser.display_name, {messageId});
  };

  const handleSaveProfile = async (updatedProfileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone'>>, newAvatarFile?: File) => {
    if (!currentUser) return;
    try {
      let finalProfileData = { ...updatedProfileData };
      if (newAvatarFile) {
        toast({title: "Uploading avatar..."});
        const avatarUploadResponse = await api.uploadAvatar(newAvatarFile);
        // The backend /users/me/avatar endpoint directly updates and returns the user,
        // so we might not need to merge avatar_url manually if updateProfile is called after,
        // or if uploadAvatar returns the full updated user. For now, assuming direct update.
        setAvatarPreview(avatarUploadResponse.avatar_url); // Update local preview
        finalProfileData.avatar_url = avatarUploadResponse.avatar_url; // ensure its part of the profile data if not already by backend
      }
      
      if (Object.keys(updatedProfileData).length > 0) { // Only call update if other fields changed
         await api.updateUserProfile(updatedProfileData);
      }

      await fetchAndUpdateUser(); // Refresh currentUser from AuthContext to get latest from server
      toast({ title: "Profile Updated", description: "Your profile has been saved." });
      addAppEvent('profileUpdate', `${currentUser.display_name} updated profile.`, currentUser.id, currentUser.display_name);
      setIsProfileModalOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Profile Save Failed', description: error.message });
    }
  };
  
  const handleSendThought = async () => {
    if (!currentUser || !otherUser || !isWsConnected) return;
    try {
      await api.sendThinkingOfYouPing(otherUser.id);
      initiateThoughtNotification(otherUser.id, otherUser.display_name, currentUser.display_name);
      addAppEvent('thoughtPingSent', `${currentUser.display_name} sent 'thinking of you' to ${otherUser.display_name}.`, currentUser.id, currentUser.display_name);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Ping Failed', description: error.message });
    }
  };

  const getDynamicBackgroundClass = useCallback((mood1?: Mood, mood2?: Mood): string => {
    if (!mood1 || !mood2) return 'bg-mood-default-chat-area';
    if (mood1 === 'Happy' && mood2 === 'Happy') return 'bg-mood-happy-happy';
    if (mood1 === 'Excited' && mood2 === 'Excited') return 'bg-mood-excited-excited';
    if ( (mood1 === 'Chilling' || mood1 === 'Neutral' || mood1 === 'Thoughtful' || mood1 === 'Content') &&
         (mood2 === 'Chilling' || mood2 === 'Neutral' || mood2 === 'Thoughtful' || mood2 === 'Content') ) {
        const calmMoods = ['Chilling', 'Neutral', 'Thoughtful', 'Content'];
        if (calmMoods.includes(mood1) && calmMoods.includes(mood2)) {
           return 'bg-mood-calm-calm';
        }
    }
    if (mood1 === 'Sad' && mood2 === 'Sad') return 'bg-mood-sad-sad';
    if (mood1 === 'Angry' && mood2 === 'Angry') return 'bg-mood-angry-angry';
    if (mood1 === 'Anxious' && mood2 === 'Anxious') return 'bg-mood-anxious-anxious';
    if ((mood1 === 'Happy' && (mood2 === 'Sad' || mood2 === 'Angry')) || ((mood1 === 'Sad' || mood1 === 'Angry') && mood2 === 'Happy') ||
        (mood1 === 'Excited' && (mood2 === 'Sad' || mood2 === 'Chilling' || mood2 === 'Angry')) ||
        ((mood1 === 'Sad' || mood1 === 'Chilling' || mood1 === 'Angry') && mood2 === 'Excited') ) {
      return 'bg-mood-thoughtful-thoughtful';
    }
    return 'bg-mood-default-chat-area';
  }, []);

  useEffect(() => {
    if (currentUser?.mood && otherUser?.mood) {
      setDynamicBgClass(getDynamicBackgroundClass(currentUser.mood, otherUser.mood));
    } else {
      setDynamicBgClass('bg-mood-default-chat-area');
    }
  }, [currentUser?.mood, otherUser?.mood, getDynamicBackgroundClass]);

  const handleOtherUserAvatarClick = useCallback(() => {
    if (otherUser) {
      setFullScreenUserData(otherUser);
      setIsFullScreenAvatarOpen(true);
    }
  }, [otherUser]);

  // Typing indicator logic
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleTyping = useCallback((isTyping: boolean) => {
    if (!activeChat || !isWsConnected) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    sendWsMessage({
        event_type: isTyping ? "start_typing" : "stop_typing",
        chat_id: activeChat.id,
    });

    if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
            // Send stop_typing if no typing for a while
            sendWsMessage({
                event_type: "stop_typing",
                chat_id: activeChat.id,
            });
        }, 3000); // Stop typing after 3 seconds of inactivity
    }
  }, [activeChat, isWsConnected, sendWsMessage]);


  if (isAuthLoading || isChatLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-foreground ml-4">Loading chat...</p>
      </div>
    );
  }

  if (!currentUser || !otherUser || !activeChat) {
     // This state might occur if default chat partner couldn't be established or user was logged out.
     // AuthContext useEffect should redirect to '/' if not authenticated.
     // If authenticated but otherUser/activeChat is null, it's an error state.
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center">
        <div>
          <p className="text-destructive text-lg mb-4">Could not load chat environment.</p>
          <p className="text-muted-foreground mb-4">This might be due to a missing chat partner or a server issue.</p>
          <Button onClick={() => router.push('/')} variant="outline">Go to Login</Button>
        </div>
      </div>
    );
  }
  
  const otherUserIsTyping = otherUser && typingUsers[otherUser.id]?.isTyping;

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-screen p-0 sm:p-0 transition-colors duration-500 relative", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
        <div className={cn("flex flex-col items-center justify-center w-full h-full p-2 sm:p-4", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
          <ErrorBoundary fallbackMessage="The chat couldn't be displayed. Try resetting or refreshing the page.">
            <div className="w-full max-w-2xl h-[95vh] sm:h-[90vh] md:h-[85vh] flex flex-col bg-card shadow-2xl rounded-lg overflow-hidden">
              <ChatHeader
                currentUser={currentUser}
                otherUser={otherUser}
                onProfileClick={() => setIsProfileModalOpen(true)}
                onSendThinkingOfYou={handleSendThought}
                isTargetUserBeingThoughtOf={activeThoughtNotificationFor === otherUser.id}
                onOtherUserAvatarClick={handleOtherUserAvatarClick}
                isOtherUserTyping={!!otherUserIsTyping}
              />
              <MessageArea
                messages={messages}
                currentUser={currentUser}
                allUsers={{[currentUser.id]: currentUser, [otherUser.id]: otherUser}}
                onToggleReaction={handleToggleReaction}
              />
              <InputBar
                onSendMessage={handleSendMessage}
                onSendMoodClip={handleSendMoodClip} // Will need modification to handle file
                isSending={isLoadingAISuggestion} // Or other sending states
                onTyping={handleTyping}
              />
            </div>
          </ErrorBoundary>
        </div>
      {isProfileModalOpen && currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={currentUser}
          onSave={handleSaveProfile}
          avatarPreview={avatarPreview || currentUser.avatar_url}
          onAvatarFileChange={handleAvatarFileChangeHook} // Use the hook's handler
        />
      )}
      {fullScreenUserData && (
        <FullScreenAvatarModal
          isOpen={isFullScreenAvatarOpen}
          onClose={() => setIsFullScreenAvatarOpen(false)}
          user={fullScreenUserData}
        />
      )}
      <ReasoningDialog />
    </div>
  );
}
