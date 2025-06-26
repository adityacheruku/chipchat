
"use client";

import React, { useState, useEffect, useCallback, useRef, memo, useMemo, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import dynamic from 'next/dynamic';
import type { User, Message as MessageType, Mood, SupportedEmoji, AppEvent, Chat, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, UserProfileUpdateEventData, MessageAckEventData, MessageMode, ChatModeChangedEventData } from '@/types';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
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
import { useRealtime } from '@/hooks/useRealtime';
import { Loader2, MessagesSquare, Wifi, WifiOff } from 'lucide-react';

const MemoizedMessageArea = memo(MessageArea);
const MemoizedChatHeader = memo(ChatHeader);
const MemoizedInputBar = memo(InputBar);
const FIRST_MESSAGE_SENT_KEY = 'chirpChat_firstMessageSent';

const ModalLoader = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  );

const UserProfileModal = dynamic(() => import('@/components/chat/UserProfileModal'), { ssr: false, loading: () => <ModalLoader /> });
const FullScreenAvatarModal = dynamic(() => import('@/components/chat/FullScreenAvatarModal'), { ssr: false, loading: () => <ModalLoader /> });
const FullScreenMediaModal = dynamic(() => import('@/components/chat/FullScreenMediaModal'), { ssr: false, loading: () => <ModalLoader /> });
const MoodEntryModal = dynamic(() => import('@/components/chat/MoodEntryModal'), { ssr: false, loading: () => <ModalLoader /> });
const ReactionSummaryModal = dynamic(() => import('@/components/chat/ReactionSummaryModal'), { ssr: false, loading: () => <ModalLoader /> });


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

  const [mediaModalData, setMediaModalData] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const [chatMode, setChatMode] = useState<MessageMode>('normal');
  
  // State for infinite scroll
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [topMessageId, setTopMessageId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSendThoughtRef = useRef<() => void>(() => {});

  // All hooks must be called at the top level, before any conditional returns.

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
    if (!currentUser) return;

    if (!currentUser.partner_id) {
        setIsChatLoading(false);
        setChatSetupErrorMessage("No partner found. Redirecting to partner selection...");
        router.push('/onboarding/find-partner');
        return;
    }

    setIsChatLoading(true);
    setChatSetupErrorMessage(null);

    try {
        const partnerDetails = await api.getUserProfile(currentUser.partner_id);
        setOtherUser(partnerDetails);
        if (currentUser.avatar_url) setAvatarPreview(currentUser.avatar_url);

        const chatSession = await api.createOrGetChat(currentUser.partner_id);
        setActiveChat(chatSession);

        if (chatSession) {
            const messagesData = await api.getMessages(chatSession.id, 50);
            if(messagesData.messages.length < 50) setHasMoreMessages(false);
            setMessages(messagesData.messages.map(m => ({...m, client_temp_id: m.client_temp_id || m.id, status: m.status || 'sent' })).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
        } else {
            throw new Error("Failed to establish a chat session with your partner.");
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
        setChatSetupErrorMessage(apiErrorMsg);
    } finally {
        setIsChatLoading(false);
    }
  }, [currentUser, router, setAvatarPreview, toast]);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages || !activeChat || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
        const oldestMessage = messages[0];
        if(!oldestMessage) return;

        setTopMessageId(oldestMessage.id);

        const olderMessagesData = await api.getMessages(activeChat.id, 50, oldestMessage.created_at);
        
        if (olderMessagesData.messages && olderMessagesData.messages.length > 0) {
            const newMessages = olderMessagesData.messages.map(m => ({...m, client_temp_id: m.client_temp_id || m.id, status: m.status || 'sent' }));
            setMessages(prevMessages => [...newMessages, ...prevMessages]);
            if (olderMessagesData.messages.length < 50) setHasMoreMessages(false);
        } else {
            setHasMoreMessages(false);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load older messages.' });
    } finally {
        setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreMessages, activeChat, messages, toast]);

  const handleMessageAck = useCallback((ackData: MessageAckEventData) => {
      setMessages(prevMessages => 
          prevMessages.map(msg => 
              msg.client_temp_id === ackData.client_temp_id
              ? { ...msg, id: ackData.server_assigned_id, status: ackData.status }
              : msg
          )
      );
  }, []);

  const handleNewMessage = useCallback((newMessageFromServer: MessageType) => {
      setMessages(prevMessages => {
        if (prevMessages.some(m => m.client_temp_id === newMessageFromServer.client_temp_id || m.id === newMessageFromServer.id)) {
            return prevMessages.map(m => 
                (m.client_temp_id === newMessageFromServer.client_temp_id || m.id === newMessageFromServer.id)
                ? { ...newMessageFromServer, status: newMessageFromServer.status || 'sent' }
                : m
            ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
        return [...prevMessages, { ...newMessageFromServer, status: newMessageFromServer.status || 'sent' }]
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    if (activeChat && newMessageFromServer.chat_id === activeChat.id && newMessageFromServer.mode !== 'incognito') {
        setActiveChat(prev => prev ? ({...prev, last_message: newMessageFromServer, updated_at: newMessageFromServer.updated_at }) : null);
    }
  }, [activeChat]);

  const handleReactionUpdate = useCallback((data: MessageReactionUpdateEventData) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg
      )
    );
  }, []);

  const handlePresenceUpdate = useCallback((data: UserPresenceUpdateEventData) => {
    setOtherUser(prev => (prev && data.user_id === prev.id) ? { ...prev, is_online: data.is_online, last_seen: data.last_seen, mood: data.mood } : prev);
    if (currentUser && data.user_id === currentUser.id) {
      fetchAndUpdateUser(); 
    }
  }, [currentUser, fetchAndUpdateUser]);

  const handleProfileUpdate = useCallback((data: UserProfileUpdateEventData) => {
    setOtherUser(prev => (prev && data.user_id === prev.id) ? { ...prev, ...data } : prev);
    if (currentUser && data.user_id === currentUser.id) {
        fetchAndUpdateUser(); 
    }
  }, [currentUser, fetchAndUpdateUser]);

  const handleTypingUpdate = useCallback((data: TypingIndicatorEventData) => {
    if (activeChat && data.chat_id === activeChat.id) {
      setTypingUsers(prev => ({ ...prev, [data.user_id]: { userId: data.user_id, isTyping: data.is_typing } }));
    }
  }, [activeChat]);
  
  const handleChatModeChanged = useCallback((data: ChatModeChangedEventData) => {
    if (activeChat && data.chat_id === activeChat.id) {
        setChatMode(data.mode);
        if (currentUser && otherUser) {
            toast({
                title: "Mode Changed",
                description: `${otherUser.display_name} switched the chat to ${data.mode} mode.`,
                duration: 3000,
            });
        }
    }
  }, [activeChat, currentUser, otherUser, toast]);

  const { protocol, sendMessage, isBrowserOnline } = useRealtime({
    onMessageReceived: handleNewMessage,
    onReactionUpdate: handleReactionUpdate,
    onPresenceUpdate: handlePresenceUpdate,
    onTypingUpdate: handleTypingUpdate,
    onThinkingOfYouReceived: handleThinkingOfYou,
    onUserProfileUpdate: handleProfileUpdate,
    onMessageAck: handleMessageAck,
    onChatModeChanged: handleChatModeChanged,
  });

  handleSendThoughtRef.current = useCallback(async () => {
    if (!currentUser || !otherUser) return;
    sendMessage({ event_type: "ping_thinking_of_you", recipient_user_id: otherUser.id });
    initiateThoughtNotification(otherUser.id, otherUser.display_name, currentUser.display_name);
    addAppEvent('thoughtPingSent', `${currentUser.display_name} sent 'thinking of you' to ${otherUser.display_name}.`, currentUser.id, currentUser.display_name);
  }, [currentUser, otherUser, sendMessage, initiateThoughtNotification, addAppEvent]);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!activeChat) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendMessage({ event_type: isTyping ? "start_typing" : "stop_typing", chat_id: activeChat.id });
    if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => sendMessage({ event_type: "stop_typing", chat_id: activeChat.id }), 3000);
    }
  }, [activeChat, sendMessage]);

  const handleSendMessage = useCallback((text: string, mode: MessageMode) => {
    if (!currentUser || !activeChat) return;
    if (!text.trim()) return;

    handleTyping(false);
    const clientTempId = uuidv4();
    const optimisticMessage: MessageType = {
      id: clientTempId, user_id: currentUser.id, chat_id: activeChat.id, text,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      reactions: {}, client_temp_id: clientTempId, status: "sending", message_subtype: "text", mode: mode,
    };
    setMessages(prev => [...prev, optimisticMessage].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

    sendMessage({
        event_type: "send_message", chat_id: activeChat.id, text, mode,
        client_temp_id: clientTempId, message_subtype: "text",
    });

    addAppEvent('messageSent', `${currentUser.display_name} sent: "${text.substring(0, 30)}"`, currentUser.id, currentUser.display_name);

    if (ENABLE_AI_MOOD_SUGGESTION && currentUser.mood) {
      lastMessageTextRef.current = text; aiSuggestMood(text);
    }
    if (isPushApiSupported && !isSubscribed && permissionStatus === 'default') {
        if (localStorage.getItem(FIRST_MESSAGE_SENT_KEY) !== 'true') {
            localStorage.setItem(FIRST_MESSAGE_SENT_KEY, 'true');
            setTimeout(() => setShowNotificationPrompt(true), 2000);
        }
    }
  }, [currentUser, activeChat, handleTyping, sendMessage, addAppEvent, aiSuggestMood, isPushApiSupported, isSubscribed, permissionStatus]);
  
  const handleFileUpload = useCallback(async (
    file: File,
    subtype: MessageType['message_subtype'],
    mode: MessageMode,
    uploadFunction: (file: File, onProgress: (progress: number) => void) => Promise<any>
  ) => {
      if (!currentUser || !activeChat) return;

      const clientTempId = uuidv4();
      const optimisticMessage: MessageType = {
        id: clientTempId, user_id: currentUser.id, chat_id: activeChat.id,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        status: 'uploading', uploadProgress: 0, client_temp_id: clientTempId,
        message_subtype: subtype, mode: mode, file: file,
        image_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        clip_url: file.type.startsWith('video/') ? URL.createObjectURL(file) : undefined,
        document_name: file.name,
      };

      setMessages(prev => [...prev, optimisticMessage].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      
      try {
          const onProgress = (progress: number) => {
              setMessages(prev => prev.map(msg => msg.client_temp_id === clientTempId ? { ...msg, uploadProgress: progress } : msg));
          };
          
          const uploadResult = await uploadFunction(file, onProgress);

          let messagePayload: any = {
              event_type: "send_message", chat_id: activeChat.id, client_temp_id: clientTempId,
              message_subtype: subtype, mode: mode,
          };

          if (subtype === 'image') {
              messagePayload.image_url = uploadResult.image_url; messagePayload.image_thumbnail_url = uploadResult.image_thumbnail_url;
          } else if (subtype === 'document') {
              messagePayload.document_url = uploadResult.file_url; messagePayload.document_name = uploadResult.file_name;
          } else if (subtype === 'voice_message') {
              messagePayload.clip_url = uploadResult.file_url; messagePayload.duration_seconds = uploadResult.duration_seconds;
              messagePayload.file_size_bytes = uploadResult.file_size_bytes; messagePayload.audio_format = uploadResult.audio_format;
          }
          
          sendMessage(messagePayload);
          addAppEvent('messageSent', `${currentUser.display_name} sent a ${subtype}.`, currentUser.display_name, currentUser.id);
          setMessages(prev => prev.map(msg => msg.client_temp_id === clientTempId ? { ...msg, status: 'sending', uploadProgress: 100 } : msg));
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
          setMessages(prev => prev.map(msg => msg.client_temp_id === clientTempId ? { ...msg, status: 'failed' } : msg));
      }
  }, [currentUser, activeChat, sendMessage, addAppEvent, toast]);

  const handleSendImage = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, 'image', mode, api.uploadChatImage), [handleFileUpload]);
  const handleSendDocument = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, 'document', mode, api.uploadChatDocument), [handleFileUpload]);
  const handleSendVoiceMessage = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, 'voice_message', mode, api.uploadVoiceMessage), [handleFileUpload]);
  const handleSendSticker = useCallback((stickerId: string, mode: MessageMode) => {
    if (!currentUser || !activeChat) return;
    const clientTempId = uuidv4();
    sendMessage({ event_type: "send_message", chat_id: activeChat.id, sticker_id: stickerId, client_temp_id: clientTempId, message_subtype: "sticker", mode });
    addAppEvent('messageSent', `${currentUser.display_name} sent a sticker.`, currentUser.display_name, currentUser.id);
  }, [currentUser, activeChat, sendMessage, addAppEvent]);
  
  const handleToggleReaction = useCallback((messageId: string, emoji: SupportedEmoji) => {
    if (!currentUser || !activeChat) return;

    const message = messages.find(m => m.id === messageId);
    if (message?.mode === 'incognito') {
        toast({ title: "Can't React", description: "Reactions are disabled for incognito messages.", duration: 2000 });
        return;
    }

    const RATE_LIMIT_MS = 500;
    const key = `${messageId}_${emoji}`;
    const now = Date.now();
    if (lastReactionToggleTimes.current[key] && (now - lastReactionToggleTimes.current[key] < RATE_LIMIT_MS)) return;
    lastReactionToggleTimes.current[key] = now;

    setMessages(prevMessages => 
      prevMessages.map(msg => {
        if (msg.id === messageId) {
          const newReactions = JSON.parse(JSON.stringify(msg.reactions || {}));
          if (!newReactions[emoji]) newReactions[emoji] = [];
          const userReactedIndex = newReactions[emoji].indexOf(currentUser.id);
          if (userReactedIndex > -1) { newReactions[emoji].splice(userReactedIndex, 1); if (newReactions[emoji].length === 0) delete newReactions[emoji];
          } else { newReactions[emoji].push(currentUser.id); }
          return { ...msg, reactions: newReactions };
        }
        return msg;
      })
    );
    sendMessage({ event_type: "toggle_reaction", message_id: messageId, chat_id: activeChat.id, emoji });
    addAppEvent('reactionAdded', `${currentUser.display_name} toggled ${emoji} reaction.`, currentUser.id, currentUser.display_name, { messageId });
  }, [currentUser, activeChat, sendMessage, addAppEvent, messages, toast]);

  const handleSaveProfile = useCallback(async (updatedProfileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone' | 'email'>>, newAvatarFile?: File, onProgress?: (progress: number) => void) => {
    if (!currentUser) return;
    try {
      if (newAvatarFile && onProgress) await api.uploadAvatar(newAvatarFile, onProgress);
      if (Object.keys(updatedProfileData).length > 0) await api.updateUserProfile(updatedProfileData);
      await fetchAndUpdateUser(); 
      toast({ title: "Profile Updated", description: "Your profile has been saved." });
      addAppEvent('profileUpdate', `${currentUser.display_name} updated profile.`, currentUser.id, currentUser.display_name);
      setIsProfileModalOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Profile Save Failed', description: error.message });
      throw error;
    }
  }, [currentUser, fetchAndUpdateUser, toast, addAppEvent]);

  const handleThinkingOfYou = useCallback((data: ThinkingOfYouReceivedEventData) => {
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

  const getDynamicBackgroundClass = useCallback((mood1?: Mood, mood2?: Mood): string => {
    if (!mood1 || !mood2) return 'bg-mood-default-chat-area';
    if (mood1 === 'Happy' && mood2 === 'Happy') return 'bg-mood-happy-happy';
    if (mood1 === 'Excited' && mood2 === 'Excited') return 'bg-mood-excited-excited';
    if ( (mood1 === 'Chilling' || mood1 === 'Neutral' || mood1 === 'Thoughtful' || mood1 === 'Content') &&
         (mood2 === 'Chilling' || mood2 === 'Neutral' || mood2 === 'Thoughtful' || mood2 === 'Content') ) {
        if (['Chilling', 'Neutral', 'Thoughtful', 'Content'].includes(mood1) && ['Chilling', 'Neutral', 'Thoughtful', 'Content'].includes(mood2)) return 'bg-mood-calm-calm';
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

  const handleOtherUserAvatarClick = useCallback(() => {
    if (otherUser) { setFullScreenUserData(otherUser); setIsFullScreenAvatarOpen(true); }
  }, [otherUser]);

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
    if (message.reactions && Object.keys(message.reactions).length > 0) setReactionModalData({ reactions: message.reactions, allUsers });
  }, []);

  const handleEnableNotifications = useCallback(() => { subscribeToPush(); setShowNotificationPrompt(false); }, [subscribeToPush]);
  const handleDismissNotificationPrompt = useCallback(() => { setShowNotificationPrompt(false); sessionStorage.setItem('notificationPromptDismissed', 'true'); }, []);
  const handleShowMedia = useCallback((url: string, type: 'image' | 'video') => setMediaModalData({ url, type }), []);

  const handleSelectMode = useCallback((mode: MessageMode) => {
    if (!activeChat) return;
    setChatMode(mode);
    sendMessage({ event_type: "change_chat_mode", chat_id: activeChat.id, mode: mode });
    toast({ title: `Switched to ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`, duration: 2000 });
  }, [activeChat, sendMessage, toast]);

  const filteredMessages = useMemo(() => {
    const incognitoMessages = messages.filter(msg => msg.mode === 'incognito');
  
    const modeSpecificMessages = messages.filter(msg => {
      if (msg.mode === 'incognito') return false;
      if (chatMode === 'normal') return msg.mode === 'normal' || !msg.mode;
      return msg.mode === chatMode;
    });

    return [...modeSpecificMessages, ...incognitoMessages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, chatMode]);

  const allUsersForMessageArea = useMemo(() => (currentUser && otherUser ? {[currentUser.id]: currentUser, [otherUser.id]: otherUser} : {}), [currentUser, otherUser]);
  const onProfileClick = useCallback(() => setIsProfileModalOpen(true), []);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
        router.push('/');
        return;
    }
    if (isAuthenticated && currentUser) {
        performLoadChatData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAuthLoading, currentUser?.id]);

  useEffect(() => {
    let newBgClass = 'bg-mood-default-chat-area';
    if (chatMode === 'fight') {
      newBgClass = 'bg-mode-fight';
    } else if (chatMode === 'incognito') {
      newBgClass = 'bg-mode-incognito';
    } else if (currentUser?.mood && otherUser?.mood) {
      newBgClass = getDynamicBackgroundClass(currentUser.mood, otherUser.mood);
    }
    setDynamicBgClass(newBgClass);
  }, [chatMode, currentUser?.mood, otherUser?.mood, getDynamicBackgroundClass]);

  useEffect(() => {
    const incognitoMessages = messages.filter(m => m.mode === 'incognito');
    if (incognitoMessages.length > 0) {
      const timer = setTimeout(() => {
        setMessages(prev => prev.filter(m => m.mode !== 'incognito'));
      }, 30 * 1000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  useLayoutEffect(() => {
    if (topMessageId && viewportRef.current) {
        const topMessageElement = viewportRef.current.querySelector(`#message-${topMessageId}`);
        if (topMessageElement) {
            topMessageElement.scrollIntoView({ block: 'start', behavior: 'instant' });
        }
        setTopMessageId(null);
    }
  }, [topMessageId, messages]);

  // --- Early Returns & Non-Hook Logic ---

  const isLoadingPage = isAuthLoading || (isAuthenticated && isChatLoading);
  const isInputDisabled = protocol === 'disconnected';

  const ConnectionStatusBanner = () => {
    if (protocol === 'disconnected' && !isBrowserOnline) return <div className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground p-2 text-center text-sm z-50 flex items-center justify-center gap-2"><WifiOff size={16} />You are offline. Features may be limited.</div>;
    if (protocol === 'sse' || protocol === 'fallback') return <div className="fixed top-0 left-0 right-0 bg-amber-500 text-black p-2 text-center text-sm z-50 flex items-center justify-center gap-2"><Wifi size={16} />Connected via fallback. Some features may be slower.</div>;
    if (protocol === 'connecting' || protocol === 'syncing') return <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white p-2 text-center text-sm z-50 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />{protocol === 'syncing' ? 'Syncing...' : 'Connecting...'}</div>;
    return null;
  };

  if (isLoadingPage) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-foreground ml-4">Loading your profile...</p></div>;
  if (!isAuthenticated && !isAuthLoading) return <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center"><div><p className="text-destructive text-lg mb-4">Authentication required.</p><Button onClick={() => router.push('/')} variant="outline">Go to Login</Button></div></div>;
  if (!otherUser || !activeChat) return <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center"><div><Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /><p className="text-lg text-foreground">Setting up your chat...</p>{chatSetupErrorMessage && <p className="text-destructive mt-2">{chatSetupErrorMessage}</p>}<Button variant="link" className="mt-4" onClick={() => router.push('/onboarding/find-partner')}>Find a Partner</Button></div></div>;

  const otherUserIsTyping = otherUser && typingUsers[otherUser.id]?.isTyping;

  return (
    <div className={cn("flex flex-col h-screen overflow-hidden", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
      <ConnectionStatusBanner />
      <div className={cn("flex-grow w-full flex items-center justify-center p-2 sm:p-4 overflow-hidden", (protocol !== 'websocket' && protocol !== 'disconnected') && 'pt-10')}>
        <ErrorBoundary fallbackMessage="The chat couldn't be displayed. Try refreshing the page.">
          <div className="w-full max-w-2xl h-full flex flex-col bg-card shadow-2xl rounded-lg overflow-hidden relative">
            <NotificationPrompt isOpen={showNotificationPrompt} onEnable={handleEnableNotifications} onDismiss={handleDismissNotificationPrompt} title="Enable Notifications" message={otherUser ? `Stay connected with ${otherUser.display_name} even when ChirpChat is closed.` : 'Get notified about important activity.'}/>
            <MemoizedChatHeader currentUser={currentUser} otherUser={otherUser} onProfileClick={onProfileClick} onSendThinkingOfYou={handleSendThoughtRef.current} isTargetUserBeingThoughtOf={!!(otherUser && activeThoughtNotificationFor === otherUser.id)} onOtherUserAvatarClick={handleOtherUserAvatarClick} isOtherUserTyping={!!otherUserIsTyping}/>
            <MemoizedMessageArea 
              viewportRef={viewportRef}
              messages={filteredMessages} 
              currentUser={currentUser} 
              allUsers={allUsersForMessageArea} 
              onToggleReaction={handleToggleReaction} 
              onShowReactions={(message) => handleShowReactions(message, allUsersForMessageArea)} 
              onShowMedia={handleShowMedia}
              onLoadMore={loadMoreMessages}
              hasMore={hasMoreMessages}
              isLoadingMore={isLoadingMore}
            />
            <MemoizedInputBar onSendMessage={handleSendMessage} onSendSticker={handleSendSticker} onSendVoiceMessage={handleSendVoiceMessage} onSendImage={handleSendImage} onSendDocument={handleSendDocument} isSending={isLoadingAISuggestion} onTyping={handleTyping} disabled={isInputDisabled} chatMode={chatMode} onSelectMode={handleSelectMode} />
          </div>
        </ErrorBoundary>
      </div>
      {isProfileModalOpen && currentUser && <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={currentUser} onSave={handleSaveProfile} avatarPreview={avatarPreview || currentUser.avatar_url} onAvatarFileChange={handleAvatarFileChangeHook}/>}
      {fullScreenUserData && <FullScreenAvatarModal isOpen={isFullScreenAvatarOpen} onClose={() => setIsFullScreenAvatarOpen(false)} user={fullScreenUserData}/>}
      {mediaModalData && <FullScreenMediaModal isOpen={!!mediaModalData} onClose={() => setMediaModalData(null)} mediaUrl={mediaModalData.url} mediaType={mediaModalData.type}/>}
      {currentUser && initialMoodOnLoad && <MoodEntryModal isOpen={isMoodModalOpen} onClose={() => setIsMoodModalOpen(false)} onSetMood={handleSetMoodFromModal} currentMood={initialMoodOnLoad} onContinueWithCurrent={handleContinueWithCurrentMood}/>}
      <ReasoningDialog />
      {reactionModalData && <ReactionSummaryModal isOpen={!!reactionModalData} onClose={() => setReactionModalData(null)} reactions={reactionModalData.reactions} allUsers={reactionModalData.allUsers}/>}
    </div>
  );
}
