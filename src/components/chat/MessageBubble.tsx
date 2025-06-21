
import type { Message, User, SupportedEmoji } from '@/types';
import { ALL_SUPPORTED_EMOJIS } from '@/types';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [isPickerVisible, setPickerVisible] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

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

  // --- New Long-Press Handlers ---
  const handlePointerDown = () => {
    longPressTimerRef.current = setTimeout(() => {
      setPickerVisible(true);
    }, 400); // 400ms for long press
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleReactionSelect = (emoji: SupportedEmoji) => {
    onToggleReaction(message.id, emoji);
    setPickerVisible(false);
  };
  
  // Close picker when clicking outside
  useEffect(() => {
    if (!isPickerVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        setPickerVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPickerVisible]);


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

  const HorizontalEmojiPicker = (
    <div
      className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-card rounded-full shadow-lg z-10 animate-in fade-in zoom-in-90"
      // Stop propagation to prevent the outside click handler from firing immediately
      onMouseDown={(e) => e.stopPropagation()} 
    >
      {ALL_SUPPORTED_EMOJIS.map(emoji => (
        <Button
          key={emoji}
          variant="ghost"
          size="icon"
          className="p-1.5 h-8 w-8 text-xl rounded-full hover:bg-accent/20 active:scale-110 transition-transform"
          onClick={() => handleReactionSelect(emoji)}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );

  return (
    <div className={cn('flex flex-col group', alignmentClass)}>
      <div 
        ref={bubbleRef}
        className={cn(
          'flex max-w-xs md:max-w-md lg:max-w-lg relative', 
          isCurrentUser 
            ? 'flex-row-reverse space-x-reverse items-end' 
            : 'flex-row items-start space-x-2'
        )}
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
        // Prevent context menu on mobile long press
        onContextMenu={(e) => { if (isPickerVisible) e.preventDefault()}}
      >
        <Image
          src={sender.avatar_url || "https://placehold.co/100x100.png"}
          alt={sender.display_name}
          width={32}
          height={32}
          className={cn(
            "rounded-full object-cover self-end mb-0.5",
            isCurrentUser ? "" : "order-first"
          )}
          data-ai-hint={sender['data-ai-hint'] || "person portrait"}
          key={sender.avatar_url || sender.id}
        />
        <div className="flex flex-col w-full">
          {!isCurrentUser && (
            <p className="text-xs font-semibold text-muted-foreground mb-0.5 ml-2">{sender.display_name}</p>
          )}
          
          <div className={cn('p-3 rounded-xl shadow min-w-[80px] relative', bubbleColorClass, bubbleBorderRadius)}>
            {isPickerVisible && HorizontalEmojiPicker}

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
            
            {message.reactions && Object.keys(message.reactions).length > 0 && (
              <div className={cn("mt-2 flex flex-wrap gap-1", isCurrentUser ? "justify-end" : "justify-start")}>
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
          </div>
        </div>
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className={cn('text-xs text-muted-foreground mt-1 px-2 cursor-default', isCurrentUser ? 'text-right' : 'text-left ml-10')}>
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
  );
}

export default memo(MessageBubble);
