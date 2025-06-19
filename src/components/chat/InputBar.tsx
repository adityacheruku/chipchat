
import React, { useState, type FormEvent, useRef, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile, Mic, Plus, Loader2, X, Image as ImageIcon LucideImage } from 'lucide-react'; // Changed Paperclip to Plus, added Image for consistency
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
  // const videoInputRef = useRef<HTMLInputElement>(null); // Video clip sending not explicitly in new UI, can be added later
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
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

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, attachmentType: MessageClipType | 'image') => {
    if (disabled) return;
    const file = event.target.files?.[0];
    if (file) {
        if (attachmentType === 'image' && onSendImage) {
            if (!file.type.startsWith('image/')) {
                toast({variant: 'destructive', title: 'Invalid File', description: 'Please select an image file.'});
                return;
            }
            onSendImage(file);
        } else if (attachmentType === 'audio' || attachmentType === 'video') { // Keep video handling for future
             if (attachmentType === 'audio' && !file.type.startsWith('audio/')) {
                toast({variant: 'destructive', title: 'Invalid File', description: 'Please select an audio file.'});
                return;
            }
            // if (attachmentType === 'video' && !file.type.startsWith('video/')) {
            //    toast({variant: 'destructive', title: 'Invalid File', description: 'Please select a video file.'});
            //    return;
            // }
            onSendMoodClip(attachmentType, file);
        }
    }
    setShowAttachmentOptions(false); 
    if(event.target) event.target.value = "";
  };


  return (
    <div className="p-3 border-t border-border bg-card rounded-b-lg">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
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
            <Button 
                type="submit" 
                size="icon" 
                className="bg-accent hover:bg-accent/90 active:bg-accent/80 text-accent-foreground rounded-full focus-visible:ring-ring w-10 h-10 flex-shrink-0"
                disabled={isSending || !messageText.trim() || disabled}
                aria-label={isSending ? "Sending message" : "Send message"}
            >
                {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                <span className="sr-only">{isSending ? "Sending..." : "Send message"}</span>
            </Button>
        </form>

        {showAttachmentOptions && !disabled && (
            <div className="flex justify-around p-2 border-t mt-2 space-x-2">
                <Button variant="outline" size="sm" onClick={() => audioInputRef.current?.click()} className="flex-1">
                    <Mic size={16} className="mr-2"/> Audio
                </Button>
                <input type="file" ref={audioInputRef} accept="audio/*" className="hidden" onChange={(e) => handleFileSelect(e, 'audio')} />
                
                {onSendImage && (
                     <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} className="flex-1">
                        <LucideImage size={16} className="mr-2"/> Image {/* Changed Paperclip to ImageIcon from Lucide */}
                    </Button>
                )}
                <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
            </div>
        )}
    </div>
  );
}
