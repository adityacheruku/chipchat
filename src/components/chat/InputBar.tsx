
import React, { useState, type FormEvent, useRef, type ChangeEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile, Mic, Plus, Loader2, X, Image as ImageIconLucide, Camera, FileText, MapPin, Paperclip, Trash2, StopCircle, Play } from 'lucide-react'; 
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MessageClipType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InputBarProps {
  onSendMessage: (text: string) => void;
  onSendMoodClip: (clipType: MessageClipType, file: File) => void;
  onSendImage?: (file: File) => void; 
  onSendDocument: (file: File) => void;
  isSending?: boolean;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean; 
}

const LONG_PRESS_DURATION = 300; // milliseconds
const MAX_RECORDING_SECONDS = 120; // 2 minutes

export default function InputBar({ 
  onSendMessage, 
  onSendMoodClip, 
  onSendImage,
  onSendDocument,
  isSending = false, 
  onTyping,
  disabled = false 
}: InputBarProps) {
  const [messageText, setMessageText] = useState('');
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  
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
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  
  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (messageText.trim() && !isSending && !disabled) {
      onSendMessage(messageText.trim());
      setMessageText('');
      onTyping(false);
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

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, attachmentType: 'audio' | 'media' | 'document') => {
    if (disabled) return;
    const file = event.target.files?.[0];
    if (file) {
        if (attachmentType === 'media' && onSendImage) {
            if (file.type.startsWith('image/')) {
                onSendImage(file);
            } else if (file.type.startsWith('video/')) {
                onSendMoodClip('video', file);
            } else {
                 toast({variant: 'destructive', title: 'Invalid File', description: 'Please select an image or video file.'});
            }
        } else if (attachmentType === 'audio') { 
             if (!file.type.startsWith('audio/')) {
                toast({variant: 'destructive', title: 'Invalid File', description: 'Please select an audio file.'});
                return;
            }
            onSendMoodClip(attachmentType, file);
        } else if (attachmentType === 'document') {
            onSendDocument(file);
        }
    }
    setShowAttachmentOptions(false); 
    if(event.target) event.target.value = "";
  };

  // --- Voice Recording Logic ---

  const cleanupRecording = () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioURL) URL.revokeObjectURL(audioURL);

      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setRecordingStatus('idle');
      setAudioBlob(null);
      setAudioURL(null);
      setRecordingSeconds(0);
  };
  
  const handleStartRecording = async () => {
    if (recordingStatus !== 'idle') return;

    setRecordingStatus('permission_requested');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            setAudioBlob(audioBlob);
            setAudioURL(audioUrl);
            setRecordingStatus('recorded');
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setRecordingStatus('recording');

        timerIntervalRef.current = setInterval(() => {
            setRecordingSeconds(prev => prev + 1);
        }, 1000);

        maxDurationTimeoutRef.current = setTimeout(() => {
            toast({ title: "Recording Limit Reached", description: `Maximum duration of ${MAX_RECORDING_SECONDS} seconds reached.`});
            handleStopRecording();
        }, MAX_RECORDING_SECONDS * 1000);

    } catch (err) {
        console.error("Microphone access denied:", err);
        toast({
            variant: 'destructive',
            title: 'Microphone Access Denied',
            description: 'Please enable microphone permissions in your browser settings to record voice messages.',
        });
        cleanupRecording();
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
    }
  };

  const handleDeletePreview = () => {
      cleanupRecording();
  };

  const handleSendVoiceMessage = () => {
      if (audioBlob) {
        setRecordingStatus('sending');
        const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
        onSendMoodClip('audio', audioFile);
        
        setTimeout(() => {
            cleanupRecording();
        }, 500);
      }
  };

  const handleButtonPress = () => {
    if (disabled || isSending || messageText.trim() !== '') return;
    
    longPressTimerRef.current = setTimeout(() => {
        handleStartRecording();
    }, LONG_PRESS_DURATION);
  };

  const handleButtonRelease = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
    }
    if (recordingStatus === 'recording') {
        handleStopRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
    };
  }, []);
  
  const sendButtonIcon = messageText.trim() === '' ? <Mic size={20} /> : <Send size={20} />;

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
            <Button variant="ghost" size="icon" onClick={handleDeletePreview} className="text-destructive hover:bg-destructive/10 rounded-full">
                <Trash2 size={20} />
            </Button>
            <audio src={audioURL} controls className="flex-grow w-full max-w-xs h-10" />
             <Button size="icon" onClick={handleSendVoiceMessage} className="bg-accent hover:bg-accent/90 rounded-full">
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
            <TooltipProvider>
                 <Tooltip>
                <TooltipTrigger asChild>
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        type="button" 
                        onClick={() => setShowAttachmentOptions(!showAttachmentOptions)}
                        className="text-muted-foreground hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded-full focus-visible:ring-ring"
                        aria-label={showAttachmentOptions ? "Close attachments menu" : "Open attachments menu"}
                        disabled={isSending || disabled}
                        >
                        {showAttachmentOptions ? <X size={22} /> : <Paperclip size={22} />}
                    </Button>
                </TooltipTrigger>
                 <TooltipContent>
                    <p>{showAttachmentOptions ? "Close" : "Attach File"}</p>
                </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
                <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                    variant="ghost" 
                    size="icon" 
                    type="button" 
                    className="text-muted-foreground hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded-full focus-visible:ring-ring"
                    aria-label="Open emoji picker (coming soon)"
                    disabled={isSending || disabled}
                    >
                    <Smile size={22} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Emoji - Coming Soon!</p>
                </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <Input
                type="text"
                placeholder={disabled ? "Waiting for a chat partner..." : "Type a message..."}
                value={messageText}
                onChange={handleTextChange}
                onBlur={handleBlur}
                className="flex-grow bg-card border-input focus-visible:ring-ring"
                autoComplete="off"
                disabled={isSending || disabled}
            />
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="text-muted-foreground hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded-full focus-visible:ring-ring"
                            aria-label="Use camera"
                            disabled={isSending || disabled || !onSendImage}
                            onClick={() => cameraInputRef.current?.click()}
                        >
                            <Camera size={22} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Use Camera</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Button 
                type="button"
                size="icon" 
                className="bg-accent hover:bg-accent/90 active:bg-accent/80 text-accent-foreground rounded-full focus-visible:ring-ring w-10 h-10 flex-shrink-0"
                disabled={isSending || disabled}
                onClick={messageText.trim() ? () => handleFormSubmit(new Event('submit', {cancelable: true}) as unknown as FormEvent<HTMLFormElement>) : undefined}
                onMouseDown={handleButtonPress}
                onMouseUp={handleButtonRelease}
                onTouchStart={handleButtonPress}
                onTouchEnd={handleButtonRelease}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={messageText.trim() ? "Send message" : "Hold to record voice"}
            >
                {isSending ? <Loader2 size={20} className="animate-spin" /> : sendButtonIcon}
            </Button>
        </form>
        <input type="file" ref={cameraInputRef} accept="image/*" capture className="hidden" onChange={(e) => handleFileSelect(e, 'media')} />
        <input type="file" ref={imageInputRef} accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'media')} />
        <input type="file" ref={audioInputRef} accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(e, 'audio')} />
        <input type="file" ref={documentInputRef} accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => handleFileSelect(e, 'document')} />

        {showAttachmentOptions && !disabled && (
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 border-t mt-2">
                <Button variant="outline" size="sm" onClick={() => documentInputRef.current?.click()} className="flex flex-col h-auto py-3 items-center justify-center">
                    <FileText size={24} className="mb-1 text-blue-500"/>
                    <span className="text-xs font-normal text-muted-foreground">Document</span>
                </Button>
                
                {onSendImage && (
                     <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} className="flex flex-col h-auto py-3 items-center justify-center">
                        <ImageIconLucide size={24} className="mb-1 text-purple-500"/>
                         <span className="text-xs font-normal text-muted-foreground">Photo/Video</span>
                    </Button>
                )}
               
                <Button variant="outline" size="sm" onClick={() => audioInputRef.current?.click()} className="flex flex-col h-auto py-3 items-center justify-center">
                    <Mic size={24} className="mb-1 text-red-500"/>
                    <span className="text-xs font-normal text-muted-foreground">Audio</span>
                </Button>
               
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="flex flex-col h-auto py-3 items-center justify-center" disabled>
                                <MapPin size={24} className="mb-1 text-green-500"/>
                                 <span className="text-xs font-normal text-muted-foreground">Location</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Coming Soon!</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        )}
    </div>
  );
}
