
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType, Mood, SupportedEmoji, MessageClipType, AppEvent, Chat, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData } from '@/types';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import UserProfileModal from '@/components/chat/UserProfileModal';
import FullScreenAvatarModal from '@/components/chat/FullScreenAvatarModal';
import MoodEntryModal from '@/components/chat/MoodEntryModal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useThoughtNotification } from '@/hooks/useThoughtNotification';
import { useAvatar } from '@/hooks/useAvatar';
import { useMoodSuggestion } from '@/hooks/useMoodSuggestion.tsx';
import { THINKING_OF_YOU_DURATION, MAX_AVATAR_SIZE_KB, ENABLE_AI_MOOD_SUGGESTION } from '@/config/app-config';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Loader2, MessagesSquare } from 'lucide-react';

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, token, logout, fetchAndUpdateUser, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [dynamicBgClass, setDynamicBgClass] = useState('bg-mood-default-chat-area');
  const [appEvents, setAppEvents] = useState<AppEvent[]>([]);
  const [chatSetupErrorMessage, setChatSetupErrorMessage] = useState<string | null>(null);


  const [isFullScreenAvatarOpen, setIsFullScreenAvatarOpen] = useState(false);
  const [fullScreenUserData, setFullScreenUserData] = useState<User | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; isTyping: boolean }>>({});

  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [initialMoodOnLoad, setInitialMoodOnLoad] = useState<Mood | null>(null);

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
        await fetchAndUpdateUser();
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

  const handleWSMessageReceived = useCallback((newMessage: MessageType) => {
    setMessages(prevMessages => {
      // If activeChat is not yet set, but we receive a message for a chat we *should* be in,
      // we might need to initialize activeChat based on this message.
      // This can happen if a new user receives a message before their initial partner/chat load finishes.
      if (!activeChat && newMessage.chat_id) {
         // Optimistically try to set activeChat if partner info might arrive soon.
         // This is a simplification; a more robust solution might involve fetching chat details.
         console.log("WS: Received message for a potentially new chat, attempting to set chat context.");
      }

      if (prevMessages.find(m => m.id === newMessage.id || (newMessage.client_temp_id && m.client_temp_id === newMessage.client_temp_id))) {
        return prevMessages.map(m => (m.client_temp_id === newMessage.client_temp_id ? newMessage : m));
      }
      return [...prevMessages, newMessage].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    // Update last message in activeChat if the message belongs to it
    if (activeChat && newMessage.chat_id === activeChat.id) {
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
    } else if (!otherUser && currentUser && data.user_id !== currentUser.id) {
        // If we don't have an otherUser yet, and a presence update comes for someone else,
        // it could be our new chat partner. Trigger a reload of chat data.
        console.log("WS: Presence update for a new user detected. Re-fetching chat data.");
        performLoadChatData();
    }
     if (currentUser && data.user_id === currentUser.id) {
      fetchAndUpdateUser(); 
    }
  }, [otherUser, currentUser, fetchAndUpdateUser]);
  
  const handleWSUserProfileUpdate = useCallback((data: {user_id: string, mood?: Mood, display_name?: string, avatar_url?: string}) => {
    if (otherUser && data.user_id === otherUser.id) {
        setOtherUser(prev => prev ? { ...prev, ...data } : null);
    } else if (!otherUser && currentUser && data.user_id !== currentUser.id) {
        // Potentially a new partner's profile update
        console.log("WS: Profile update for a new user detected. Re-fetching chat data.");
        performLoadChatData();
    }
    if (currentUser && data.user_id === currentUser.id) {
        fetchAndUpdateUser();
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

  const performLoadChatData = useCallback(async () => {
    if (!currentUser || !token) {
        if (!isAuthLoading) {
             setChatSetupErrorMessage("User authentication data is missing. Please try logging in again.");
             setIsChatLoading(false);
        }
        return;
    }

    setIsChatLoading(true);
    setChatSetupErrorMessage(null); 

    try {
      const partner = await api.getDefaultChatPartner();
      
      if (!partner) {
        // No other user in the system. This is a valid "alone" state.
        setOtherUser(null);
        setActiveChat(null);
        setMessages([]);
        if (currentUser.avatar_url) setAvatarPreview(currentUser.avatar_url);
        // Mood prompt can still run
        if (typeof window !== 'undefined' && currentUser.mood) {
            const moodPrompted = sessionStorage.getItem('moodPromptedThisSession');
            if (moodPrompted !== 'true') {
            setInitialMoodOnLoad(currentUser.mood);
            setIsMoodModalOpen(true);
            }
        }
        setIsChatLoading(false);
        return; // Exit early, no chat to load messages from
      }
      
      // Partner exists, proceed to get their details and the chat session
      const otherUserDetails = await api.getUserProfile(partner.user_id);
      setOtherUser(otherUserDetails);
      if (currentUser.avatar_url) setAvatarPreview(currentUser.avatar_url);

      const chatSession = await api.createOrGetChat(partner.user_id);
      setActiveChat(chatSession);

      if (chatSession) {
        const messagesData = await api.getMessages(chatSession.id);
        setMessages(messagesData.messages.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      } else {
        // This case should ideally not happen if a partner was found, but as a fallback
        throw new Error("Failed to establish a chat session even with a partner.");
      }
      
      if (typeof window !== 'undefined' && currentUser.mood) {
        const moodPrompted = sessionStorage.getItem('moodPromptedThisSession');
        if (moodPrompted !== 'true') {
          setInitialMoodOnLoad(currentUser.mood);
          setIsMoodModalOpen(true);
        }
      }

    } catch (error: any) {
      const apiErrorMsg = `Failed to load chat data: ${error.message}`;
      toast({ variant: 'destructive', title: 'API Error', description: apiErrorMsg, duration: 7000 });
      addAppEvent('apiError', 'Failed to load initial chat data', currentUser?.id, currentUser?.display_name, { error: error.message });
      setChatSetupErrorMessage(apiErrorMsg);
    } finally {
      setIsChatLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUser, token, toast, addAppEvent, setAvatarPreview, isAuthLoading 
    // Removed performLoadChatData from its own deps
  ]);

  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading) {
      router.push('/');
      return;
    }

    if (isAuthenticated && currentUser && token) {
      performLoadChatData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAuthLoading, currentUser, token, router]); // Removed performLoadChatData to prevent loops, ensure it's stable


  const handleSendMessage = (text: string) => {
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;

    const clientTempId = `temp_${Date.now()}`;
    const optimisticMessage: MessageType = {
      id: clientTempId,
      user_id: currentUser.id,
      chat_id: activeChat.id,
      text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reactions: {},
      client_temp_id: clientTempId,
    };
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
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;
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
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;
    const RATE_LIMIT_MS = 1000;
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
    addAppEvent('reactionAdded', `${currentUser.display_name} toggled ${emoji} reaction.`, currentUser.id, currentUser.display_name, {messageId});
  };

  const handleSaveProfile = async (updatedProfileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone' | 'email'>>, newAvatarFile?: File) => {
    if (!currentUser) return;
    try {
      // let finalProfileData = { ...updatedProfileData }; // Not used
      if (newAvatarFile) {
        toast({title: "Uploading avatar..."});
        const avatarUploadResponse = await api.uploadAvatar(newAvatarFile);
        setAvatarPreview(avatarUploadResponse.avatar_url);
      }
      
      if (Object.keys(updatedProfileData).length > 0) {
         await api.updateUserProfile(updatedProfileData);
      }

      await fetchAndUpdateUser();
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
      sendWsMessage({
          event_type: "ping_thinking_of_you",
          recipient_user_id: otherUser.id,
      });
      initiateThoughtNotification(otherUser.id, otherUser.display_name, currentUser.display_name);
      addAppEvent('thoughtPingSent', `${currentUser.display_name} sent 'thinking of you' to ${otherUser.display_name}.`, currentUser.id, currentUser.display_name);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Ping Failed', description: error.message });
    }
  };

  const getDynamicBackgroundClass = useCallback((mood1?: Mood, mood2?: Mood): string => {
    if (!mood1 || !mood2) return 'bg-mood-default-chat-area'; // If one user isn't there, use default
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
      setDynamicBgClass('bg-mood-default-chat-area'); // Default if otherUser is null
    }
  }, [currentUser?.mood, otherUser?.mood, getDynamicBackgroundClass]);

  const handleOtherUserAvatarClick = useCallback(() => {
    if (otherUser) {
      setFullScreenUserData(otherUser);
      setIsFullScreenAvatarOpen(true);
    }
  }, [otherUser]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleTyping = useCallback((isTyping: boolean) => {
    if (!activeChat || !isWsConnected || !otherUser) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    sendWsMessage({
        event_type: isTyping ? "start_typing" : "stop_typing",
        chat_id: activeChat.id,
    });

    if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
            sendWsMessage({
                event_type: "stop_typing",
                chat_id: activeChat.id,
            });
        }, 3000);
    }
  }, [activeChat, isWsConnected, sendWsMessage, otherUser]);

  const handleSetMoodFromModal = useCallback(async (newMood: Mood) => {
    if (currentUser) {
      try {
        await api.updateUserProfile({ mood: newMood });
        await fetchAndUpdateUser();
        toast({ title: "Mood Updated!", description: `Your mood is now ${newMood}.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Mood Update Failed', description: error.message });
      }
    }
    if (typeof window !== 'undefined') sessionStorage.setItem('moodPromptedThisSession', 'true');
    setIsMoodModalOpen(false);
  }, [currentUser, fetchAndUpdateUser, toast]);

  const handleContinueWithCurrentMood = useCallback(() => {
    if (typeof window !== 'undefined') sessionStorage.setItem('moodPromptedThisSession', 'true');
    setIsMoodModalOpen(false);
  }, []);


  if (isAuthLoading || (isAuthenticated && isChatLoading && !chatSetupErrorMessage)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-foreground ml-4">Loading chat...</p>
      </div>
    );
  }

  if (!isAuthenticated && !isAuthLoading) {
    // This redirect is handled by AuthContext, but as a fallback:
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center">
        <div>
          <p className="text-destructive text-lg mb-4">Authentication required.</p>
          <Button onClick={() => router.push('/')} variant="outline">Go to Login</Button>
        </div>
      </div>
    );
  }
  
  if (chatSetupErrorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center">
        <div>
          <p className="text-destructive text-lg mb-4">Chat Setup Problem</p>
          <p className="text-muted-foreground mb-4">{chatSetupErrorMessage}</p>
          <Button onClick={() => router.push('/')} variant="outline" className="mr-2">Go to Login Page</Button>
          <Button onClick={performLoadChatData} variant="default">
            Retry
          </Button>
        </div>
      </div>
    );
  }
  
  // This condition means we have a current user, but no error, and are ready to render the chat or "waiting" state.
  if (!currentUser) { 
    // Should be caught by AuthContext redirect, but as a failsafe
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center">
        <div>
          <p className="text-destructive text-lg mb-4">User data not available.</p>
          <Button onClick={() => router.push('/')} variant="outline">Go to Login</Button>
        </div>
      </div>
    );
  }
  
  const otherUserIsTyping = otherUser && typingUsers[otherUser.id]?.isTyping;
  const allUsersForMessageArea = currentUser && otherUser ? {[currentUser.id]: currentUser, [otherUser.id]: otherUser} : (currentUser ? {[currentUser.id]: currentUser} : {});

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-screen p-0 sm:p-0 transition-colors duration-500 relative", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
        <div className={cn("flex flex-col items-center justify-center w-full h-full p-2 sm:p-4", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
          <ErrorBoundary fallbackMessage="The chat couldn't be displayed. Try resetting or refreshing the page.">
            <div className="w-full max-w-2xl h-[95vh] sm:h-[90vh] md:h-[85vh] flex flex-col bg-card shadow-2xl rounded-lg overflow-hidden">
              <ChatHeader
                currentUser={currentUser}
                otherUser={otherUser} // Can be null
                onProfileClick={() => setIsProfileModalOpen(true)}
                onSendThinkingOfYou={handleSendThought}
                isTargetUserBeingThoughtOf={!!(otherUser && activeThoughtNotificationFor === otherUser.id)}
                onOtherUserAvatarClick={handleOtherUserAvatarClick}
                isOtherUserTyping={!!otherUserIsTyping}
              />
              {otherUser && activeChat ? (
                <MessageArea
                  messages={messages}
                  currentUser={currentUser}
                  allUsers={allUsersForMessageArea}
                  onToggleReaction={handleToggleReaction}
                />
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-4 text-center bg-transparent">
                    <MessagesSquare className="w-16 h-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                        {isChatLoading ? "Looking for chats..." : "No one to chat with yet."}
                    </h3>
                    <p className="text-muted-foreground">
                        {isChatLoading ? "Please wait a moment." : "When another user joins, your conversation will appear here."}
                    </p>
                     {!isChatLoading && (
                        <Button onClick={performLoadChatData} variant="outline" className="mt-4">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" hidden={!isChatLoading} />
                            Refresh Users
                        </Button>
                    )}
                </div>
              )}
              <InputBar
                onSendMessage={handleSendMessage}
                onSendMoodClip={handleSendMoodClip}
                isSending={isLoadingAISuggestion}
                onTyping={handleTyping}
                disabled={!otherUser || !activeChat || !isWsConnected} // Disable if no active chat
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
          onAvatarFileChange={handleAvatarFileChangeHook}
        />
      )}
      {fullScreenUserData && ( // This implies otherUser was not null if this modal opens
        <FullScreenAvatarModal
          isOpen={isFullScreenAvatarOpen}
          onClose={() => setIsFullScreenAvatarOpen(false)}
          user={fullScreenUserData}
        />
      )}
      {currentUser && initialMoodOnLoad && (
        <MoodEntryModal
          isOpen={isMoodModalOpen}
          onClose={() => setIsMoodModalOpen(false)}
          onSetMood={handleSetMoodFromModal}
          currentMood={initialMoodOnLoad}
          onContinueWithCurrent={handleContinueWithCurrentMood}
        />
      )}
      <ReasoningDialog />
    </div>
  );
}

