
"use client";

// ⚡️ Wrapped with React.memo to avoid re-renders when props don’t change
import React, { useState, type FormEvent, useRef, type ChangeEvent, useEffect, useMemo, useCallback, memo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Smile, Mic, Paperclip, X, Image as ImageIcon, Camera, FileText, StickyNote, Gift, ShieldAlert, EyeOff, MessageCircle, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StickerPicker from './StickerPicker';
import { PICKER_EMOJIS, type MessageMode, type Message, type User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import Spinner from '../common/Spinner';

interface InputBarProps {
  onSendMessage: (text: string, mode: MessageMode, replyToId?: string) => void;
  onSendSticker: (stickerId: string, mode: MessageMode) => void;
  onSendVoiceMessage: (file: File, mode: MessageMode) => void;
  onSendImage: (file: File, mode: MessageMode) => void;
  onSendVideo: (file: File, mode: MessageMode) => void;
  onSendDocument: (file: File, mode: MessageMode) => void;
  isSending?: boolean;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  chatMode: MessageMode;
  onSelectMode: (mode: MessageMode) => void;
  replyingTo: Message | null;
  onCancelReply: () => void;
  allUsers: Record<string, User>;
}

const MAX_RECORDING_SECONDS = 120;

const AttachmentPreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const fileUrl = useMemo(() => URL.createObjectURL(file), [file]);

  return (
    <div className="relative w-16 h-16 rounded-md overflow-hidden border bg-muted flex-shrink-0">
      {file.type.startsWith('image/') ? (
        <Image src={fileUrl} alt={file.name} fill sizes="64px" className="object-cover" />
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

const ReplyPreview = ({ message, onCancel, allUsers }: { message: Message, onCancel: () => void, allUsers: Record<string, User> }) => {
    const sender = allUsers[message.user_id];
    return (
        <div className="relative flex items-center gap-3 p-2 pr-8 mb-2 border-l-2 border-primary bg-primary/10 rounded-r-md">
            <div className="flex-grow min-w-0">
                <p className="font-semibold text-primary text-sm">{sender?.display_name || "Unknown User"}</p>
                <p className="text-sm text-foreground/80 truncate">{message.text || 'Attachment...'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel} className="absolute top-1/2 right-1 -translate-y-1/2 h-7 w-7 rounded-full text-muted-foreground hover:bg-black/10">
                <X className="h-4 w-4" />
                <span className="sr-only">Cancel reply</span>
            </Button>
        </div>
    );
};

const SoundWave = () => (
    <div className="flex items-center justify-center gap-0.5 h-full w-full">
        <div className="w-1 h-2 rounded-full bg-primary animate-[wave_1.2s_linear_infinite] [animation-delay:-0.8s]"></div>
        <div className="w-1 h-4 rounded-full bg-primary animate-[wave_1.2s_linear_infinite] [animation-delay:-1.2s]"></div>
        <div className="w-1 h-5 rounded-full bg-primary animate-[wave_1.2s_linear_infinite] [animation-delay:-0.4s]"></div>
        <div className="w-1 h-3 rounded-full bg-primary animate-[wave_1.2s_linear_infinite] [animation-delay:-1.0s]"></div>
        <div className="w-1 h-6 rounded-full bg-primary animate-[wave_1.2s_linear_infinite]"></div>
        <div className="w-1 h-4 rounded-full bg-primary animate-[wave_1.2s_linear_infinite] [animation-delay:-0.2s]"></div>
        <div className="w-1 h-2 rounded-full bg-primary animate-[wave_1.2s_linear_infinite] [animation-delay:-0.6s]"></div>
        <div className="w-1 h-5 rounded-full bg-primary animate-[wave_1.2s_linear_infinite] [animation-delay:-1.4s]"></div>
        <div className="w-1 h-3 rounded-full bg-primary animate-[wave_1.2s_linear_infinite] [animation-delay:-0.9s]"></div>
    </div>
)

function InputBar({
  onSendMessage, onSendSticker, onSendVoiceMessage, onSendImage, onSendVideo, onSendDocument,
  isSending = false, onTyping, disabled = false, chatMode, onSelectMode,
  replyingTo, onCancelReply, allUsers
}: InputBarProps) {
  const [messageText, setMessageText] = useState('');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<File[]>([]);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // New state for voice recording
  const [isRecording, setIsRecording] = useState(false);
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
  }, [messageText, replyingTo]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmojis = localStorage.getItem('kuchlu_recentEmojis');
      if (savedEmojis) setRecentEmojis(JSON.parse(savedEmojis));
    }
    // Add keyframes for wave animation to the document head
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes wave {
            0% { height: 10px; }
            50% { height: 25px; }
            100% { height: 10px; }
        }
    `;
    document.head.appendChild(styleSheet);
    return () => {
        document.head.removeChild(styleSheet);
    };

  }, []);

  const addRecentEmoji = useCallback((emoji: string) => {
    setRecentEmojis(prev => {
      const newRecents = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 20);
      if (typeof window !== 'undefined') {
        localStorage.setItem('kuchlu_recentEmojis', JSON.stringify(newRecents));
      }
      return newRecents;
    });
  }, []);

  const handleTypingChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    if (disabled) return;
    onTyping(e.target.value.trim() !== '');
  }, [disabled, onTyping]);

  const handleBlur = useCallback(() => {
    if (disabled) return;
    if (messageText.trim() === '') onTyping(false);
  }, [disabled, messageText, onTyping]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessageText(prev => prev + emoji);
    addRecentEmoji(emoji);
  }, [addRecentEmoji]);

  const handleStickerSelect = useCallback((stickerId: string) => {
    if (disabled) return;
    onSendSticker(stickerId, chatMode);
    setIsToolsOpen(false);
  }, [disabled, onSendSticker, chatMode]);
  
  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) setStagedAttachments(prev => [...prev, ...Array.from(files)]);
    setIsAttachmentOpen(false);
    if (event.target) event.target.value = "";
  }, []);
  
  const handleRemoveAttachment = useCallback((index: number) => {
    setStagedAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const handleDragEvents = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: React.DragEvent) => { handleDragEvents(e); if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { handleDragEvents(e); const relatedTarget = e.relatedTarget as Node | null; if (!e.currentTarget.contains(relatedTarget)) setIsDragging(false); };
  const handleDrop = useCallback((e: React.DragEvent) => {
    handleDragEvents(e); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setStagedAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
      e.dataTransfer.clearData();
    }
  }, []);

  const cleanupRecording = useCallback(() => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
        // Stop the media stream tracks
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      mediaRecorderRef.current = null; audioChunksRef.current = [];
      setIsRecording(false); setRecordingSeconds(0);
  }, []);

  const handleStopAndSendRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;
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
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (audioBlob.size > 0) {
              const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
              onSendVoiceMessage(audioFile, chatMode);
            }
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setRecordingSeconds(0);
        timerIntervalRef.current = setInterval(() => setRecordingSeconds(prev => prev + 1), 1000);
        
        setTimeout(() => {
            if (mediaRecorderRef.current?.state === "recording") {
              toast({ title: "Recording Limit Reached", description: `Maximum duration is ${MAX_RECORDING_SECONDS} seconds.`});
              handleStopAndSendRecording();
            }
        }, MAX_RECORDING_SECONDS * 1000);

    } catch (err) {
        toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please enable microphone permissions in your browser settings.' });
        cleanupRecording();
    }
  }, [isRecording, toast, cleanupRecording, onSendVoiceMessage, chatMode, handleStopAndSendRecording]);

  const handleCompositeSend = useCallback((e?: FormEvent) => {
    e?.preventDefault();
    if (disabled || isSending) return;
    if (messageText.trim()) onSendMessage(messageText.trim(), chatMode, replyingTo?.id);
    stagedAttachments.forEach(file => {
      if (file.type.startsWith('image/')) onSendImage(file, chatMode);
      else if (file.type.startsWith('video/')) onSendVideo(file, chatMode);
      else if (file.type.startsWith('audio/')) onSendVoiceMessage(file, chatMode);
      else onSendDocument(file, chatMode);
    });
    setMessageText(''); setStagedAttachments([]); setEmojiSearch(''); onTyping(false);
  }, [disabled, isSending, messageText, stagedAttachments, onSendMessage, onSendImage, onSendVideo, onSendVoiceMessage, onSendDocument, onTyping, chatMode, replyingTo]);
  
  const showSendButton = useMemo(() => messageText.trim() !== '' || stagedAttachments.length > 0, [messageText, stagedAttachments]);

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

  const modeDetails = useMemo(() => ({
    normal: { icon: MessageCircle, title: "Normal Mode", description: "Standard chat. Messages are saved to history." },
    fight: { icon: ShieldAlert, title: "Fight Mode", description: "For arguments. Distinct look, saved to history." },
    incognito: { icon: EyeOff, title: "Incognito Mode", description: "Messages disappear after 30s. Not saved." },
  }), []);

  const handleModeButtonClick = useCallback((mode: MessageMode) => {
    onSelectMode(mode);
    setIsAttachmentOpen(false);
  }, [onSelectMode]);

  const AttachmentPicker = useCallback(() => (
    <Tabs defaultValue="media" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="media">Media & Files</TabsTrigger>
        <TabsTrigger value="mode">Chat Mode</TabsTrigger>
      </TabsList>
      <TabsContent value="media" className="p-4">
        <div className="grid grid-cols-3 gap-4">
            <Button variant="outline" size="lg" onClick={() => cameraInputRef.current?.click()} className="flex animate-pop-in flex-col h-auto py-4 items-center justify-center gap-2" style={{ animationDelay: '50ms' }}>
                <Camera size={24} className="text-red-500"/><span className="text-sm font-normal">Camera</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => imageInputRef.current?.click()} className="flex animate-pop-in flex-col h-auto py-4 items-center justify-center gap-2" style={{ animationDelay: '100ms' }}>
                <ImageIcon size={24} className="text-purple-500"/><span className="text-sm font-normal">Gallery</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => documentInputRef.current?.click()} className="flex animate-pop-in flex-col h-auto py-4 items-center justify-center gap-2" style={{ animationDelay: '150ms' }}>
                <FileText size={24} className="text-blue-500"/><span className="text-sm font-normal">Document</span>
            </Button>
        </div>
      </TabsContent>
      <TabsContent value="mode" className="p-4">
        <div className="grid gap-4">
          {Object.entries(modeDetails).map(([mode, details]) => {
            const isSelected = mode === chatMode;
            return (
              <Button key={mode} variant={isSelected ? "default" : "outline"} className="h-auto p-4 w-full justify-start text-left" onClick={() => handleModeButtonClick(mode as MessageMode)}>
                <details.icon className={cn("mr-4 h-6 w-6 flex-shrink-0", mode === 'fight' && 'text-destructive', mode === 'incognito' && 'text-muted-foreground')} />
                <div className="flex flex-col">
                  <span className="font-semibold">{details.title}</span>
                  <span className="text-xs text-muted-foreground font-normal">{details.description}</span>
                </div>
              </Button>
            );
          })}
        </div>
      </TabsContent>
    </Tabs>
  ), [modeDetails, chatMode, handleModeButtonClick]);

  const ToolsPicker = useCallback(() => (
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
          <div className="p-2">{Object.entries(filteredEmojis).map(([category, data]) => (<div key={category}><h3 className="text-sm font-medium text-muted-foreground py-1">{category}</h3><div className="grid grid-cols-7 sm:grid-cols-8 gap-1">{data.emojis.map(emoji => (<Button key={emoji} variant="ghost" className="text-xl p-0 h-9 w-9 rounded-md" onClick={() => handleEmojiSelect(emoji)} aria-label={`Select emoji ${emoji}`}>{emoji}</Button>))}</div></div>))}</div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="sticker" className="flex-grow overflow-hidden mt-0"><StickerPicker onStickerSelect={handleStickerSelect} /></TabsContent>
      <TabsContent value="gif" className="flex-grow mt-0 flex items-center justify-center"><p className="text-muted-foreground">GIFs are coming soon!</p></TabsContent>
    </Tabs>
  ), [emojiSearch, recentEmojis, filteredEmojis, handleEmojiSelect, handleStickerSelect]);

  const handleActionButtonClick = () => {
    if (isRecording) {
      handleStopAndSendRecording();
    } else if (showSendButton) {
      handleCompositeSend();
    } else {
      handleStartRecording();
    }
  }

  return (
    <div className={cn("p-3 border-t border-border bg-card transition-colors duration-300", isDragging && "bg-primary/20 border-primary")}
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragEvents} onDrop={handleDrop}>
      
      {replyingTo && <ReplyPreview message={replyingTo} onCancel={onCancelReply} allUsers={allUsers} />}

      {stagedAttachments.length > 0 && (
          <div className="mb-2 p-2 border rounded-lg bg-muted/50">
              <ScrollArea className="h-24 whitespace-nowrap"><div className="flex items-center gap-2">{stagedAttachments.map((file, index) => (<AttachmentPreview key={index} file={file} onRemove={() => handleRemoveAttachment(index)} />))}</div></ScrollArea>
          </div>
      )}

      <div className="flex items-end space-x-2">
        {!isRecording && (
            <Sheet open={isAttachmentOpen} onOpenChange={setIsAttachmentOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-full focus-visible:ring-ring flex-shrink-0" aria-label="Attach file or change mode" disabled={isSending || disabled}><Paperclip size={22} /></Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="p-0 border-t bg-card h-auto rounded-t-lg">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Attachments and Modes</SheetTitle>
                    <SheetDescription>Select a file to attach or change the chat mode.</SheetDescription>
                  </SheetHeader>
                  <AttachmentPicker />
              </SheetContent>
            </Sheet>
        )}
        
        <div className="flex-grow relative flex items-end min-h-[44px] bg-input rounded-2xl">
            {isRecording ? (
                 <div className="flex items-center w-full px-3 h-[44px]">
                     <Button type="button" variant="ghost" size="icon" onClick={cleanupRecording} className="text-destructive h-8 w-8"><Trash2 size={20} /></Button>
                     <div className="flex-grow flex items-center justify-center h-full"><SoundWave /></div>
                     <span className="font-mono text-sm text-muted-foreground w-12 text-center">{new Date(recordingSeconds * 1000).toISOString().substr(14, 5)}</span>
                 </div>
            ) : (
                <>
                    <Textarea ref={textareaRef} placeholder={replyingTo ? "Type your reply..." : "Type a message..."} value={messageText} onChange={handleTypingChange} onBlur={handleBlur} className="w-full bg-transparent border-none focus-visible:ring-0 pr-10 resize-none min-h-[44px] max-h-[120px] pt-[11px]" autoComplete="off" disabled={isSending || disabled} rows={1} aria-label="Message input"/>
                    <Sheet open={isToolsOpen} onOpenChange={setIsToolsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" type="button" className="absolute right-1 bottom-1 h-9 w-9 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-full focus-visible:ring-ring" aria-label="Open emoji and sticker panel" disabled={isSending || disabled}><Smile size={22} /></Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="p-0 border-t bg-card h-[60%] rounded-t-lg flex flex-col">
                            <SheetHeader className="sr-only">
                                <SheetTitle>Emoji and Sticker Picker</SheetTitle>
                                <SheetDescription>Select an emoji, sticker, or GIF to send.</SheetDescription>
                            </SheetHeader>
                            <ToolsPicker />
                        </SheetContent>
                    </Sheet>
                </>
            )}
        </div>
        
        <Button 
          type="button" 
          onClick={handleActionButtonClick} 
          size="icon" 
          className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full w-11 h-11 flex-shrink-0 animate-pop" 
          disabled={isSending || disabled} 
          aria-label={isRecording ? "Send voice message" : showSendButton ? "Send message" : "Record voice message"}
        >
          {isSending ? (
            <Spinner />
          ) : isRecording ? (
            <Send size={22} />
          ) : showSendButton ? (
            <Send size={22} />
          ) : (
            <Mic size={22} />
          )}
        </Button>
      </div>
      
      <input type="file" ref={cameraInputRef} accept="image/*,video/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      <input type="file" ref={imageInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileSelect} multiple />
      <input type="file" ref={documentInputRef} className="hidden" onChange={handleFileSelect} multiple />
    </div>
  );
}

export default memo(InputBar);
