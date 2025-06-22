
"use client";

import React, { useState, type FormEvent, useRef, type ChangeEvent, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile, Mic, Paperclip, Loader2, X, Image as ImageIcon, Camera, FileText, StickyNote, StopCircle, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StickerPicker from './StickerPicker';
import type { MessageClipType } from '@/types';
import { PICKER_EMOJIS } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InputBarProps {
  onSendMessage: (text: string) => void;
  onSendSticker: (stickerUrl: string) => void;
  onSendMoodClip: (clipType: MessageClipType, file: File) => void;
  onSendVoiceMessage: (file: File) => void;
  onSendImage: (file: File) => void;
  onSendDocument: (file: File) => void;
  isSending?: boolean;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

const LONG_PRESS_DURATION = 300; // milliseconds
const MAX_RECORDING_SECONDS = 120; // 2 minutes

export default function InputBar({
  onSendMessage,
  onSendSticker,
  onSendMoodClip,
  onSendVoiceMessage,
  onSendImage,
  onSendDocument,
  isSending = false,
  onTyping,
  disabled = false,
}: InputBarProps) {
  const [messageText, setMessageText] = useState('');
  const [isAttachmentPopoverOpen, setIsAttachmentPopoverOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isStickerSheetOpen, setIsStickerSheetOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');

  // State for voice recording
  type RecordingStatus = 'idle' | 'permission_requested' | 'recording' | 'recorded' | 'sending';
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Refs for recording logic
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for file inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null); 

  const { toast } = useToast();

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (messageText.trim() && !isSending && !disabled) {
      onSendMessage(messageText.trim());
      setMessageText('');
      setEmojiSearch('');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    if (disabled) return;
    if (e.target.value.trim() !== '') {
      onTyping(true);
    } else {
      onTyping(false);
    }
  };

  const handleBlur = () => {
    if (disabled) return;
    if (messageText.trim() === '') {
        onTyping(false);
    }
  };
  
  const handleEmojiSelect = (emoji: string) => {
    setMessageText(prev => prev + emoji);
  };

  const handleStickerSelect = (stickerId: string) => {
    if (disabled) return;
    onSendSticker(stickerId);
    setIsStickerSheetOpen(false);
  };
  
  const filteredEmojis = useMemo(() => {
    if (!emojiSearch) return PICKER_EMOJIS;
    const lowerCaseSearch = emojiSearch.toLowerCase();
    const filtered: typeof PICKER_EMOJIS = {};
    for (const category in PICKER_EMOJIS) {
        const cat = category as keyof typeof PICKER_EMOJIS;
        // A better search would use keyword mapping, but for now we search the char itself
        const matchingEmojis = PICKER_EMOJIS[cat].emojis.filter(emoji => emoji.includes(lowerCaseSearch));
        if (matchingEmojis.length > 0) {
            filtered[cat] = { ...PICKER_EMOJIS[cat], emojis: matchingEmojis };
        }
    }
    return filtered;
  }, [emojiSearch]);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, attachmentType: 'media' | 'document') => {
    if (disabled) {
      toast({variant: 'destructive', title: 'Cannot Send', description: 'Chat service is not connected.'});
      return;
    }
    const file = event.target.files?.[0];
    if (file) {
        if (attachmentType === 'media') {
            if (file.type.startsWith('image/')) onSendImage(file);
            else if (file.type.startsWith('video/')) onSendMoodClip('video', file);
            else toast({variant: 'destructive', title: 'Invalid File', description: 'Please select an image or video file.'});
        } else if (attachmentType === 'document') {
            onSendDocument(file);
        }
    }
    setIsAttachmentPopoverOpen(false);
    if(event.target) event.target.value = "";
  };

  // --- Voice Recording Logic ---

  const cleanupRecording = () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
      if (audioURL) URL.revokeObjectURL(audioURL);

      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setRecordingStatus('idle');
      setAudioBlob(null);
      setAudioURL(null);
      setRecordingSeconds(0);
  };

  const handleStartRecording = async () => {
    if (recordingStatus !== 'idle' || disabled) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        toast({ variant: 'destructive', title: 'Unsupported Device', description: 'Your browser does not support voice recording.' });
        return;
    }
    setIsAttachmentPopoverOpen(false);
    setRecordingStatus('permission_requested');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            setAudioBlob(audioBlob); setAudioURL(URL.createObjectURL(audioBlob)); setRecordingStatus('recorded');
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorderRef.current.start();
        setRecordingStatus('recording');
        timerIntervalRef.current = setInterval(() => setRecordingSeconds(prev => prev + 1), 1000);
        maxDurationTimeoutRef.current = setTimeout(() => {
            toast({ title: "Recording Limit Reached", description: `Maximum duration is ${MAX_RECORDING_SECONDS} seconds.`});
            handleStopRecording();
        }, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please enable microphone permissions in your browser settings.' });
        cleanupRecording();
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };
  const handleSendRecordedVoiceMessage = () => {
      if (audioBlob) {
        setRecordingStatus('sending');
        const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
        onSendVoiceMessage(audioFile);
        setTimeout(cleanupRecording, 500);
      }
  };
  const handleButtonPress = () => {
    if (isSending || messageText.trim() !== '') return;
    longPressTimerRef.current = setTimeout(handleStartRecording, LONG_PRESS_DURATION);
  };
  const handleButtonRelease = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (recordingStatus === 'recording') handleStopRecording();
  };
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
    };
  }, []);

  const showSendButton = messageText.trim() !== '';

  if (recordingStatus === 'recording' || recordingStatus === 'permission_requested') {
    return (
        <div className="p-3 border-t border-border bg-card rounded-b-lg flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 text-destructive">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                </span>
                <span>Recording... {new Date(recordingSeconds * 1000).toISOString().substr(14, 5)}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleStopRecording} className="text-destructive hover:bg-destructive/10">
                <StopCircle size={24} />
            </Button>
        </div>
    )
  }

  if (recordingStatus === 'recorded' && audioURL) {
      return (
         <div className="p-3 border-t border-border bg-card rounded-b-lg flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" onClick={cleanupRecording} className="text-destructive hover:bg-destructive/10 rounded-full">
                <Trash2 size={20} />
            </Button>
            <audio src={audioURL} controls className="flex-grow w-full max-w-xs h-10" />
             <Button size="icon" onClick={handleSendRecordedVoiceMessage} className="bg-accent hover:bg-accent/90 rounded-full">
                <Send size={20} />
            </Button>
        </div>
      )
  }

  if (recordingStatus === 'sending') {
     return (
        <div className="p-3 border-t border-border bg-card rounded-b-lg flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" />
            <span className="text-muted-foreground">Sending voice message...</span>
        </div>
     )
  }

  return (
    <div className="p-3 border-t border-border bg-card rounded-b-lg">
      <form onSubmit={handleFormSubmit} className="flex items-center space-x-2">
        <Popover open={isAttachmentPopoverOpen} onOpenChange={setIsAttachmentPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-full focus-visible:ring-ring" aria-label="Attach file" disabled={isSending || disabled}>
              <Paperclip size={22} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top" align="start">
            <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => documentInputRef.current?.click()} className="flex flex-col h-auto py-3 items-center justify-center gap-1">
                    <FileText size={20} className="text-blue-500"/>
                    <span className="text-xs font-normal text-muted-foreground">Document</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} className="flex flex-col h-auto py-3 items-center justify-center gap-1">
                    <ImageIcon size={20} className="text-purple-500"/>
                    <span className="text-xs font-normal text-muted-foreground">Gallery</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} className="flex flex-col h-auto py-3 items-center justify-center gap-1">
                    <Camera size={20} className="text-green-500"/>
                    <span className="text-xs font-normal text-muted-foreground">Camera</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleStartRecording} className="flex flex-col h-auto py-3 items-center justify-center gap-1">
                    <Mic size={20} className="text-red-500"/>
                    <span className="text-xs font-normal text-muted-foreground">Voice Note</span>
                </Button>
            </div>
          </PopoverContent>
        </Popover>
        
        <Input type="text" placeholder="Type a message..." value={messageText} onChange={handleTextChange} onBlur={handleBlur} className="flex-grow bg-card border-input focus-visible:ring-ring" autoComplete="off" disabled={isSending || disabled}/>

        <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-full focus-visible:ring-ring" aria-label="Add an emoji" disabled={isSending || disabled}>
              <Smile size={22} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-none mb-2 bg-card" side="top" align="end">
            <div className="p-2">
                <Input placeholder="Search emojis..." value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} className="w-full bg-muted border-none focus-visible:ring-ring" />
            </div>
            <Tabs defaultValue="Smileys & People" className="w-[300px] p-2">
              <TabsList className="grid w-full grid-cols-4">
                {Object.keys(filteredEmojis).map(category => (<TabsTrigger key={category} value={category}>{PICKER_EMOJIS[category as keyof typeof PICKER_EMOJIS].icon}</TabsTrigger>))}
              </TabsList>
              {Object.entries(filteredEmojis).map(([category, data]) => (
                <TabsContent key={category} value={category}>
                  <div className="grid grid-cols-8 gap-1 h-48 overflow-y-auto mt-2">
                    {data.emojis.map(emoji => (
                      <Button key={emoji} variant="ghost" className="text-xl p-0 h-9 w-9 rounded-md" onClick={() => handleEmojiSelect(emoji)}>{emoji}</Button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </PopoverContent>
        </Popover>

        <Sheet open={isStickerSheetOpen} onOpenChange={setIsStickerSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-full focus-visible:ring-ring" aria-label="Send a sticker" disabled={isSending || disabled}>
              <StickyNote size={22} />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="p-0 border-t bg-card h-[45%] rounded-t-lg">
              <StickerPicker onStickerSelect={handleStickerSelect} />
          </SheetContent>
        </Sheet>
        
        <Button type={showSendButton ? "submit" : "button"} size="icon" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full w-10 h-10 flex-shrink-0" disabled={isSending || disabled || (!showSendButton && messageText.trim() !== '')} onMouseDown={handleButtonPress} onMouseUp={handleButtonRelease} onTouchStart={handleButtonPress} onTouchEnd={handleButtonRelease} onContextMenu={(e) => e.preventDefault()} aria-label={showSendButton ? "Send message" : "Hold to record voice"}>
          {isSending ? <Loader2 size={20} className="animate-spin" /> : (showSendButton ? <Send size={20} /> : <Mic size={20} />)}
        </Button>
      </form>
      
      {/* Hidden file inputs */}
      <input type="file" ref={cameraInputRef} accept="image/*,video/*" capture className="hidden" onChange={(e) => handleFileSelect(e, 'media')} />
      <input type="file" ref={imageInputRef} accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'media')} />
      <input type="file" ref={documentInputRef} accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => handleFileSelect(e, 'document')} />
    </div>
  );
}
