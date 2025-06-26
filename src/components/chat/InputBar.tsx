
"use client";

import React, { useState, type FormEvent, useRef, type ChangeEvent, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Smile, Mic, Paperclip, Loader2, X, Image as ImageIcon, Camera, FileText, StickyNote, StopCircle, Trash2, Gift, ShieldAlert, EyeOff, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StickerPicker from './StickerPicker';
import { PICKER_EMOJIS, type MessageMode } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLongPress } from '@/hooks/useLongPress';

interface InputBarProps {
  onSendMessage: (text: string, mode: MessageMode) => void;
  onSendSticker: (stickerId: string, mode: MessageMode) => void;
  onSendVoiceMessage: (file: File, mode: MessageMode) => void;
  onSendImage: (file: File, mode: MessageMode) => void;
  onSendDocument: (file: File, mode: MessageMode) => void;
  isSending?: boolean;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  chatMode: MessageMode;
  onModeIconClick: () => void;
}

const MAX_RECORDING_SECONDS = 120;

const AttachmentPreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const fileUrl = useMemo(() => URL.createObjectURL(file), [file]);

  return (
    <div className="relative w-16 h-16 rounded-md overflow-hidden border bg-muted flex-shrink-0">
      {file.type.startsWith('image/') ? (
        <Image src={fileUrl} alt={file.name} layout="fill" objectFit="cover" />
      ) : file.type.startsWith('audio/') ? (
         <div className="flex flex-col items-center justify-center h-full p-1 text-center bg-primary/20">
          <Mic className="w-6 h-6 text-primary" />
          <span className="text-xs truncate text-primary/80">Voice</span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-1 text-center">
          <FileText className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs truncate text-muted-foreground">{file.name}</span>
        </div>
      )}
      <Button size="icon" variant="destructive" className="absolute top-0 right-0 h-5 w-5 rounded-full" onClick={onRemove} aria-label={`Remove ${file.name} from attachments`}>
        <X className="h-3 w-3" />
        <span className="sr-only">Remove attachment</span>
      </Button>
    </div>
  );
};


export default function InputBar({
  onSendMessage, onSendSticker, onSendVoiceMessage, onSendImage, onSendDocument,
  isSending = false, onTyping, disabled = false, chatMode, onModeIconClick,
}: InputBarProps) {
  const [messageText, setMessageText] = useState('');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const isMobile = useIsMobile();
  
  const [stagedAttachments, setStagedAttachments] = useState<File[]>([]);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  type RecordingStatus = 'idle' | 'recording' | 'recorded' | 'sending';
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null); 
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = `${scrollHeight}px`;
    }
  }, [messageText]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmojis = localStorage.getItem('chirpChat_recentEmojis');
      if (savedEmojis) setRecentEmojis(JSON.parse(savedEmojis));
    }
  }, []);

  const addRecentEmoji = (emoji: string) => {
    setRecentEmojis(prev => {
      const newRecents = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 20);
      if (typeof window !== 'undefined') {
        localStorage.setItem('chirpChat_recentEmojis', JSON.stringify(newRecents));
      }
      return newRecents;
    });
  };

  const handleTypingChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    if (disabled) return;
    onTyping(e.target.value.trim() !== '');
  };

  const handleBlur = () => {
    if (disabled) return;
    if (messageText.trim() === '') onTyping(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    addRecentEmoji(emoji);
  };

  const handleStickerSelect = (stickerId: string) => {
    if (disabled) return;
    onSendSticker(stickerId, chatMode);
    setIsToolsOpen(false);
  };
  
  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) setStagedAttachments(prev => [...prev, ...Array.from(files)]);
    setIsAttachmentOpen(false);
    if (event.target) event.target.value = "";
  };
  
  const handleRemoveAttachment = (index: number) => {
    setStagedAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleDragEvents = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: React.DragEvent) => { handleDragEvents(e); if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { handleDragEvents(e); const relatedTarget = e.relatedTarget as Node | null; if (!e.currentTarget.contains(relatedTarget)) setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    handleDragEvents(e); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setStagedAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
      e.dataTransfer.clearData();
    }
  };

  const cleanupRecording = useCallback(() => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
      if (audioURL) URL.revokeObjectURL(audioURL);
      mediaRecorderRef.current = null; audioChunksRef.current = [];
      setRecordingStatus('idle'); setAudioBlob(null); setAudioURL(null); setRecordingSeconds(0);
  }, [audioURL]);

  const handleStartRecording = useCallback(async () => {
    if (recordingStatus !== 'idle') return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast({ variant: 'destructive', title: 'Unsupported Device', description: 'Your browser does not support voice recording.' }); return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (navigator.vibrate) navigator.vibrate(50);
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            setAudioBlob(blob); setAudioURL(URL.createObjectURL(blob));
            setRecordingStatus('recorded');
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            stream.getTracks().forEach(track => track.stop());
            if (navigator.vibrate) navigator.vibrate(50);
        };
        mediaRecorderRef.current.start();
        setRecordingStatus('recording');
        timerIntervalRef.current = setInterval(() => setRecordingSeconds(prev => prev + 1), 1000);
        setTimeout(() => {
            if (mediaRecorderRef.current?.state === "recording") {
              toast({ title: "Recording Limit Reached", description: `Maximum duration is ${MAX_RECORDING_SECONDS} seconds.`});
              mediaRecorderRef.current.stop();
            }
        }, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please enable microphone permissions in your browser settings.' });
        cleanupRecording();
    }
  }, [cleanupRecording, recordingStatus, toast]);

  const handleStageVoiceMessage = () => {
      if (audioBlob) {
        const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
        setStagedAttachments(prev => [...prev, audioFile]);
        cleanupRecording(); setIsAttachmentOpen(false);
      }
  };

  const handleCompositeSend = (e: FormEvent) => {
    e.preventDefault();
    if (disabled || isSending) return;
    if (messageText.trim()) onSendMessage(messageText.trim(), chatMode);
    stagedAttachments.forEach(file => {
      if (file.type.startsWith('image/')) onSendImage(file, chatMode);
      else if (file.type.startsWith('audio/')) onSendVoiceMessage(file, chatMode);
      else onSendDocument(file, chatMode);
    });
    setMessageText(''); setStagedAttachments([]); setEmojiSearch(''); onTyping(false);
  };
  
  const showSendButton = messageText.trim() !== '' || stagedAttachments.length > 0;

  const filteredEmojis = useMemo(() => {
    if (!emojiSearch) return PICKER_EMOJIS;
    const lowerCaseSearch = emojiSearch.toLowerCase();
    const filtered: typeof PICKER_EMOJIS = {};
    for (const category in PICKER_EMOJIS) {
        const cat = category as keyof typeof PICKER_EMOJIS;
        const matchingEmojis = PICKER_EMOJIS[cat].emojis.filter(emoji => 
            PICKER_EMOJIS[cat].keywords.some(kw => kw.includes(lowerCaseSearch) || emoji.includes(lowerCaseSearch))
        );
        if (matchingEmojis.length > 0) filtered[cat] = { ...PICKER_EMOJIS[cat], emojis: matchingEmojis };
    }
    return filtered;
  }, [emojiSearch]);

  const recordButtonLongPress = useLongPress(handleStartRecording, {
    onFinish: () => { if(mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop() },
    threshold: 250
  });

  const AttachmentPicker = () => (
    <Tabs defaultValue="media" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="media">Media & Files</TabsTrigger>
        <TabsTrigger value="audio">Voice Note</TabsTrigger>
      </TabsList>
      <TabsContent value="media" className="p-4">
        <div className="grid grid-cols-3 gap-4">
            <Button variant="outline" size="lg" onClick={() => cameraInputRef.current?.click()} className="flex flex-col h-auto py-4 items-center justify-center gap-2">
                <Camera size={24} className="text-red-500"/><span className="text-sm font-normal">Camera</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => imageInputRef.current?.click()} className="flex flex-col h-auto py-4 items-center justify-center gap-2">
                <ImageIcon size={24} className="text-purple-500"/><span className="text-sm font-normal">Gallery</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => documentInputRef.current?.click()} className="flex flex-col h-auto py-4 items-center justify-center gap-2">
                <FileText size={24} className="text-blue-500"/><span className="text-sm font-normal">Document</span>
            </Button>
        </div>
      </TabsContent>
      <TabsContent value="audio" className="p-4 h-80 flex flex-col items-center justify-center">
        {recordingStatus === 'recording' ? (
          <>
            <div className="text-destructive text-2xl font-mono mb-4">{new Date(recordingSeconds * 1000).toISOString().substr(14, 5)}</div>
            <div className="relative h-16 w-16"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span><Mic className="relative h-16 w-16 text-destructive" /></div>
            <p className="text-muted-foreground mt-4">Release to stop...</p>
          </>
        ) : recordingStatus === 'recorded' && audioURL ? (
          <>
            <p className="text-muted-foreground mb-4">Voice message ready</p><audio src={audioURL} controls className="w-full" />
            <div className="flex w-full justify-between mt-8">
              <Button variant="ghost" onClick={cleanupRecording}><Trash2 className="mr-2"/> Discard</Button>
              <Button onClick={handleStageVoiceMessage}><Send className="mr-2"/> Add to message</Button>
            </div>
          </>
        ) : (
          <>
              <Mic className="h-16 w-16 text-muted-foreground mb-4"/><p className="text-muted-foreground mb-8 text-center">Press and hold to start recording your voice note.</p>
              <Button variant="default" size="lg" className="rounded-full bg-primary hover:bg-primary/90" {...recordButtonLongPress}>Hold to Record</Button>
          </>
        )}
      </TabsContent>
    </Tabs>
  );

  const ToolsPicker = () => (
    <Tabs defaultValue="emoji" className="w-full flex flex-col h-full">
      <SheetHeader className="p-2 border-b">
          <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="emoji"><Smile size={18}/></TabsTrigger><TabsTrigger value="sticker"><StickyNote size={18}/></TabsTrigger><TabsTrigger value="gif" disabled><Gift size={18}/></TabsTrigger></TabsList>
      </SheetHeader>
      <TabsContent value="emoji" className="flex-grow overflow-hidden mt-0">
        <div className="p-2">
            <Input id="emoji-search" placeholder="Search emojis..." value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} className="w-full bg-muted border-none focus-visible:ring-ring" aria-label="Search emojis"/>
        </div>
        {!emojiSearch && recentEmojis.length > 0 && (
          <div className="px-2 pb-2 border-b">
              <h3 className="text-xs font-semibold text-muted-foreground mb-1">Recent</h3>
              <div className="flex gap-1">{recentEmojis.map(emoji => (<Button key={emoji} variant="ghost" className="text-xl p-0 h-9 w-9 rounded-md" onClick={() => handleEmojiSelect(emoji)} aria-label={`Select emoji ${emoji}`}>{emoji}</Button>))}</div>
          </div>
        )}
        <ScrollArea className="h-[calc(100%-110px)]">
          <div className="p-2">{Object.entries(filteredEmojis).map(([category, data]) => (<div key={category}><h3 className="text-sm font-medium text-muted-foreground py-1">{category}</h3><div className="grid grid-cols-8 gap-1">{data.emojis.map(emoji => (<Button key={emoji} variant="ghost" className="text-xl p-0 h-9 w-9 rounded-md" onClick={() => handleEmojiSelect(emoji)} aria-label={`Select emoji ${emoji}`}>{emoji}</Button>))}</div></div>))}</div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="sticker" className="flex-grow overflow-hidden mt-0"><StickerPicker onStickerSelect={handleStickerSelect} /></TabsContent>
      <TabsContent value="gif" className="flex-grow mt-0 flex items-center justify-center"><p className="text-muted-foreground">GIFs are coming soon!</p></TabsContent>
    </Tabs>
  );

  const AttachmentPickerComponent = isMobile ? Sheet : Popover;
  const AttachmentPickerTrigger = isMobile ? SheetTrigger : PopoverTrigger;
  const AttachmentPickerContent = isMobile ? SheetContent : PopoverContent;

  const ToolsPickerComponent = isMobile ? Sheet : Popover;
  const ToolsPickerTrigger = isMobile ? SheetTrigger : PopoverTrigger;
  const ToolsPickerContent = isMobile ? SheetContent : PopoverContent;

  const ModeIcon = ({ mode }: { mode: MessageMode }) => {
    switch (mode) {
      case 'fight': return <ShieldAlert size={22} className="text-destructive" />;
      case 'incognito': return <EyeOff size={22} className="text-muted-foreground" />;
      default: return <MessageCircle size={22} className="text-muted-foreground" />;
    }
  };

  return (
    <div className={cn("p-3 border-t border-border bg-card rounded-b-lg transition-colors duration-300", isDragging && "bg-primary/20 border-primary")}
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragEvents} onDrop={handleDrop}>
      {stagedAttachments.length > 0 && (
          <div className="mb-2 p-2 border rounded-lg bg-muted/50">
              <ScrollArea className="h-24 whitespace-nowrap"><div className="flex items-center gap-2">{stagedAttachments.map((file, index) => (<AttachmentPreview key={index} file={file} onRemove={() => handleRemoveAttachment(index)} />))}</div></ScrollArea>
          </div>
      )}

      <form onSubmit={handleCompositeSend} className="flex items-end space-x-2">
        <Button variant="ghost" size="icon" type="button" onClick={onModeIconClick} className="text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-full focus-visible:ring-ring flex-shrink-0" aria-label="Change chat mode" disabled={isSending || disabled}>
            <ModeIcon mode={chatMode} />
        </Button>

        <AttachmentPickerComponent open={isAttachmentOpen} onOpenChange={setIsAttachmentOpen}>
          <AttachmentPickerTrigger asChild>
            <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-full focus-visible:ring-ring flex-shrink-0" aria-label="Attach file" disabled={isSending || disabled}><Paperclip size={22} /></Button>
          </AttachmentPickerTrigger>
          <AttachmentPickerContent side="bottom" className={cn(isMobile ? "p-0 border-t bg-card h-auto rounded-t-lg" : "w-80 p-2")}><AttachmentPicker /></AttachmentPickerContent>
        </AttachmentPickerComponent>
        
        <div className="flex-grow relative flex items-end">
             <Textarea ref={textareaRef} placeholder="Type a message..." value={messageText} onChange={handleTypingChange} onBlur={handleBlur} className="w-full bg-card border-input focus-visible:ring-ring pr-10 resize-none min-h-[44px] max-h-[120px] pt-[11px]" autoComplete="off" disabled={isSending || disabled} rows={1} aria-label="Message input"/>
             <ToolsPickerComponent open={isToolsOpen} onOpenChange={setIsToolsOpen}>
                <ToolsPickerTrigger asChild>
                    <Button variant="ghost" size="icon" type="button" className="absolute right-1 bottom-1 h-9 w-9 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-full focus-visible:ring-ring" aria-label="Open emoji and sticker panel" disabled={isSending || disabled}><Smile size={22} /></Button>
                </ToolsPickerTrigger>
                <ToolsPickerContent side="bottom" className={cn(isMobile ? "p-0 border-t bg-card h-[60%] rounded-t-lg flex flex-col" : "w-[400px] h-[500px] p-0 flex flex-col")}><ToolsPicker /></ToolsPickerContent>
            </ToolsPickerComponent>
        </div>
        
        <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full w-11 h-11 flex-shrink-0" disabled={!showSendButton || isSending || disabled} aria-label="Send message">
          {isSending ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
        </Button>
      </form>
      
      <input type="file" ref={cameraInputRef} accept="image/*,video/*" capture className="hidden" onChange={handleFileSelect} />
      <input type="file" ref={imageInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileSelect} multiple />
      <input type="file" ref={documentInputRef} className="hidden" onChange={handleFileSelect} multiple />
    </div>
  );
}
