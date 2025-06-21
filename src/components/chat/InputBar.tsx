
import React, { useState, type FormEvent, useRef, type ChangeEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile, Mic, Plus, Loader2, X, Image as ImageIconLucide, Camera, FileText, MapPin } from 'lucide-react'; 
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MessageClipType } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface InputBarProps {
  onSendMessage: (text: string) => void;
  onSendMoodClip: (clipType: MessageClipType, file: File) => void;
  onSendImage?: (file: File) => void; 
  isSending?: boolean;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean; 
}

const LONG_PRESS_DURATION = 500; // milliseconds

export default function InputBar({ 
  onSendMessage, 
  onSendMoodClip, 
  onSendImage, 
  isSending = false, 
  onTyping,
  disabled = false 
}: InputBarProps) {
  const [messageText, setMessageText] = useState('');
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressActive, setIsLongPressActive] = useState(false);

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (messageText.trim() && !isSending && !disabled && !isLongPressActive) {
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

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, attachmentType: 'audio' | 'media') => {
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
        }
    }
    setShowAttachmentOptions(false); 
    if(event.target) event.target.value = "";
  };

  const startLongPressTimer = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (messageText.trim() === '') { // Only activate long press for voice if input is empty
        console.log("Long press detected on send button - initiate voice recording (placeholder)");
        setIsLongPressActive(true);
        // TODO: Implement actual voice recording start and UI changes
        // For now, just logging and setting state
      }
    }, LONG_PRESS_DURATION);
  };

  const clearLongPressTimer = (isSubmittingText: boolean = false) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressActive) {
        console.log("Long press ended / Voice recording ended (placeholder)");
        // TODO: Implement voice recording stop & send/cancel logic
    } else if (isSubmittingText && messageText.trim() && !isSending && !disabled) {
        // If not a long press and there's text, send the message
        onSendMessage(messageText.trim());
        setMessageText('');
        onTyping(false);
    }
    setIsLongPressActive(false);
  };
  
  useEffect(() => {
    // Cleanup timer on component unmount
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleSendButtonMouseDown = () => {
    if (disabled || isSending) return;
    startLongPressTimer();
  };

  const handleSendButtonMouseUp = () => {
    if (disabled || isSending) return;
    clearLongPressTimer(true); // Pass true to indicate potential text submission
  };

  const handleSendButtonTouchStart = () => {
     if (disabled || isSending) return;
     startLongPressTimer();
  };

  const handleSendButtonTouchEnd = () => {
     if (disabled || isSending) return;
     clearLongPressTimer(true); // Pass true to indicate potential text submission
  };
  
  const sendButtonIcon = messageText.trim() === '' ? <Mic size={20} /> : <Send size={20} />;
  const sendButtonLabel = messageText.trim() === '' ? (isLongPressActive ? "Recording..." : "Hold to record voice") : "Send message";

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
                        disabled={isSending || disabled || isLongPressActive}
                        >
                        {showAttachmentOptions ? <X size={22} /> : <Plus size={22} />}
                    </Button>
                </TooltipTrigger>
                 <TooltipContent>
                    <p>{showAttachmentOptions ? "Close Attachments" : "Attach File"}</p>
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
                    disabled={isSending || disabled || isLongPressActive}
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
                placeholder={disabled ? "Waiting for a chat partner..." : (isLongPressActive ? "Recording voice..." : "Type a message...")}
                value={messageText}
                onChange={handleTextChange}
                onBlur={handleBlur}
                className="flex-grow bg-card border-input focus-visible:ring-ring"
                autoComplete="off"
                disabled={isSending || disabled || isLongPressActive}
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
                            disabled={isSending || disabled || isLongPressActive || !onSendImage}
                            onClick={() => cameraInputRef.current?.click()}
                        >
                            <Camera size={22} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Use Camera</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Button 
                type="button" // Changed from submit to prevent form submission on mousedown
                size="icon" 
                className="bg-accent hover:bg-accent/90 active:bg-accent/80 text-accent-foreground rounded-full focus-visible:ring-ring w-10 h-10 flex-shrink-0"
                disabled={isSending || disabled || (messageText.trim() === '' && isLongPressActive)} // Disable if recording and no text
                onMouseDown={handleSendButtonMouseDown}
                onMouseUp={handleSendButtonMouseUp}
                onTouchStart={handleSendButtonTouchStart}
                onTouchEnd={handleSendButtonTouchEnd}
                onContextMenu={(e) => e.preventDefault()} // Prevent context menu on long press
                aria-label={sendButtonLabel}
            >
                {isSending ? <Loader2 size={20} className="animate-spin" /> : sendButtonIcon}
                <span className="sr-only">{isSending ? "Sending..." : sendButtonLabel}</span>
            </Button>
        </form>
        <input type="file" ref={cameraInputRef} accept="image/*" capture className="hidden" onChange={(e) => handleFileSelect(e, 'media')} />
        <input type="file" ref={imageInputRef} accept="image/*,video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'media')} />
        <input type="file" ref={audioInputRef} accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(e, 'audio')} />

        {showAttachmentOptions && !disabled && !isLongPressActive && (
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 border-t mt-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="flex flex-col h-auto py-3 items-center justify-center" disabled>
                                <FileText size={24} className="mb-1 text-blue-500"/>
                                <span className="text-xs font-normal text-muted-foreground">Document</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Coming Soon!</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                
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
