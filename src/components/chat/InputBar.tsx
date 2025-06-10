
import React, { useState, type FormEvent, useRef, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile, Mic, Paperclip, Loader2, X } from 'lucide-react';
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
  onSendImage?: (file: File) => void; // Optional, if handled separately
  isSending?: boolean;
  onTyping: (isTyping: boolean) => void;
}

export default function InputBar({ onSendMessage, onSendMoodClip, onSendImage, isSending = false, onTyping }: InputBarProps) {
  const [messageText, setMessageText] = useState('');
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (messageText.trim() && !isSending) {
      onSendMessage(messageText.trim());
      setMessageText('');
      onTyping(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    if (e.target.value.trim() !== '') {
      onTyping(true);
    } else {
      onTyping(false);
    }
  };
  
  const handleBlur = () => {
    // Send stop_typing when input loses focus only if text is empty
    if (messageText.trim() === '') {
        onTyping(false);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, clipType: MessageClipType | 'image') => {
    const file = event.target.files?.[0];
    if (file) {
        if (clipType === 'image' && onSendImage) {
            if (!file.type.startsWith('image/')) {
                toast({variant: 'destructive', title: 'Invalid File', description: 'Please select an image file.'});
                return;
            }
            onSendImage(file);
        } else if (clipType === 'audio' || clipType === 'video') {
             if (clipType === 'audio' && !file.type.startsWith('audio/')) {
                toast({variant: 'destructive', title: 'Invalid File', description: 'Please select an audio file.'});
                return;
            }
            if (clipType === 'video' && !file.type.startsWith('video/')) {
                toast({variant: 'destructive', title: 'Invalid File', description: 'Please select a video file.'});
                return;
            }
            onSendMoodClip(clipType, file);
        }
    }
    setShowAttachmentOptions(false); // Close options after selection
    // Reset file input value to allow selecting the same file again
    if(event.target) event.target.value = "";
  };


  return (
    <div className="p-3 border-t border-border bg-card rounded-b-lg">
        <form onSubmit={handleSubmit} className="flex items-center">
            <TooltipProvider>
                <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                    variant="ghost" 
                    size="icon" 
                    type="button" 
                    className="text-muted-foreground hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded-full mr-2 focus-visible:ring-ring"
                    aria-label="Open emoji picker (coming soon)"
                    disabled={isSending}
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
                placeholder="Type a message..."
                value={messageText}
                onChange={handleTextChange}
                onBlur={handleBlur}
                className="flex-grow bg-card border-input focus-visible:ring-ring mr-2"
                autoComplete="off"
                disabled={isSending}
            />

            {/* Attachment Button */}
             <TooltipProvider>
                <Tooltip>
                <TooltipTrigger asChild>
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        type="button" 
                        onClick={() => setShowAttachmentOptions(!showAttachmentOptions)}
                        className="text-muted-foreground hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded-full mr-2 focus-visible:ring-ring"
                        aria-label="Attach file"
                        disabled={isSending}
                        >
                        {showAttachmentOptions ? <X size={22} /> : <Paperclip size={22} />}
                    </Button>
                </TooltipTrigger>
                 <TooltipContent>
                    <p>{showAttachmentOptions ? "Close Attachments" : "Attach File"}</p>
                </TooltipContent>
                </Tooltip>
            </TooltipProvider>


            <Button 
                type="submit" 
                size="icon" 
                className="bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-full focus-visible:ring-ring"
                disabled={isSending || !messageText.trim()}
                aria-label={isSending ? "Sending message" : "Send message"}
            >
                {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                <span className="sr-only">{isSending ? "Sending..." : "Send message"}</span>
            </Button>
        </form>

        {/* Attachment Options - Hidden inputs */}
        {showAttachmentOptions && (
            <div className="flex justify-around p-2 border-t mt-2">
                <Button variant="outline" size="sm" onClick={() => audioInputRef.current?.click()} className="flex-1 mx-1">
                    <Mic size={16} className="mr-2"/> Audio Clip
                </Button>
                <input type="file" ref={audioInputRef} accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(e, 'audio')} />
                
                {/* For simplicity, video clip button can be added similarly */}
                {/* <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} className="flex-1 mx-1"> Video Clip </Button> */}
                {/* <input type="file" ref={videoInputRef} accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} /> */}

                {onSendImage && (
                     <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} className="flex-1 mx-1">
                        <Paperclip size={16} className="mr-2"/> Image
                    </Button>
                )}
                <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
            </div>
        )}
    </div>
  );
}
