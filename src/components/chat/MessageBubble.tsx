"use client";

import type { Message, User, SupportedEmoji } from '@/types';
import { ALL_SUPPORTED_EMOJIS } from '@/types';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlayCircle, SmilePlus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState, useEffect, useRef, memo } from 'react';

interface MessageBubbleProps {
  message: Message;
  sender: User;
  isCurrentUser: boolean;
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
  onShowReactions: (message: Message, allUsers: Record<string, User>) => void;
  allUsers: Record<string, User>;
}

function MessageBubble({ message, sender, isCurrentUser, currentUserId, onToggleReaction, onShowReactions, allUsers }: MessageBubbleProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const prevReactionsRef = useRef<Message['reactions']>();
  const [animatedEmojis, setAnimatedEmojis] = useState<Record<SupportedEmoji, boolean>>({});

  useEffect(() => {
    const newAnimations: Record<SupportedEmoji, boolean> = {};
    let hasChanges = false;

    ALL_SUPPORTED_EMOJIS.forEach(emoji => {
      const prevCount = prevReactionsRef.current?.[emoji]?.length || 0;
      const currentCount = message.reactions?.[emoji]?.length || 0;

      if (currentCount !== prevCount) { 
        newAnimations[emoji] = true;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setAnimatedEmojis(newAnimations);
      const timer = setTimeout(() => setAnimatedEmojis({}), 300); 
      return () => clearTimeout(timer);
    }

    prevReactionsRef.current = message.reactions ? JSON.parse(JSON.stringify(message.reactions)) : {};
  }, [message.reactions]);
  
  const handleReactionSelect = (emoji: SupportedEmoji) => {
    onToggleReaction(message.id, emoji);
    setIsPickerOpen(false); // This is the key fix
  };

  const getReactorNames = (reactors: string[] | undefined) => {
    if (!reactors || reactors.length === 0) return "No one";
    const MAX_NAMES = 3;
    const names = reactors.slice(0, MAX_NAMES).map(id => allUsers[id]?.display_name || 'Unknown User');
    let namesString = names.join(', ');
    if (reactors.length > MAX_NAMES) {
      namesString += ` and ${reactors.length - MAX_NAMES} more`;
    }
    return namesString;
  };

  const alignmentClass = isCurrentUser ? 'items-end' : 'items-start';
  const bubbleColorClass = isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground';
  const bubbleBorderRadius = isCurrentUser ? 'rounded-br-none' : 'rounded-bl-none';

  let formattedTime = "sending...";
  try {
    if (message.created_at && message.status !== 'sending') {
        const timestampDate = parseISO(message.created_at);
        formattedTime = format(timestampDate, 'p');
    } else if (message.status === 'sending') {
        formattedTime = 'Sending...';
    }
  } catch(e) {
    console.warn("Could not parse message timestamp:", message.created_at)
  }

  return (
    <div className={cn('flex flex-col group', alignmentClass)}>
      <div className={cn('flex items-end', isCurrentUser ? 'flex-row-reverse space-x-reverse' : 'flex-row space-x-2')}>
        <Image
          src={sender.avatar_url || "https://placehold.co/100x100.png"}
          alt={sender.display_name}
          width={32}
          height={32}
          className="rounded-full object-cover self-end mb-0.5"
          data-ai-hint={sender['data-ai-hint'] || "person portrait"}
          key={sender.avatar_url || sender.id}
        />
        
        <div className="flex flex-col">
          {!isCurrentUser && (
            <p className="text-xs font-semibold text-muted-foreground mb-0.5 ml-2">{sender.display_name}</p>
          )}
          <div className={cn('p-3 rounded-xl shadow min-w-[80px]', bubbleColorClass, bubbleBorderRadius)}>
            {message.clip_url && message.clip_type ? (
              <div className="flex items-center gap-2">
                <PlayCircle size={24} className={cn(isCurrentUser ? "text-primary-foreground/80" : "text-secondary-foreground/80")} />
                <a href={message.clip_url} target="_blank" rel="noopener noreferrer" className="text-sm italic underline hover:opacity-80">
                  {message.clip_placeholder_text || `View ${message.clip_type} clip`}
                </a>
              </div>
            ) : message.image_url ? (
               <a href={message.image_url} target="_blank" rel="noopener noreferrer" className="block max-w-xs">
                  <Image 
                      src={message.image_url} 
                      alt="Chat image" 
                      width={200} 
                      height={150} 
                      className="rounded-md object-cover cursor-pointer hover:opacity-80"
                      data-ai-hint="chat photo"
                  />
               </a>
            ) : message.text ? (
              <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">Message content not available</p>
            )}
          </div>
        </div>

        <div className="self-center px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground">
                <SmilePlus size={16} />
                <span className="sr-only">Add reaction</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent 
                side="bottom" 
                align={isCurrentUser ? "end" : "start"} 
                className="flex gap-1 p-1 w-auto rounded-full bg-card shadow-lg border"
            >
              {ALL_SUPPORTED_EMOJIS.map(emoji => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="icon"
                  className="p-1.5 h-8 w-8 text-xl rounded-full hover:bg-accent/20 active:scale-110 transition-transform"
                  onClick={() => handleReactionSelect(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <div className={cn('pt-1', isCurrentUser ? 'pr-10' : 'pl-10')}>
        {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className={cn("flex flex-wrap gap-1", isCurrentUser ? "justify-end" : "justify-start")}>
            {(Object.keys(message.reactions) as SupportedEmoji[]).map(emoji => {
                const reactors = message.reactions?.[emoji];
                if (!reactors || reactors.length === 0) return null;
                
                const currentUserReacted = reactors.includes(currentUserId);
                const isAnimated = animatedEmojis[emoji];
                const reactorNames = getReactorNames(reactors);

                return (
                <TooltipProvider key={emoji} delayDuration={100}>
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                        onClick={() => onShowReactions(message, allUsers)}
                        className={cn(
                            "text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-all",
                            currentUserReacted 
                            ? "bg-accent text-accent-foreground border-accent/80"
                            : "bg-card/50 border-border hover:bg-muted",
                            isAnimated && "animate-pop" 
                        )}
                        aria-label={`Reacted with ${emoji}: ${reactorNames}. Click to see details.`}
                        >
                        <span>{emoji}</span>
                        <span className="font-medium">{reactors.length}</span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{reactorNames}</p>
                    </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                );
            })}
            </div>
        )}
        
        <TooltipProvider>
            <Tooltip>
            <TooltipTrigger asChild>
                <p className={cn('text-xs text-muted-foreground mt-0.5 cursor-default', isCurrentUser ? 'text-right' : 'text-left')}>
                {formattedTime}
                </p>
            </TooltipTrigger>
            {message.created_at && message.status !== 'sending' && (
                <TooltipContent>
                    <p>{format(parseISO(message.created_at), 'PPpp')}</p>
                </TooltipContent>
            )}
            </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
