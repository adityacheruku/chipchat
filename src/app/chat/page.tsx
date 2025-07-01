

"use client";

import React, { useState, useEffect, useCallback, useRef, memo, useMemo, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import dynamic from 'next/dynamic';
import { useLiveQuery } from 'dexie-react-hooks';
import type { User, Message as MessageType, Mood, SupportedEmoji, Chat, UserPresenceUpdateEventData, TypingIndicatorEventData, ThinkingOfYouReceivedEventData, NewMessageEventData, MessageReactionUpdateEventData, UserProfileUpdateEventData, MessageAckEventData, MessageMode, ChatModeChangedEventData, DeleteType, MessageDeletedEventData, ChatHistoryClearedEventData, UploadProgress, MessageSubtype } from '@/types';
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
import { storageService } from '@/services/storageService';
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
import { validateFile } from '@/utils/fileValidation';


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

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  
  // Use Dexie's live query to reactively update messages from IndexedDB
  const messages = useLiveQuery(
    () => activeChatId ? storageService.messages.where('chat_id').equals(activeChatId).sortBy('created_at') : [],
    [activeChatId],
    []
  );

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
    storageService.updateMessage(clientTempId, { status: 'failed' });
    delete pendingMessageTimeouts.current[clientTempId];
  }, []);

  const handleMessageAck = useCallback(async (ackData: MessageAckEventData) => {
    if (pendingMessageTimeouts.current[ackData.client_temp_id]) {
      clearTimeout(pendingMessageTimeouts.current[ackData.client_temp_id]);
      delete pendingMessageTimeouts.current[ackData.client_temp_id];
    }
    await storageService.updateMessage(ackData.client_temp_id, { id: ackData.server_assigned_id, status: 'sent' });
  }, []);

  const handleNewMessage = useCallback(async (newMessageFromServer: MessageType) => {
    await storageService.addMessage({ ...newMessageFromServer, status: newMessageFromServer.status || 'sent' });
    if(otherUser && newMessageFromServer.user_id !== otherUser.id) {
       await storageService.upsertUser(otherUser);
    }
  }, [otherUser]);

  const handleMessageDeleted = useCallback((data: MessageDeletedEventData) => {
    storageService.deleteMessage(data.message_id);
  }, []);
  
  const handlePresenceUpdate = useCallback(async (data: UserPresenceUpdateEventData) => {
    setOtherUser(prev => (prev && data.user_id === prev.id) ? { ...prev, is_online: data.is_online, last_seen: data.last_seen, mood: data.mood } : prev);
    if (otherUser && data.user_id === otherUser.id) {
      await storageService.upsertUser({ ...otherUser, is_online: data.is_online, last_seen: data.last_seen, mood: data.mood });
    }
  }, [otherUser]);

  const handleProfileUpdate = useCallback(async (data: UserProfileUpdateEventData) => {
    setOtherUser(prev => (prev && data.user_id === prev.id) ? { ...prev, ...data } : prev);
    if (otherUser && data.user_id === otherUser.id) {
      await storageService.upsertUser({ ...otherUser, ...data });
    }
  }, [otherUser]);

  const handleTypingUpdate = useCallback((data: TypingIndicatorEventData) => { if (activeChatId === data.chat_id) setTypingUsers(prev => ({ ...prev, [data.user_id]: { userId: data.user_id, isTyping: data.is_typing } }))}, [activeChatId]);
  const handleChatModeChanged = useCallback((data: ChatModeChangedEventData) => { if (activeChatId === data.chat_id) setChatMode(data.mode); }, [activeChatId]);
  const handleThinkingOfYou = useCallback((data: ThinkingOfYouReceivedEventData) => { if (otherUser?.id === data.sender_id) toast({ title: "❤️ Thinking of You!", description: `${otherUser.display_name} is thinking of you.` })}, [otherUser, toast]);
  const handleChatHistoryCleared = useCallback((data: ChatHistoryClearedEventData) => { if(activeChatId === data.chat_id) storageService.messages.where('chat_id').equals(data.chat_id).delete(); }, [activeChatId]);

  const { protocol, sendMessage, isBrowserOnline } = useRealtime({
    onMessageReceived: handleNewMessage, 
    onReactionUpdate: async (data) => await storageService.updateMessage(data.message_id, { reactions: data.reactions }),
    onPresenceUpdate: handlePresenceUpdate,
    onTypingUpdate: handleTypingUpdate, onThinkingOfYouReceived: handleThinkingOfYou, onUserProfileUpdate: handleProfileUpdate,
    onMessageAck: handleMessageAck, onChatModeChanged: handleChatModeChanged, onMessageDeleted: handleMessageDeleted,
    onChatHistoryCleared: (chatId) => { if (activeChatId === chatId) storageService.messages.where('chat_id').equals(chatId).delete(); },
  });

  const sendMessageWithTimeout = useCallback((messagePayload: any) => {
    sendMessage(messagePayload);
    pendingMessageTimeouts.current[messagePayload.client_temp_id] = setTimeout(() => setMessageAsFailed(messagePayload.client_temp_id), MESSAGE_SEND_TIMEOUT_MS);
  }, [sendMessage, setMessageAsFailed]);

  // Listen to upload progress events
  useEffect(() => {
    const handleProgress = async (update: UploadProgress) => {
      const originalMessage = messages.find(m => m.client_temp_id === update.messageId);

      if (update.status === 'completed' && update.result && originalMessage) {
        
        const messageUpdateData: Partial<MessageType> = {
            uploadStatus: 'completed',
            status: 'sending',
        };

        if (originalMessage.message_subtype === 'image') {
            messageUpdateData.image_url = update.result.secure_url;
            messageUpdateData.image_thumbnail_url = update.result.eager?.[0]?.secure_url || update.result.secure_url;
            messageUpdateData.preview_url = update.result.eager?.[0]?.secure_url || update.result.secure_url;
        } else if (originalMessage.message_subtype === 'clip') { // Video
            messageUpdateData.clip_url = update.result.secure_url;
            messageUpdateData.image_thumbnail_url = update.result.eager?.[0]?.secure_url;
            messageUpdateData.duration_seconds = update.result.duration;
            messageUpdateData.clip_type = 'video';
        } else if (originalMessage.message_subtype === 'voice_message' || originalMessage.message_subtype === 'audio') {
            messageUpdateData.clip_url = update.result.secure_url;
            messageUpdateData.duration_seconds = update.result.duration;
            messageUpdateData.audio_format = update.result.format;
            messageUpdateData.clip_type = 'audio';
        } else if (originalMessage.message_subtype === 'document') {
            messageUpdateData.document_url = update.result.secure_url;
            messageUpdateData.document_name = update.result.original_filename;
        }

        messageUpdateData.file_size_bytes = update.result.bytes;
        if (update.result.file_metadata) {
            messageUpdateData.file_metadata = update.result.file_metadata;
        }
        
        await storageService.updateMessage(update.messageId, messageUpdateData);
        
        const websocketPayload = {
            event_type: "send_message",
            client_temp_id: update.messageId,
            chat_id: originalMessage.chat_id,
            mode: originalMessage.mode,
            reply_to_message_id: originalMessage.reply_to_message_id,
            ...messageUpdateData
        };

        sendMessageWithTimeout(websocketPayload);

      } else {
         await storageService.updateMessage(update.messageId, {
            uploadStatus: update.status,
            uploadProgress: update.progress,
            uploadError: update.error,
            status: update.status === 'failed' ? 'failed' : 'uploading',
            thumbnailDataUrl: update.thumbnailDataUrl
         });
      }
    };
    
    const unsubscribe = uploadManager.subscribe(handleProgress);
    return () => unsubscribe();
  }, [sendMessageWithTimeout, messages]);


  const { activeTargetId: activeThoughtNotificationFor, initiateThoughtNotification } = useThoughtNotification({ duration: THINKING_OF_YOU_DURATION, toast });

  const handleMoodChangeForAISuggestion = useCallback(async (newMood: Mood) => { if (currentUser) try { await api.updateUserProfile({ mood: newMood }); await fetchAndUpdateUser(); } catch (error: any) { toast({ variant: 'destructive', title: 'Mood Update Failed', description: error.message }) }}, [currentUser, fetchAndUpdateUser, toast]);
  const { isLoadingAISuggestion, suggestMood: aiSuggestMood, ReasoningDialog } = useMoodSuggestion({ currentUserMood: currentUser?.mood || 'Neutral', onMoodChange: handleMoodChangeForAISuggestion, currentMessageTextRef: lastMessageTextRef });

  const performLoadChatData = useCallback(async () => {
    if (!currentUser) return;
    if (!currentUser.partner_id) { router.push('/onboarding/find-partner'); return; }
    
    setIsChatLoading(true); setChatSetupErrorMessage(null);
    try {
        let chat = await storageService.getChatWithParticipants(currentUser.partner_id);
        if (!chat) {
          const chatSession = await api.createOrGetChat(currentUser.partner_id);
          const partnerDetails = await api.getUserProfile(currentUser.partner_id);
          
          await storageService.upsertUser(partnerDetails);
          await storageService.addChat(chatSession);
          
          chat = chatSession;
        }
        
        setActiveChatId(chat.id);
        setOtherUser(chat.participants.find(p => p.id !== currentUser.id)!);

        // Fetch latest messages from API and update local DB
        const messagesData = await api.getMessages(chat.id, 50);
        await storageService.bulkAddMessages(messagesData.messages);
        setHasMoreMessages(messagesData.messages.length >= 50);
        
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

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages || !activeChatId || messages.length === 0) return;
    setIsLoadingMore(true);
    try {
        const oldestMessage = messages[0];
        if(!oldestMessage) { setIsLoadingMore(false); return; }
        setTopMessageId(oldestMessage.id);
        const olderMessagesData = await api.getMessages(activeChatId, 50, oldestMessage.created_at);
        if (olderMessagesData.messages?.length > 0) {
            await storageService.bulkAddMessages(olderMessagesData.messages);
            setHasMoreMessages(olderMessagesData.messages.length >= 50);
        } else { setHasMoreMessages(false); }
    } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: 'Could not load older messages.' })
    } finally { setIsLoadingMore(false); }
  }, [isLoadingMore, hasMoreMessages, activeChatId, messages, toast]);
  
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
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      if (newSet.size === 0) setIsSelectionMode(false);
      return newSet;
    });
  }, []);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!activeChatId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendMessage({ event_type: isTyping ? "start_typing" : "stop_typing", chat_id: activeChatId });
    if (isTyping) typingTimeoutRef.current = setTimeout(() => sendMessage({ event_type: "stop_typing", chat_id: activeChatId }), 3000);
  }, [activeChatId, sendMessage]);

  const handleSendMessage = useCallback(async (text: string, mode: MessageMode, replyToId?: string) => {
    if (!currentUser || !activeChatId || !text.trim()) return;
    handleTyping(false);
    const clientTempId = uuidv4();
    const optimisticMessage: MessageType = { id: clientTempId, user_id: currentUser.id, chat_id: activeChatId, text, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reactions: {}, client_temp_id: clientTempId, status: "sending", message_subtype: "text", mode: mode, reply_to_message_id: replyToId };
    
    await storageService.addMessage(optimisticMessage);
    
    sendMessageWithTimeout({ event_type: "send_message", text, mode, client_temp_id: clientTempId, message_subtype: "text", reply_to_message_id: replyToId, chat_id: activeChatId });
    
    if (ENABLE_AI_MOOD_SUGGESTION && currentUser.mood) { lastMessageTextRef.current = text; aiSuggestMood(text); }
    if (isPushApiSupported && !isSubscribed && permissionStatus === 'default' && !localStorage.getItem(FIRST_MESSAGE_SENT_KEY)) { localStorage.setItem(FIRST_MESSAGE_SENT_KEY, 'true'); setTimeout(() => setShowNotificationPrompt(true), 2000); }
    if (replyToId) setReplyingTo(null);
  }, [currentUser, activeChatId, handleTyping, sendMessageWithTimeout, aiSuggestMood, isPushApiSupported, isSubscribed, permissionStatus]);
  
  const handleFileUpload = useCallback(async (file: File, mode: MessageMode, intendedSubtype: MessageType['message_subtype']) => {
    if (!currentUser || !activeChatId) return;

    const validation = validateFile(file);
    const finalSubtype = (intendedSubtype === 'document' && ['image', 'video', 'audio'].includes(validation.fileType))
      ? validation.fileType as MessageSubtype
      : intendedSubtype;

    let priority: number;
    switch (finalSubtype) {
        case 'voice_message': priority = 1; break;
        case 'image': case 'clip': priority = 5; break;
        case 'document': case 'audio': priority = 10; break;
        default: priority = 5;
    }

    const clientTempId = uuidv4();
    const optimisticMessage: MessageType = {
        id: clientTempId,
        user_id: currentUser.id,
        chat_id: activeChatId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'uploading',
        uploadStatus: 'pending',
        client_temp_id: clientTempId,
        message_subtype: finalSubtype,
        mode,
        file,
        document_name: file.name,
        thumbnailDataUrl: finalSubtype === 'image' ? URL.createObjectURL(file) : undefined,
    };
    
    await storageService.addMessage(optimisticMessage);
    
    uploadManager.addToQueue({
      id: uuidv4(),
      file,
      messageId: clientTempId,
      chatId: activeChatId,
      priority,
      subtype: finalSubtype
    });
  }, [currentUser, activeChatId]);

  const handleRetrySend = useCallback((message: MessageType) => {
    if (message.uploadStatus === 'failed' && message.file) {
      uploadManager.retryUpload(message.client_temp_id);
    } else {
      storageService.updateMessage(message.client_temp_id, { status: 'sending' });
    }
  }, []);
  
  const handleDeleteMessage = useCallback(async (messageId: string, deleteType: DeleteType) => { 
    if (!activeChatId) return; 
    try { 
        if (deleteType === 'everyone') { 
            await api.deleteMessageForEveryone(messageId, activeChatId); 
        } 
        await storageService.deleteMessage(messageId);
        toast({ title: "Message Deleted" }); 
    } catch (error: any) { 
        toast({ variant: 'destructive', title: 'Delete Failed', description: error.message }); 
    }
  }, [activeChatId, toast]);

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
    if (!activeChatId) return;
    
    const idsToDelete = Array.from(selectedMessageIds);
    
    // Optimistically remove from UI via Dexie
    for (const id of idsToDelete) {
        await storageService.deleteMessage(id);
    }
    
    if (deleteType === 'everyone') {
      try {
        await Promise.all(idsToDelete.map(id => api.deleteMessageForEveryone(id, activeChatId)));
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
  }, [activeChatId, selectedMessageIds, handleExitSelectionMode, toast, performLoadChatData]);

  const handleClearChat = useCallback(async () => {
    if (!activeChatId) return;
    try {
        await api.clearChatHistory(activeChatId);
        toast({ title: "Chat Cleared", description: "Your view of this chat has been cleared."});
    } catch (error: any) {
        toast({ variant: "destructive", title: 'Clear Failed', description: error.message });
    }
    setIsClearChatDialogOpen(false);
  }, [activeChatId, toast]);

  const handleSendImage = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, mode, 'image'), [handleFileUpload]);
  const handleSendVideo = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, mode, 'clip'), [handleFileUpload]);
  const handleSendDocument = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, mode, 'document'), [handleFileUpload]);
  const handleSendVoiceMessage = useCallback((file: File, mode: MessageMode) => handleFileUpload(file, mode, 'voice_message'), [handleFileUpload]);
  const handleSendSticker = useCallback(async (stickerId: string, mode: MessageMode) => { 
    if (!currentUser || !activeChatId) return; 
    const optimisticMessage = { client_temp_id: uuidv4(), user_id: currentUser.id, chat_id: activeChatId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sticker_id: stickerId, mode, message_subtype: 'sticker', status: 'sending', reactions: {}, id: uuidv4() };
    await storageService.addMessage(optimisticMessage);
    sendMessageWithTimeout({ event_type: "send_message", ...optimisticMessage });
  }, [currentUser, activeChatId, sendMessageWithTimeout]);
  
  const handleToggleReaction = useCallback(async (messageId: string, emoji: SupportedEmoji) => {
    if (!currentUser || !activeChatId || messages.find(m => m.id === messageId)?.mode === 'incognito') return;
    const key = `${messageId}_${emoji}`; const now = Date.now();
    if (lastReactionToggleTimes.current[key] && (now - lastReactionToggleTimes.current[key] < 500)) return;
    lastReactionToggleTimes.current[key] = now;
    
    // Optimistic update in local DB
    const message = messages.find(m => m.id === messageId);
    if(message) {
      const r = { ...message.reactions }; 
      if (!r[emoji]) r[emoji] = []; 
      const i = r[emoji]!.indexOf(currentUser.id); 
      if (i > -1) r[emoji]!.splice(i, 1); else r[emoji]!.push(currentUser.id); 
      if (r[emoji]!.length === 0) delete r[emoji];
      await storageService.updateMessage(message.client_temp_id, { reactions: r });
    }

    sendMessage({ event_type: "toggle_reaction", message_id: messageId, chat_id: activeChatId, emoji });
  }, [currentUser, activeChatId, sendMessage, messages]);
  
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
  const handleSelectMode = useCallback((mode: MessageMode) => { if (activeChatId) { setChatMode(mode); sendMessage({ event_type: "change_chat_mode", chat_id: activeChatId, mode }); toast({ title: `Switched to ${mode} Mode` }); }}, [activeChatId, sendMessage, toast]);
  const handleCancelReply = useCallback(() => setReplyingTo(null), []);
  const handleSetReplyingTo = useCallback((message: MessageType | null) => setReplyingTo(message), []);

  useEffect(() => { if (!isAuthLoading && !isAuthenticated) router.push('/'); if (isAuthenticated && currentUser) performLoadChatData(); }, [isAuthenticated, isAuthLoading, currentUser?.id, performLoadChatData, router]);
  useEffect(() => { setDynamicBgClass(chatMode==='fight'?'bg-mode-fight':chatMode==='incognito'?'bg-mode-incognito':getDynamicBg(currentUser?.mood, otherUser?.mood)); }, [chatMode, currentUser?.mood, otherUser?.mood, getDynamicBg]);
  useEffect(() => { const incognitoMessages = messages?.filter(m => m.mode === 'incognito') || []; if (incognitoMessages.length > 0) { const timer = setTimeout(() => { storageService.messages.where('mode').equals('incognito').delete(); }, 30000); return () => clearTimeout(timer); } }, [messages]);
  useLayoutEffect(() => { if (topMessageId && viewportRef.current) { const el = viewportRef.current.querySelector(`#message-${topMessageId}`); if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' }); setTopMessageId(null); }}, [topMessageId, messages]);
  useEffect(() => { const timeouts = pendingMessageTimeouts.current; return () => { Object.values(timeouts).forEach(clearTimeout); }; }, []);

  const isLoadingPage = isAuthLoading || (isAuthenticated && isChatLoading);
  const isInputDisabled = protocol === 'disconnected' || isSelectionMode;

  const canDeleteForEveryone = useMemo(() => {
    if (!currentUser || !messages) return false;
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
  if (!otherUser || !activeChatId) return <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center"><div><FullPageLoader /><p className="text-lg text-foreground">Setting up your chat...</p>{chatSetupErrorMessage && <p className="text-destructive mt-2">{chatSetupErrorMessage}</p>}</div></div>;

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
                messages={messages || []} 
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
