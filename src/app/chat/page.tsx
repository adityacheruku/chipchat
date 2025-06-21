
"use client";

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType, Mood, SupportedEmoji, MessageClipType, AppEvent, Chat, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, UserProfileUpdateEventData, MessageStatus } from '@/types';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import UserProfileModal from '@/components/chat/UserProfileModal';
import FullScreenAvatarModal from '@/components/chat/FullScreenAvatarModal';
import MoodEntryModal from '@/components/chat/MoodEntryModal';
import NotificationPrompt from '@/components/chat/NotificationPrompt';
import { Button } from '@/components/ui/button';
import { ToastAction } from "@/components/ui/toast";
import { useToast } from '@/hooks/use-toast';
import { useThoughtNotification } from '@/hooks/useThoughtNotification';
import { useAvatar } from '@/hooks/useAvatar';
import { useMoodSuggestion } from '@/hooks/useMoodSuggestion.tsx';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { THINKING_OF_YOU_DURATION, MAX_AVATAR_SIZE_KB, ENABLE_AI_MOOD_SUGGESTION } from '@/config/app-config';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Loader2, MessagesSquare, WifiOff } from 'lucide-react';
import ReactionSummaryModal from '@/components/chat/ReactionSummaryModal';

const MemoizedMessageArea = memo(MessageArea);
const FIRST_MESSAGE_SENT_KEY = 'chirpChat_firstMessageSent';

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, token, logout, fetchAndUpdateUser, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isSubscribed, permissionStatus, subscribeToPush, isPushApiSupported } = usePushNotifications();

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

  const [reactionModalData, setReactionModalData] = useState<{ reactions: MessageType['reactions'], allUsers: Record<string, User> } | null>(null);
  const lastReactionToggleTimes = useRef<Record<string, number>>({});
  const lastMessageTextRef = useRef<string>("");
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

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
    console.log('[ChatPage] performLoadChatData: Starting. CurrentUser ID:', currentUser?.id, 'DisplayName:', currentUser?.display_name);

    try {
      const partner = await api.getDefaultChatPartner();
      console.log('[ChatPage] performLoadChatData: Default partner response:', partner);


      if (!partner) {
        console.log('[ChatPage] performLoadChatData: No default partner found. Setting up for solo/waiting state.');
        setOtherUser(null);
        setActiveChat(null);
        setMessages([]);
        if (currentUser.avatar_url) setAvatarPreview(currentUser.avatar_url);
        if (typeof window !== 'undefined' && currentUser.mood) {
            const moodPrompted = sessionStorage.getItem('moodPromptedThisSession');
            if (moodPrompted !== 'true') {
            setInitialMoodOnLoad(currentUser.mood);
            setIsMoodModalOpen(true);
            }
        }
        setIsChatLoading(false);
        return;
      }

      const otherUserDetails = await api.getUserProfile(partner.user_id);
      console.log('[ChatPage] performLoadChatData: Fetched otherUser details:', otherUserDetails);
      setOtherUser(otherUserDetails);
      if (currentUser.avatar_url) setAvatarPreview(currentUser.avatar_url);

      const chatSession = await api.createOrGetChat(partner.user_id);
      console.log('[ChatPage] performLoadChatData: Created/Got chat session:', chatSession);
      setActiveChat(chatSession);

      if (chatSession) {
        const messagesData = await api.getMessages(chatSession.id);
        setMessages(messagesData.messages.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      } else {
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
      console.error('[ChatPage] performLoadChatData: Error -', apiErrorMsg, error);
      toast({ variant: 'destructive', title: 'API Error', description: apiErrorMsg, duration: 7000 });
      addAppEvent('apiError', 'Failed to load initial chat data', currentUser?.id, currentUser?.display_name, { error: error.message });
      setChatSetupErrorMessage(apiErrorMsg);
      setOtherUser(null);
      setActiveChat(null);
    } finally {
      setIsChatLoading(false);
    }
  }, [ currentUser, token, toast, addAppEvent, setAvatarPreview, isAuthLoading ]);


  const handleWSMessageReceived = useCallback((newMessageFromServer: MessageType) => {
    setMessages(prevMessages => {
      const optimisticMessageIndex = newMessageFromServer.client_temp_id 
        ? prevMessages.findIndex(m => m.client_temp_id === newMessageFromServer.client_temp_id && m.status === "sending")
        : -1;

      let updatedMessages;
      if (optimisticMessageIndex > -1) {
        updatedMessages = [...prevMessages];
        updatedMessages[optimisticMessageIndex] = newMessageFromServer; 
      } else {
        if (prevMessages.find(m => m.id === newMessageFromServer.id)) {
            return prevMessages; 
        }
        updatedMessages = [...prevMessages, newMessageFromServer];
      }
      return updatedMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    if (activeChat && newMessageFromServer.chat_id === activeChat.id) {
        setActiveChat(prev => prev ? ({...prev, last_message: newMessageFromServer, updated_at: newMessageFromServer.updated_at }) : null);
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
      fetchAndUpdateUser(); 
    }
  }, [otherUser, currentUser, fetchAndUpdateUser]);

  const handleWSUserProfileUpdate = useCallback((data: UserProfileUpdateEventData) => {
    if (otherUser && data.user_id === otherUser.id) {
        setOtherUser(prev => prev ? { ...prev, ...data } : null);
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

  // Define handleSendThought AFTER useWebSocket to use its return values
  const handleSendThought = useCallback(async () => {
    if (!currentUser || !otherUser) return;
    // The implementation will be defined after the WebSocket hook is initialized.
    // This empty shell with a ref ensures the function exists for dependencies.
  }, [currentUser, otherUser]);
  
  const handleSendThoughtRef = useRef(handleSendThought);
  useEffect(() => {
    handleSendThoughtRef.current = handleSendThought;
  }, [handleSendThought]);


  const handleWSThinkingOfYou = useCallback((data: ThinkingOfYouReceivedEventData) => {
    if (otherUser && data.sender_id === otherUser.id) {
      toast({
        title: "❤️ Thinking of You!",
        description: `${otherUser.display_name} is thinking of you.`,
        duration: THINKING_OF_YOU_DURATION,
        action: (
          <ToastAction altText="Send one back" onClick={() => handleSendThoughtRef.current()}>
            Send one back?
          </ToastAction>
        ),
      });
    }
  }, [otherUser, toast]); 

  const { isConnected: isWsConnected, sendMessage: sendWsMessage, isBrowserOnline } = useWebSocket({
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

  // Now, redefine handleSendThought with the actual logic, using values from the hook.
  handleSendThoughtRef.current = useCallback(async () => {
    if (!currentUser || !otherUser) return;
    try {
      if (isWsConnected) {
        sendWsMessage({
            event_type: "ping_thinking_of_you",
            recipient_user_id: otherUser.id,
        });
      } else {
        // Fallback to HTTP if WebSocket is not connected
        await api.sendThinkingOfYouPing(otherUser.id);
      }
      initiateThoughtNotification(otherUser.id, otherUser.display_name, currentUser.display_name);
      addAppEvent('thoughtPingSent', `${currentUser.display_name} sent 'thinking of you' to ${otherUser.display_name}.`, currentUser.id, currentUser.display_name);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Ping Failed', description: error.message });
    }
  }, [currentUser, otherUser, isWsConnected, sendWsMessage, initiateThoughtNotification, addAppEvent, toast]);


 useEffect(() => {
    console.log('[ChatPage] Auth State Change: isAuthenticated:', isAuthenticated, 'isAuthLoading:', isAuthLoading, 'currentUser:', currentUser?.id);
    if (!isAuthenticated && !isAuthLoading) {
      router.push('/');
      setOtherUser(null);
      setActiveChat(null);
      setMessages([]);
      setTypingUsers({});
      setChatSetupErrorMessage(null);
      return;
    }

    if (isAuthenticated && currentUser && token) {
      console.log('[ChatPage] useEffect[auth]: User changed or authenticated. CurrentUser ID:', currentUser.id);
      setOtherUser(null);
      setActiveChat(null);
      setMessages([]);
      setTypingUsers({});
      setChatSetupErrorMessage(null);
      performLoadChatData();
    } else if (!isAuthLoading && !currentUser) {
      console.log('[ChatPage] useEffect[auth]: User logged out or no current user.');
      setOtherUser(null);
      setActiveChat(null);
      setMessages([]);
      setTypingUsers({});
      setChatSetupErrorMessage(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAuthLoading, currentUser, token, router]); 

  const handleSendMessage = (text: string) => {
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;

    const clientTempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMessage: MessageType = {
      id: clientTempId, 
      user_id: currentUser.id,
      chat_id: activeChat.id,
      text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reactions: {},
      client_temp_id: clientTempId,
      status: "sending" as MessageStatus, 
    };
    setMessages(prev => [...prev, optimisticMessage].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));


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

    // Progressive disclosure for notifications
    if (isPushApiSupported && !isSubscribed && permissionStatus === 'default') {
        const hasSentFirstMessage = localStorage.getItem(FIRST_MESSAGE_SENT_KEY) === 'true';
        if (!hasSentFirstMessage) {
            localStorage.setItem(FIRST_MESSAGE_SENT_KEY, 'true');
            setTimeout(() => setShowNotificationPrompt(true), 2000); // Show prompt after a short delay
        }
    }
  };

  const handleSendSticker = (stickerId: string) => {
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;

    const clientTempId = `temp_sticker_${Date.now()}`;
    // No optimistic update for stickers, as we need the sticker_image_url from the backend.
    // The message will appear once the WebSocket roundtrip is complete.
    
    sendWsMessage({
        event_type: "send_message",
        chat_id: activeChat.id,
        sticker_id: stickerId,
        client_temp_id: clientTempId,
    });
    addAppEvent('messageSent', `${currentUser.display_name} sent a sticker.`, currentUser.id, currentUser.display_name);
  };


  const handleSendMoodClip = async (clipType: MessageClipType, file: File) => {
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;
    toast({ title: "Uploading clip..."});
    const clientTempId = `temp_clip_${Date.now()}`;
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
            client_temp_id: clientTempId,
        });
        addAppEvent('moodClipSent', `${currentUser.display_name} sent a ${clipType} clip.`, currentUser.id, currentUser.display_name);
        toast({ title: "Mood Clip Sent!" });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Clip Upload Failed', description: error.message });
    }
  };

   const handleSendImage = async (file: File) => {
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;
    toast({ title: "Uploading image..." });
    const clientTempId = `temp_img_${Date.now()}`;
    try {
      const { image_url, image_thumbnail_url } = await api.uploadChatImage(file);
      sendWsMessage({
        event_type: "send_message",
        chat_id: activeChat.id,
        image_url,
        image_thumbnail_url,
        client_temp_id: clientTempId,
      });
      addAppEvent('messageSent', `${currentUser.display_name} sent an image.`, currentUser.id, currentUser.display_name);
      toast({ title: "Image Sent!" });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Image Upload Failed', description: error.message });
    }
  };

  const handleSendDocument = async (file: File) => {
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;
    toast({ title: "Uploading document..." });
    const clientTempId = `temp_doc_${Date.now()}`;
    try {
      const uploadResponse = await api.uploadChatDocument(file);
      sendWsMessage({
        event_type: "send_message",
        chat_id: activeChat.id,
        document_url: uploadResponse.file_url,
        document_name: uploadResponse.file_name,
        client_temp_id: clientTempId,
      });
      addAppEvent('messageSent', `${currentUser.display_name} sent a document: ${uploadResponse.file_name}.`, currentUser.id, currentUser.display_name);
      toast({ title: "Document Sent!" });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Document Upload Failed', description: error.message });
    }
  };

  const handleSendVoiceMessage = async (file: File) => {
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;
    toast({ title: "Uploading voice message..." });
    const clientTempId = `temp_audio_${Date.now()}`;
    try {
      const uploadResponse = await api.uploadVoiceMessage(file);
      const placeholderText = `${currentUser.display_name} sent a voice message.`;
      
      const payload: Record<string, any> = {
          event_type: "send_message",
          chat_id: activeChat.id,
          clip_type: 'audio',
          clip_url: uploadResponse.file_url,
          clip_placeholder_text: placeholderText,
          client_temp_id: clientTempId,
          duration_seconds: uploadResponse.duration_seconds,
          file_size_bytes: uploadResponse.file_size_bytes,
          audio_format: uploadResponse.audio_format,
      };
      
      sendWsMessage(payload);
      
      addAppEvent('messageSent', `${currentUser.display_name} sent a voice message.`, currentUser.id, currentUser.display_name);
      toast({ title: "Voice Message Sent!" });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Voice Message Upload Failed', description: error.message });
    }
  };

  const handleToggleReaction = useCallback((messageId: string, emoji: SupportedEmoji) => {
    if (!currentUser || !activeChat || !isWsConnected || !otherUser) return;
    
    const RATE_LIMIT_MS = 500;
    const key = `${messageId}_${emoji}`;
    const now = Date.now();

    if (lastReactionToggleTimes.current[key] && (now - lastReactionToggleTimes.current[key] < RATE_LIMIT_MS)) {
      return; 
    }
    lastReactionToggleTimes.current[key] = now;

    setMessages(prevMessages => 
      prevMessages.map(msg => {
        if (msg.id === messageId) {
          const newReactions = JSON.parse(JSON.stringify(msg.reactions || {}));
          if (!newReactions[emoji]) newReactions[emoji] = [];
          
          const userReactedIndex = newReactions[emoji].indexOf(currentUser.id);

          if (userReactedIndex > -1) {
            newReactions[emoji].splice(userReactedIndex, 1);
            if (newReactions[emoji].length === 0) {
              delete newReactions[emoji];
            }
          } else {
            newReactions[emoji].push(currentUser.id);
          }
          return { ...msg, reactions: newReactions };
        }
        return msg;
      })
    );

    sendWsMessage({
      event_type: "toggle_reaction",
      message_id: messageId,
      chat_id: activeChat.id,
      emoji: emoji,
    });

    addAppEvent('reactionAdded', `${currentUser.display_name} toggled ${emoji} reaction.`, currentUser.id, currentUser.display_name, { messageId });
  }, [currentUser, activeChat, isWsConnected, otherUser, sendWsMessage, addAppEvent]);

  const handleSaveProfile = async (updatedProfileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone' | 'email'>>, newAvatarFile?: File) => {
    if (!currentUser) return;
    try {
      if (newAvatarFile) {
        toast({title: "Uploading avatar..."});
        const avatarUploadResponse = await api.uploadAvatar(newAvatarFile); 
        setAvatarPreview(avatarUploadResponse.avatar_url); 
      }
      const textUpdates = { ...updatedProfileData };
      if (Object.keys(textUpdates).length > 0) {
         await api.updateUserProfile(textUpdates);
      }
      await fetchAndUpdateUser(); 
      toast({ title: "Profile Updated", description: "Your profile has been saved." });
      addAppEvent('profileUpdate', `${currentUser.display_name} updated profile.`, currentUser.id, currentUser.display_name);
      setIsProfileModalOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Profile Save Failed', description: error.message });
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

  const handleShowReactions = useCallback((message: MessageType, allUsers: Record<string, User>) => {
    if (message.reactions && Object.keys(message.reactions).length > 0) {
      setReactionModalData({ reactions: message.reactions, allUsers });
    }
  }, []);

  const handleEnableNotifications = useCallback(() => {
    subscribeToPush();
    setShowNotificationPrompt(false);
  }, [subscribeToPush]);

  const handleDismissNotificationPrompt = useCallback(() => {
    setShowNotificationPrompt(false);
    // Optionally, set a flag in sessionStorage to not ask again this session
    sessionStorage.setItem('notificationPromptDismissed', 'true');
  }, []);

  const isLoadingPage = isAuthLoading || (isAuthenticated && isChatLoading && !chatSetupErrorMessage && !otherUser && !activeChat);
  if (isLoadingPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-foreground ml-4">Loading chat environment...</p>
      </div>
    );
  }


  if (!isAuthenticated && !isAuthLoading) {
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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" hidden={!isChatLoading} />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
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
  const disabled = !otherUser || !activeChat || !isWsConnected;

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-screen p-0 sm:p-0 transition-colors duration-500 relative", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
        {!isBrowserOnline && (
            <div className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground p-2 text-center text-sm z-50 flex items-center justify-center">
                <WifiOff size={16} className="mr-2" />
                You are offline. Connecting...
            </div>
        )}
        <div className={cn("flex flex-col items-center justify-center w-full h-full p-2 sm:p-4", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass, !isBrowserOnline ? 'pt-10' : '')}>
          <ErrorBoundary fallbackMessage="The chat couldn't be displayed. Try resetting or refreshing the page.">
            <div className="w-full max-w-2xl h-[95vh] sm:h-[90vh] md:h-[85vh] flex flex-col bg-card shadow-2xl rounded-lg overflow-hidden relative">
              <NotificationPrompt
                isOpen={showNotificationPrompt}
                onEnable={handleEnableNotifications}
                onDismiss={handleDismissNotificationPrompt}
                partnerName={otherUser?.display_name}
              />
              <ChatHeader
                currentUser={currentUser}
                otherUser={otherUser}
                onProfileClick={() => setIsProfileModalOpen(true)}
                onSendThinkingOfYou={() => handleSendThoughtRef.current?.()}
                isTargetUserBeingThoughtOf={!!(otherUser && activeThoughtNotificationFor === otherUser.id)}
                onOtherUserAvatarClick={handleOtherUserAvatarClick}
                isOtherUserTyping={!!otherUserIsTyping}
              />
              {otherUser && activeChat ? (
                <MemoizedMessageArea
                  messages={messages}
                  currentUser={currentUser}
                  allUsers={allUsersForMessageArea}
                  onToggleReaction={handleToggleReaction}
                  onShowReactions={(message) => handleShowReactions(message, allUsersForMessageArea)}
                />
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-4 text-center bg-transparent">
                    <MessagesSquare className="w-16 h-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                        {isChatLoading ? "Looking for chats..." : "No one to chat with yet."}
                    </h3>
                    <p className="text-muted-foreground">
                        {isChatLoading ? "Please wait a moment." : "When another user joins, or if you want to try again:"}
                    </p>
                     {!isChatLoading && (
                        <Button onClick={performLoadChatData} variant="outline" className="mt-4">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" hidden={!isChatLoading} />
                            Refresh / Find Partner
                        </Button>
                    )}
                </div>
              )}
              <InputBar
                onSendMessage={handleSendMessage}
                onSendSticker={handleSendSticker}
                onSendMoodClip={handleSendMoodClip}
                onSendVoiceMessage={handleSendVoiceMessage}
                onSendImage={handleSendImage}
                onSendDocument={handleSendDocument}
                isSending={isLoadingAISuggestion}
                onTyping={handleTyping}
                disabled={disabled || !isBrowserOnline || !isWsConnected}
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
      {fullScreenUserData && (
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
      {reactionModalData && (
        <ReactionSummaryModal
          isOpen={!!reactionModalData}
          onClose={() => setReactionModalData(null)}
          reactions={reactionModalData.reactions}
          allUsers={reactionModalData.allUsers}
        />
      )}
    </div>
  );
}
