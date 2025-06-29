
"use client";

import { v4 as uuidv4 } from 'uuid';
import { uploadManager } from '@/services/uploadManager';
import { validateFile } from '@/utils/fileValidation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Message, UploadProgress } from '@/types';
import { useState, useCallback, useEffect } from 'react';
import { realtimeService } from '@/services/realtimeService';

// This hook is designed to be used within the chat page component,
// which will provide the state setters for messages.
export function useFileUpload({ setMessages }: { setMessages: React.Dispatch<React.SetStateAction<Message[]>> }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    const handleProgress = (update: UploadProgress) => {
        if (update.status === 'completed' && update.result) {
            setMessages(prev => prev.map(m => m.client_temp_id === update.messageId ? { ...m, uploadStatus: 'completed' } : m));
            
            const originalMessage = setMessages(prev => {
                const msg = prev.find(m => m.client_temp_id === update.messageId);
                return msg ? [msg] : [];
            })[0];
            
            if(!originalMessage) return;

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
            
            realtimeService.sendMessage(payload);

        } else if (update.status === 'failed') {
            setMessages(prev => prev.map(m => m.client_temp_id === update.messageId ? { ...m, uploadStatus: 'failed', status: 'failed' } : m));
        } else if (update.status === 'uploading') {
             setMessages(prev => prev.map(m => m.client_temp_id === update.messageId ? { ...m, uploadProgress: update.progress } : m));
        }
    };

    const unsubscribe = uploadManager.subscribe(handleProgress);
    return () => unsubscribe();
  }, [setMessages]);

  const uploadFile = useCallback(async (file: File, chatId: string, mode: Message['mode'], replyToId?: string): Promise<string> => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'Not authenticated' });
      throw new Error('User not authenticated');
    }

    const validation = validateFile(file);
    if (!validation.isValid) {
      toast({ variant: 'destructive', title: 'Invalid File', description: validation.errors.join(' ') });
      throw new Error(validation.errors.join(' '));
    }

    const messageId = uuidv4();
    
    const optimisticMessage: Message = {
        id: messageId,
        client_temp_id: messageId,
        user_id: currentUser.id,
        chat_id: chatId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'uploading',
        uploadStatus: 'pending',
        uploadProgress: 0,
        message_subtype: validation.fileType,
        mode,
        reply_to_message_id: replyToId,
        file: file,
        document_name: file.name,
        image_url: validation.fileType === 'image' ? URL.createObjectURL(file) : undefined,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    
    uploadManager.addToQueue({
      id: uuidv4(),
      file,
      messageId,
      chatId,
      priority: 5,
    });
    
    return messageId;
  }, [currentUser, toast, setMessages]);

  return { uploadFile };
}
