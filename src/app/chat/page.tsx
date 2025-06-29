

"use client";

import React, { useState, useEffect, useCallback, useRef, memo, useMemo, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import dynamic from 'next/dynamic';
import type { User, Message as MessageType, Mood, SupportedEmoji, Chat, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, UserProfileUpdateEventData, MessageAckEventData, MessageMode, ChatModeChangedEventData, DeleteType, MessageDeletedEventData, ChatHistoryClearedEventData, UploadProgress } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useThoughtNotification } from '@/hooks/useThoughtNotification';
import { useMoodSuggestion } from '@/hooks/useMoodSuggestion.tsx';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { THINKING_OF_YOU_DURATION, ENABLE_AI_MOOD_SUGGESTION } from '@/config/app-config';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { useRealtime } from '@/hooks/useRealtime';
import { uploadManager } from '@/services/uploadManager';
import { Wifi, WifiOff, Trash2, Video, File } from 'lucide-react';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import NotificationPrompt from '@/components/chat/NotificationPrompt';
import DeleteMessageDialog from '@/components/chat/DeleteMessageDialog';
import FloatingMoodButton from '@/components/chat/FloatingMoodButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from '@/components/ui/button';
import FullPageLoader from '@/components/common/FullPageLoader';
import Spinner from '@/components/common/Spinner';
import MessageInfoModal from '@/components/chat/MessageInfoModal';


const MemoizedMessageArea = memo(MessageArea);
const MemoizedChatHeader = memo(ChatHeader);
const MemoizedInputBar = memo(InputBar);

const MOOD_PROMPT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FIRST_MESSAGE_SENT_KEY = 'kuchlu_firstMessageSent';
const MESSAGE_SEND_TIMEOUT_MS = 15000;

const FullScreenAvatarModal = dynamic(() => import('@/components/chat/FullScreenAvatarModal'), { ssr: false, loading: () => <FullPageLoader /> });
const FullScreenMediaModal = dynamic(() => import('@/components/chat/FullScreenMediaModal'), { ssr: false, loading: () => <FullPageLoader /> });
const MoodEntryModal = dynamic(() => import('@/components/chat/MoodEntryModal'), { ssr: false, loading: () => <FullPageLoader /> });
const ReactionSummaryModal = dynamic(() => import('@/components/chat/ReactionSummaryModal'), { ssr: false, loading: () => <FullPageLoader /> });
const DocumentPreviewModal = dynamic(() => import('@/components/chat/DocumentPreviewModal'), { ssr: false, loading: () => <FullPageLoader /> });


export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, token, logout, fetchAndUpdateUser, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isSubscribed, permissionStatus, subscribeToPush, isPushApiSupported } = usePushNotifications();

  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [dynamicBgClass, setDynamicBgClass] = useState('bg-mood-default-chat-area');
  const [chatSetupErrorMessage, setChatSetupErrorMessage] = useState<string | null>(null);
  const [isFullScreenAvatarOpen, setIsFullScreenAvatarOpen] = useState(false);
  const [fullScreenUserData, setFullScreenUserData] = useState<User | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; isTyping: boolean }>>({});
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [initialMoodOnLoad, setInitialMoodOnLoad] = useState<Mood | null>(null);
  const [reactionModalData, setReactionModalData] = useState<{ reactions: MessageType['reactions'], allUsers: Record<string, User> } | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [mediaModalData, setMediaModalData] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [chatMode, setChatMode] = useState<MessageMode>('normal');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [topMessageId, setTopMessageId] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<MessageType | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState(new Set<string>());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearChatDialogOpen, setIsClearChatDialogOpen] = useState(false);
  const [messageInfo, setMessageInfo] = useState<MessageType | null>(null);


  const viewportRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastReactionToggleTimes = useRef<Record<string, number>>({});
  const lastMessageTextRef = useRef<string>("");
  const handleSendThoughtRef = useRef<() => void>(() => {});
  const pendingMessageTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const setMessageAsFailed = useCallback((clientTempId: string) => {
    setMessages(prev => prev.map(msg => msg.client_temp_id === clientTempId && msg.status === 'sending' ? { ...msg, status: 'failed' } : msg));
    delete pendingMessageTimeouts.current[clientTempId];
  }, []);

  const handleMessageAck = useCallback((ackData: MessageAckEventData) => {
      if (pendingMessageTimeouts.current[ackData.client_temp_id]) {
        clearTimeout(pendingMessageTimeouts.current[ackData.client_temp_id]);
        delete pendingMessageTimeouts.current[ackData.client_temp_id];
      }
      setMessages(prev => prev.map(msg => msg.client_temp_id === ackData.client_temp_id ? { ...msg, id: ackData.server_assigned_id, status: 'sent' } : msg));
  }, []);

  const handleNewMessage = useCallback((newMessageFromServer: MessageType) => {
    setMessages(prev => {
      const messageExists = prev.some(m => m.client_temp_id === newMessageFromServer.client_temp_id || m.id === newMessageFromServer.id);
      if (messageExists) {
          return prev.map(m => (m.client_temp_id === newMessageFromServer.client_temp_id || m.id === newMessageFromServer.id) ? { ...newMessageFromServer, status: newMessageFromServer.status || 'sent' } : m);
      }
      return [...prev, { ...newMessageFromServer, status: newMessageFromServer.status || 'sent' }];
    });
    if (activeChat && newMessageFromServer.chat_id === activeChat.id && newMessageFromServer.mode !== 'incognito' && newMessageFromServer.message_subtype !== 'history_cleared_marker') {
        setActiveChat(prev => prev ? ({...prev, last_message: newMessageFromServer, updated_at: newMessageFromServer.updated_at }) : null);
    }
  }, [activeChat]);
  
  const handleMessageDeleted = useCallback((data: MessageDeletedEventData) => {
    setMessages(prev => prev.filter(msg => msg.id !== data.message_id));
  }, []);
  
  const handlePresenceUpdate = useCallback((data: UserPresenceUpdateEventData) => setOtherUser(prev => (prev && data.user_id === prev.id) ? { ...prev, is_online: data.is_online, last_seen: data.last_seen, mood: data.mood } : prev), []);
  const handleProfileUpdate = useCallback((data: UserProfileUpdateEventData) => setOtherUser(prev => (prev && data.user_id === prev.id) ? { ...prev, ...data } : prev), []);
  const handleTypingUpdate = useCallback((data: TypingIndicatorEventData) => { if (activeChat?.id === data.chat_id) setTypingUsers(prev => ({ ...prev, [data.user_id]: { userId: data.user_id, isTyping: data.is_typing } }))}, [activeChat]);
  const handleChatModeChanged = useCallback((data: ChatModeChangedEventData) => { if (activeChat?.id === data.chat_id) setChatMode(data.mode); }, [activeChat]);
  const handleThinkingOfYou = useCallback((data: ThinkingOfYouReceivedEventData) => { if (otherUser?.id === data.sender_id) toast({ title: "❤️ Thinking of You!", description: `${otherUser.display_name} is thinking of you.` })}, [otherUser, toast]);
  const handleChatHistoryCleared = useCallback((data: ChatHistoryClearedEventData) => { if(activeChat?.id === data.chat_id) setMessages([]); }, [activeChat]);

  const { protocol, sendMessage, isBrowserOnline } = useRealtime({
    onMessageReceived: handleNewMessage, onReactionUpdate: (data) => setMessages(prev => prev.map(msg => msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg)), onPresenceUpdate: handlePresenceUpdate,
    onTypingUpdate: handleTypingUpdate, onThinkingOfYouReceived: handleThinkingOfYou, onUserProfileUpdate: handleProfileUpdate,
    onMessageAck: handleMessageAck, onChatModeChanged: handleChatModeChanged, onMessageDeleted: handleMessageDeleted,
    onChatHistoryCleared: (chatId) => { if (activeChat?.id === chatId) setMessages([]); },
  });

  // Listen to upload progress events
  useEffect(() => {
    const handleProgress = (update: UploadProgress) => {
      setMessages(prev => prev.map(m => {
        if (m.client_temp_id === update.messageId) {
          const updatedMessage = { ...m };
          if (update.status === 'completed' && update.result) {
            updatedMessage.uploadStatus = 'completed';
            updatedMessage.status = 'sending'; // Now waiting for WebSocket send
            // Here you might update the message with final URLs if needed,
            // but the server message will be the source of truth.
          } else if (update.status === 'failed') {
            updatedMessage.uploadStatus = 'failed';
            updatedMessage.status = 'failed';
            updatedMessage.uploadError = update.error;
          } else if (update.status === 'uploading' || update.status === 'processing') {
            updatedMessage.uploadStatus = update.status;
            updatedMessage.uploadProgress = update.progress;
            if(update.thumbnailDataUrl) {
              updatedMessage.thumbnailDataUrl = update.thumbnailDataUrl;
            }
          }
          return updatedMessage;
        }
        return m;
      }));

      // When upload is completed, send the message via WebSocket
      if (update.status === 'completed' && update.result) {
          const originalMessage = messages.find(m => m.client_temp_id === update.messageId);
          if (!originalMessage) return;

          let payload: any = { 
              event_type: "send_message", 
              client_temp_id: update.messageId, 
              chat_id: originalMessage.chat_id,
              mode: originalMessage.mode,
              reply_to_message_id: originalMessage.reply_to_message_id,
              message_subtype: originalMessage.message_subtype,
          };

          const result = update.result;
          if (originalMessage.message_subtype === 'image') {
            payload.image_url = result.image_url;
            payload.image_thumbnail_url = result.image_thumbnail_url;
          } else if (originalMessage.message_subtype === 'clip') {
            payload.clip_url = result.file_url;
            payload.clip_type = result.clip_type;
            payload.image_thumbnail_url = result.thumbnail_url;
            payload.duration_seconds = result.duration_seconds;
          } else if (originalMessage.message_subtype === 'document') {
            payload.document_url = result.file_url;
            payload.document_name = result.file_name;
            payload.file_size_bytes = result.file_size_bytes;
          } else if (originalMessage.message_subtype === 'voice_message') {
            payload.clip_url = result.file_url;
            payload.duration_seconds = result.duration_seconds;
            payload.file_size_bytes = result.file_size_bytes;
            payload.audio_format = result.audio_format;
          }
          sendMessageWithTimeout(payload);
      }
    };
    const unsubscribe = uploadManager.subscribe(handleProgress);
    return () => unsubscribe();
  }, [setMessages, sendMessage, messages]);


  const { activeTargetId: activeThoughtNotificationFor, initiateThoughtNotification } = useThoughtNotification({ duration: THINKING_OF_YOU_DURATION, toast });

  const handleMoodChangeForAISuggestion = useCallback(async (newMood: Mood) => { if (currentUser) try { await api.updateUserProfile({ mood: newMood }); await fetchAndUpdateUser(); } catch (error: any) { toast({ variant: 'destructive', title: 'Mood Update Failed', description: error.message }) }}, [currentUser, fetchAndUpdateUser, toast]);
  const { isLoadingAISuggestion, suggestMood: aiSuggestMood, ReasoningDialog } = useMoodSuggestion({ currentUserMood: currentUser?.mood || 'Neutral', onMoodChange: handleMoodChangeForAISuggestion, currentMessageTextRef: lastMessageTextRef });

  const performLoadChatData = useCallback(async () => {
    if (!currentUser) return;
    if (!currentUser.partner_id) { router.push('/onboarding/find-partner'); return; }
    setIsChatLoading(true); setChatSetupErrorMessage(null);
    try {
        const [partnerDetails, chatSession] = await Promise.all([api.getUserProfile(currentUser.partner_id), api.createOrGetChat(currentUser.partner_id)]);
        setOtherUser(partnerDetails); setActiveChat(chatSession);
        const messagesData = await api.getMessages(chatSession.id, 50);
        setHasMoreMessages(messagesData.messages.length >= 50);
        setMessages(messagesData.messages.map(m => ({...m, client_temp_id: m.client_temp_id || m.id, status: m.status || 'sent' })));
        
        if (typeof window !== 'undefined' && currentUser.mood) {
          const lastPromptTimestamp = localStorage.getItem('kuchlu_lastMoodPromptTimestamp');
          if (!lastPromptTimestamp || (Date.now() - parseInt(lastPromptTimestamp, 10)) > MOOD_PROMPT_INTERVAL_MS) {
            setInitialMoodOnLoad(currentUser.mood); 
            setIsMoodModalOpen(true);
          }
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'API Error', description: `Failed to load chat data: ${error.message}` });
        setChatSetupErrorMessage(error.message);
    } finally { setIsChatLoading(false); }
  }, [currentUser, router, toast]);

  useEffect(() => {
    const checkPermissions = async () => {
      if (typeof window !== 'undefined' && !localStorage.getItem('kuchlu_permissions_requested')) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach(track => track.stop());
          toast({ title: "Permissions Granted", description: "Camera and microphone access enabled." });
        } catch (error) {
          console.warn("Permission denied for camera/microphone:", error);
          toast({ variant: 'destructive', title: "Permissions Denied", description: "Some features may not work without camera and microphone access." });
        } finally {
           localStorage.setItem('kuchlu_permissions_requested', 'true');
        }
      }
    };
    checkPermissions();
  }, [toast]);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages || !activeChat || messages.length === 0) return;
    setIsLoadingMore(true);
    try {
        const oldestMessage = messages[0];
        if(!oldestMessage) { setIsLoadingMore(false); return; }
        setTopMessageId(oldestMessage.id);
        const olderMessagesData = await api.getMessages(activeChat.id, 50, oldestMessage.created_at);
        if (olderMessagesData.messages?.length > 0) {
            setMessages(prev => [...olderMessagesData.messages.map(m => ({...m, client_temp_id: m.client_temp_id || m.id, status: m.status || 'sent' })), ...prev]);
            setHasMoreMessages(olderMessagesData.messages.length >= 50);
        } else { setHasMoreMessages(false); }
    } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: 'Could not load older messages.' })
    } finally { setIsLoadingMore(false); }
  }, [isLoadingMore, hasMoreMessages, activeChat, messages, toast]);
  
  const handleEnterSelectionMode = useCallback((messageId: string) => {
    setIsSelectionMode(true);
    setSelectedMessageIds(new Set([messageId]));
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  }, []);

  const handleToggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(newSet)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      if (newSet.size === 0) setIsSelectionMode(false);
      return newSet;
    });
  }, []);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!activeChat) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendMessage({ event_type: isTyping ? "start_typing" : "stop_typing", chat_id: activeChat.id });
    if (isTyping) typingTimeoutRef.current = setTimeout(() => sendMessage({ event_type: "stop_typing", chat_id: activeChat.id }), 3000);
  }, [activeChat, sendMessage]);

  const sendMessageWithTimeout = useCallback((messagePayload: any) => {
    sendMessage(messagePayload);
    pendingMessageTimeouts.current[messagePayload.client_temp_id] = setTimeout(() => setMessageAsFailed(messagePayload.client_temp_id), MESSAGE_SEND_TIMEOUT_MS);
  }, [sendMessage, setMessageAsFailed]);

  const handleSendMessage = useCallback((text: string, mode: MessageMode, replyToId?: string) => {
    if (!currentUser || !activeChat || !text.trim()) return;
    handleTyping(false);
    const clientTempId = uuidv4();
    const optimisticMessage: MessageType = { id: clientTempId, user_id: currentUser.id, chat_id: activeChat.id, text, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reactions: {}, client_temp_id: clientTempId, status: "sending", message_subtype: "text", mode: mode, reply_to_message_id: replyToId };
    setMessages(prev => [...prev, optimisticMessage]);
    sendMessageWithTimeout({ event_type: "send_message", text, mode, client_temp_id: clientTempId, message_subtype: "text", reply_to_message_id: replyToId, chat_id: activeChat.id });
    if (ENABLE_AI_MOOD_SUGGESTION && currentUser.mood) { lastMessageTextRef.current = text; aiSuggestMood(text); }
    if (isPushApiSupported && !isSubscribed && permissionStatus === 'default' && !localStorage.getItem(FIRST_MESSAGE_SENT_KEY)) { localStorage.setItem(FIRST_MESSAGE_SENT_KEY, 'true'); setTimeout(() => setShowNotificationPrompt(true), 2000); }
    if (replyToId) setReplyingTo(null);
  }, [currentUser, activeChat, handleTyping, sendMessageWithTimeout, aiSuggestMood, isPushApiSupported, isSubscribed, permissionStatus]);
  
  const handleFileUpload = useCallback((file: File, mode: MessageMode, subtype: MessageType['message_subtype']) => {
    if (!currentUser || !activeChat) return;

    const clientTempId = uuidv4();
    const optimisticMessage: MessageType = {
        id: clientTempId,
        user_id: currentUser.id,
        chat_id: activeChat.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'uploading',
        uploadStatus: 'pending',
        client_temp_id: clientTempId,
        message_subtype: subtype,
        mode,
        file,
        document_name: file.name,
        thumbnailDataUrl: subtype === 'image' ? URL.createObjectURL(file) : undefined,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    
    uploadManager.addToQueue({
      id: uuidv4(),
      file,
      messageId: clientTempId,
      chatId: activeChat.id,
      priority: 5,
    });
  }, [currentUser, activeChat]);

  const handleRetrySend = useCallback((message: MessageType) => {
    if (message.uploadStatus === 'failed' && message.file) {
      uploadManager.retryUpload(message.client_temp_id);
    } else {
      setMessages(prev => prev.map(m => m.client_temp_id === message.client_temp_id ? { ...m, status: 'sending' } : m));
    }
  }, []);
  
  const handleDeleteMessage = useCallback(async (messageId: string, deleteType: DeleteType) => { 
    if (!activeChat) return; 
    try { 
        if (deleteType === 'everyone') { 
            await api.deleteMessageForEveryone(messageId, activeChat.id); 
        } 
        setMessages(prev => prev.filter(msg => msg.id !== messageId)); 
        toast({ title: "Message Deleted" }); 
    } catch (error: any) { 
        toast({ variant: 'destructive', title: 'Delete Failed', description: error.message }); 
    }
  }, [activeChat, toast]);

  const allUsersForMessageArea = useMemo(() => (currentUser && otherUser ? {[currentUser.id]: currentUser, [otherUser.id]: otherUser} : {}), [currentUser, otherUser]);

  const handleCopySelected = useCallback(() => {
    const selectedText = messages
      .filter(m => selectedMessageIds.has(m.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(m => `[${new Date(m.created_at).toLocaleTimeString()}] ${allUsersForMessageArea[m.user_id]?.display_name}: ${m.text || 'Attachment'}`)
      .join('\n');
    
    navigator.clipboard.writeText(selectedText);
    toast({ title: "Copied!", description: `${selectedMessageIds.size} messages copied to clipboard.` });
    handleExitSelectionMode();
  }, [messages, selectedMessageIds, toast, handleExitSelectionMode, allUsersForMessageArea]);
  
  const handleShareSelected = useCallback(async () => {
    const selectedText = messages
      .filter(m => selectedMessageIds.has(m.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(m => `${allUsersForMessageArea[m.user_id]?.display_name}: ${m.text || 'Attachment'}`)
      .join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Kuchlu Conversation', text: selectedText });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') console.error('Share failed:', error);
      }
    } else {
      toast({ variant: 'destructive', title: "Not Supported", description: "Your browser does not support sharing." });
    }
    handleExitSelectionMode();
  }, [messages, selectedMessageIds, toast, handleExitSelectionMode, allUsersForMessageArea]);

  const handleDeleteSelected = useCallback(async (deleteType: DeleteType) => {
    if (!activeChat) return;
    
    const idsToDelete = Array.from(selectedMessageIds);
    
    // Optimistically remove from UI
    setMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));
    
    if (deleteType === 'everyone') {
      try {
        await Promise.all(idsToDelete.map(id => api.deleteMessageForEveryone(id, activeChat.id)));
        toast({ title: "Messages Deleted", description: `${idsToDelete.length} messages deleted for everyone.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: 'Some messages could not be deleted.' });
        performLoadChatData();
      }
    } else {
        toast({ title: "Messages Deleted", description: `${idsToDelete.length} messages removed from your view.` });
    }
    handleExitSelectionMode();
    setIsDeleteDialogOpen(false);
  }, [activeChat, selectedMessageIds, handleExitSelectionMode, toast, performLoadChatData]);

  const handleClearChat = useCallback(async () => {
    if (!activeChat) return;
    try {
        await api.clearChatHistory(activeChat.id);
        toast({ title: "Chat Cleared", description: "Your view of this chat has been cleared."});
        setMessages([]);
    } catch (error: any) {
        toast({ variant: "destructive", title: 'Clear Failed', description: error.message });
    }
    setIsClearChatDialogOpen(false);
  }, [activeChat, toast]);

  const handleSendImage = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, mode, 'image'), [handleFileUpload]);
  const handleSendVideo = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, mode, 'clip'), [handleFileUpload]);
  const handleSendDocument = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, mode, 'document'), [handleFileUpload]);
  const handleSendVoiceMessage = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, mode, 'voice_message'), [handleFileUpload]);
  const handleSendSticker = useCallback((stickerId: string, mode: MessageMode) => { if (!currentUser || !activeChat) return; sendMessageWithTimeout({ event_type: "send_message", sticker_id: stickerId, client_temp_id: uuidv4(), message_subtype: "sticker", mode, chat_id: activeChat.id }); }, [currentUser, activeChat, sendMessageWithTimeout]);
  
  const handleToggleReaction = useCallback((messageId: string, emoji: SupportedEmoji) => {
    if (!currentUser || !activeChat || messages.find(m => m.id === messageId)?.mode === 'incognito') return;
    const key = `${messageId}_${emoji}`; const now = Date.now();
    if (lastReactionToggleTimes.current[key] && (now - lastReactionToggleTimes.current[key] < 500)) return;
    lastReactionToggleTimes.current[key] = now;
    setMessages(prev => prev.map(m => { if (m.id === messageId) { const r = { ...m.reactions }; if (!r[emoji]) r[emoji] = []; const i = r[emoji]!.indexOf(currentUser.id); if (i > -1) r[emoji]!.splice(i, 1); else r[emoji]!.push(currentUser.id); if (r[emoji]!.length === 0) delete r[emoji]; return { ...m, reactions: r }; } return m; }));
    sendMessage({ event_type: "toggle_reaction", message_id: messageId, chat_id: activeChat.id, emoji });
  }, [currentUser, activeChat, sendMessage, messages]);
  
  const getDynamicBg = useCallback((m1?: Mood, m2?: Mood) => !m1||!m2?'bg-mood-default-chat-area':m1==='Happy'&&m2==='Happy'?'bg-mood-happy-happy':m1==='Excited'&&m2==='Excited'?'bg-mood-excited-excited':(['Chilling','Neutral','Thoughtful','Content'].includes(m1))&&(['Chilling','Neutral','Thoughtful','Content'].includes(m2))?'bg-mood-calm-calm':m1==='Sad'&&m2==='Sad'?'bg-mood-sad-sad':m1==='Angry'&&m2==='Angry'?'bg-mood-angry-angry':m1==='Anxious'&&m2==='Anxious'?'bg-mood-anxious-anxious':(((m1==='Happy'&&(m2==='Sad'||m2==='Angry'))||((m1==='Sad'||m1==='Angry')&&m2==='Happy'))||(m1==='Excited'&&(m2==='Sad'||m2==='Chilling'||m2==='Angry'))||(((m1==='Sad'||m1==='Chilling'||m1==='Angry')&&m2==='Excited')))?'bg-mood-thoughtful-thoughtful':'bg-mood-default-chat-area', []);
  handleSendThoughtRef.current = useCallback(async () => { if (!currentUser || !otherUser) return; sendMessage({ event_type: "ping_thinking_of_you", recipient_user_id: otherUser.id }); initiateThoughtNotification(otherUser.id, otherUser.display_name, currentUser.display_name); }, [currentUser, otherUser, sendMessage, initiateThoughtNotification]);

  const onProfileClick = useCallback(() => router.push('/settings'), [router]);
  const handleOtherUserAvatarClick = useCallback(() => { if (otherUser) { setFullScreenUserData(otherUser); setIsFullScreenAvatarOpen(true); } }, [otherUser]);
  
  const handleSetMoodFromModal = useCallback(async (newMood: Mood) => { 
    if (currentUser) 
      try { 
        await api.updateUserProfile({ mood: newMood }); 
        await fetchAndUpdateUser(); 
        toast({ title: "Mood Updated!" }); 
      } catch (e: any) { 
        toast({ variant: 'destructive', title: 'Update Failed' }) 
      } 
    if (typeof window !== 'undefined') localStorage.setItem('kuchlu_lastMoodPromptTimestamp', Date.now().toString());
    setIsMoodModalOpen(false); 
  }, [currentUser, fetchAndUpdateUser, toast]);
  
  const handleContinueWithCurrentMood = useCallback(() => { 
    if (typeof window !== 'undefined') localStorage.setItem('kuchlu_lastMoodPromptTimestamp', Date.now().toString());
    setIsMoodModalOpen(false); 
  }, []);

  const handleShowReactions = useCallback((message: MessageType, allUsers: Record<string, User>) => { if (message.reactions) setReactionModalData({ reactions: message.reactions, allUsers }) }, []);
  const handleEnableNotifications = useCallback(() => { subscribeToPush(); setShowNotificationPrompt(false); }, [subscribeToPush]);
  const handleDismissNotificationPrompt = useCallback(() => { setShowNotificationPrompt(false); sessionStorage.setItem('notificationPromptDismissed', 'true'); }, []);
  const handleShowMedia = useCallback((url: string, type: 'image' | 'video') => setMediaModalData({ url, type }), []);
  const handleShowDocumentPreview = useCallback((message: MessageType) => setDocumentPreview(message), []);
  const handleShowInfo = useCallback((message: MessageType) => setMessageInfo(message), []);
  const handleSelectMode = useCallback((mode: MessageMode) => { if (activeChat) { setChatMode(mode); sendMessage({ event_type: "change_chat_mode", chat_id: activeChat.id, mode }); toast({ title: `Switched to ${mode} Mode` }); }}, [activeChat, sendMessage, toast]);
  const handleCancelReply = useCallback(() => setReplyingTo(null), []);
  const handleSetReplyingTo = useCallback((message: MessageType | null) => setReplyingTo(message), []);

  useEffect(() => { if (!isAuthLoading && !isAuthenticated) router.push('/'); if (isAuthenticated && currentUser) performLoadChatData(); }, [isAuthenticated, isAuthLoading, currentUser?.id, performLoadChatData, router]);
  useEffect(() => { setDynamicBgClass(chatMode==='fight'?'bg-mode-fight':chatMode==='incognito'?'bg-mode-incognito':getDynamicBg(currentUser?.mood, otherUser?.mood)); }, [chatMode, currentUser?.mood, otherUser?.mood, getDynamicBg]);
  useEffect(() => { const incognito = messages.filter(m => m.mode === 'incognito'); if (incognito.length > 0) { const timer = setTimeout(() => { setMessages(prev => prev.filter(m => m.mode !== 'incognito')); }, 30000); return () => clearTimeout(timer); } }, [messages]);
  useLayoutEffect(() => { if (topMessageId && viewportRef.current) { const el = viewportRef.current.querySelector(`#message-${topMessageId}`); if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' }); setTopMessageId(null); }}, [topMessageId, messages]);
  useEffect(() => { const timeouts = pendingMessageTimeouts.current; return () => { Object.values(timeouts).forEach(clearTimeout); }; }, []);

  const isLoadingPage = isAuthLoading || (isAuthenticated && isChatLoading);
  const isInputDisabled = protocol === 'disconnected' || isSelectionMode;

  const canDeleteForEveryone = useMemo(() => {
    if (!currentUser) return false;
    return Array.from(selectedMessageIds).every(id => {
      const msg = messages.find(m => m.id === id);
      return msg?.user_id === currentUser.id;
    });
  }, [selectedMessageIds, messages, currentUser]);

  const ConnectionStatusBanner = () => {
    if (protocol === 'disconnected' && !isBrowserOnline) return <div className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground p-2 text-center text-sm z-50 flex items-center justify-center gap-2"><WifiOff size={16} />You are offline. Features may be limited.</div>;
    if (protocol === 'sse' || protocol === 'fallback') return <div className="fixed top-0 left-0 right-0 bg-amber-500 text-black p-2 text-center text-sm z-50 flex items-center justify-center gap-2"><Wifi size={16} />Connected via fallback. Some features may be slower.</div>;
    if (protocol === 'connecting' || protocol === 'syncing') return <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white p-2 text-center text-sm z-50 flex items-center justify-center gap-2"><Spinner />{protocol === 'syncing' ? 'Syncing...' : 'Connecting...'}</div>;
    return null;
  };

  if (isLoadingPage || !currentUser) return <FullPageLoader />;
  if (!otherUser || !activeChat) return <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center"><div><FullPageLoader /><p className="text-lg text-foreground">Setting up your chat...</p>{chatSetupErrorMessage && <p className="text-destructive mt-2">{chatSetupErrorMessage}</p>}</div></div>;

  return (
    <div className="flex h-[100svh] flex-col overflow-hidden">
      <div className={cn("flex flex-1 flex-col overflow-hidden", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
        <ConnectionStatusBanner />
        <div className={cn("flex-grow w-full flex items-center justify-center p-2 sm:p-4 overflow-hidden", (protocol !== 'websocket' && protocol !== 'disconnected') && 'pt-10')}>
          <ErrorBoundary fallbackMessage="The chat couldn't be displayed.">
            <div className="w-full max-w-2xl h-full flex flex-col bg-card shadow-2xl rounded-lg overflow-hidden relative">
              <NotificationPrompt isOpen={showNotificationPrompt} onEnable={handleEnableNotifications} onDismiss={handleDismissNotificationPrompt} title="Enable Notifications" message={otherUser ? `Stay connected with ${otherUser.display_name}` : 'Get notified.'}/>
              <MemoizedChatHeader 
                currentUser={currentUser} 
                otherUser={otherUser} 
                onProfileClick={onProfileClick} 
                onSendThinkingOfYou={handleSendThoughtRef.current} 
                isTargetUserBeingThoughtOf={!!(otherUser && activeThoughtNotificationFor === otherUser.id)} 
                onOtherUserAvatarClick={handleOtherUserAvatarClick} 
                isOtherUserTyping={!!(otherUser && typingUsers[otherUser.id]?.isTyping)}
                isSelectionMode={isSelectionMode}
                selectedMessageCount={selectedMessageIds.size}
                onExitSelectionMode={handleExitSelectionMode}
                onCopySelected={handleCopySelected}
                onDeleteSelected={() => setIsDeleteDialogOpen(true)}
                onShareSelected={handleShareSelected}
                onClearChat={() => setIsClearChatDialogOpen(true)}
              />
              <MemoizedMessageArea 
                viewportRef={viewportRef} 
                messages={messages} 
                currentUser={currentUser} 
                allUsers={allUsersForMessageArea} 
                onToggleReaction={handleToggleReaction} 
                onShowReactions={(m, u) => handleShowReactions(m, u)} 
                onShowMedia={handleShowMedia} 
                onShowDocumentPreview={handleShowDocumentPreview} 
                onLoadMore={loadMoreMessages} 
                hasMore={hasMoreMessages} 
                isLoadingMore={isLoadingMore} 
                onRetrySend={handleRetrySend} 
                onDeleteMessage={handleDeleteMessage} 
                onSetReplyingTo={handleSetReplyingTo}
                isSelectionMode={isSelectionMode}
                selectedMessageIds={selectedMessageIds}
                onEnterSelectionMode={handleEnterSelectionMode}
                onToggleMessageSelection={handleToggleMessageSelection}
                onShowInfo={handleShowInfo}
              />
              <MemoizedInputBar onSendMessage={handleSendMessage} onSendSticker={handleSendSticker} onSendVoiceMessage={handleSendVoiceMessage} onSendImage={handleSendImage} onSendVideo={handleSendVideo} onSendDocument={handleSendDocument} isSending={isLoadingAISuggestion} onTyping={handleTyping} disabled={isInputDisabled} chatMode={chatMode} onSelectMode={handleSelectMode} replyingTo={replyingTo} onCancelReply={handleCancelReply} allUsers={allUsersForMessageArea} />
            </div>
            <FloatingMoodButton />
          </ErrorBoundary>
        </div>
        {fullScreenUserData && <FullScreenAvatarModal isOpen={isFullScreenAvatarOpen} onClose={() => setIsFullScreenAvatarOpen(false)} user={fullScreenUserData}/>}
        {mediaModalData && <FullScreenMediaModal isOpen={!!mediaModalData} onClose={() => setMediaModalData(null)} mediaUrl={mediaModalData.url} mediaType={mediaModalData.type}/>}
        {currentUser && initialMoodOnLoad && <MoodEntryModal isOpen={isMoodModalOpen} onClose={handleContinueWithCurrentMood} onSetMood={handleSetMoodFromModal} currentMood={initialMoodOnLoad} onContinueWithCurrent={handleContinueWithCurrentMood}/>}
        <ReasoningDialog />
        {reactionModalData && <ReactionSummaryModal isOpen={!!reactionModalData} onClose={() => setReactionModalData(null)} reactions={reactionModalData.reactions} allUsers={reactionModalData.allUsers}/>}
        {documentPreview && <DocumentPreviewModal isOpen={!!documentPreview} onClose={() => setDocumentPreview(null)} message={documentPreview} />}
        {messageInfo && <MessageInfoModal isOpen={!!messageInfo} onClose={() => setMessageInfo(null)} message={messageInfo} />}
        <DeleteMessageDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDeleteSelected}
          isCurrentUser={canDeleteForEveryone}
          messageCount={selectedMessageIds.size}
        />
        <AlertDialog open={isClearChatDialogOpen} onOpenChange={setIsClearChatDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will clear the entire chat history from your view. Your partner will still be able to see the messages. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearChat} className={buttonVariants({ variant: "destructive" })}>
                        <Trash2 className="mr-2 h-4 w-4" /> Clear Chat For Me
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
