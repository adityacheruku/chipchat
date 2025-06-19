
import type { Message, User, SupportedEmoji } from '@/types';
import { ALL_SUPPORTED_EMOJIS } from '@/types';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SmilePlus, PlayCircle } from 'lucide-react'; // Removed Image as ImageIcon from here as it's not used
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
import { useState, useEffect, useRef } from 'react';

interface MessageBubbleProps {
  message: Message;
  sender: User;
  isCurrentUser: boolean;
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
}

export default function MessageBubble({ message, sender, isCurrentUser, currentUserId, onToggleReaction }: MessageBubbleProps) {
  const alignmentClass = isCurrentUser ? 'items-end' : 'items-start';
  // Updated to use primary for current user (sender) and secondary for other user (receiver)
  const bubbleColorClass = isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground';
  const bubbleBorderRadius = isCurrentUser ? 'rounded-br-none' : 'rounded-bl-none';

  let formattedTime = "sending...";
  try {
    if (message.created_at && message.status !== 'sending') { // Don't format if still sending
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


  const handleReactionClick = (emoji: SupportedEmoji) => {
    onToggleReaction(message.id, emoji);
  };

  const reactionPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute -top-3 p-1 h-7 w-7 rounded-full bg-card text-muted-foreground opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shadow-md hover:text-accent active:text-accent",
            isCurrentUser ? "-left-2" : "-right-2"
          )}
          aria-label="Add reaction"
        >
          <SmilePlus size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1 bg-card border shadow-lg rounded-full">
        <div className="flex space-x-1">
          {ALL_SUPPORTED_EMOJIS.map(emoji => (
            <Button
              key={emoji}
              variant="ghost"
              size="icon"
              className="p-1.5 h-8 w-8 text-xl rounded-full hover:bg-accent/20 active:scale-90 transition-transform"
              onClick={() => handleReactionClick(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const messageContentDiv = (
    <div className={cn('p-3 rounded-xl shadow min-w-[80px] relative group/bubble', bubbleColorClass, bubbleBorderRadius)}>
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

            return (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-colors",
                  currentUserReacted 
                    ? (isCurrentUser ? "bg-background/30 border-primary-foreground/50 text-primary-foreground" : "bg-accent text-accent-foreground border-accent/80") // Adjusted current user reacted on their own message
                    : (isCurrentUser ? "bg-background/10 border-primary-foreground/30 text-primary-foreground/80 hover:bg-background/20" : "bg-background/50 border-border hover:bg-muted"),
                  isAnimated && "animate-pop" 
                )}
                aria-label={`React with ${emoji}, current count ${reactors.length}. ${currentUserReacted ? 'You reacted.' : 'Click to react.'}`}
              >
                <span>{emoji}</span>
                <span className="font-medium">{reactors.length}</span>
              </button>
            );
          })}
        </div>
      )}
      {reactionPopover}
    </div>
  );

  return (
    <div className={cn('flex flex-col group', alignmentClass)}>
      <div className={cn(
          'flex max-w-xs md:max-w-md lg:max-w-lg', 
          isCurrentUser 
            ? 'flex-row-reverse space-x-reverse items-end' 
            : 'flex-row items-start space-x-2'
      )}>
        <Image
          src={sender.avatar_url || "https://placehold.co/100x100.png"}
          alt={sender.display_name}
          width={32}
          height={32}
          className={cn(
            "rounded-full object-cover self-start mt-1", 
             isCurrentUser ? "self-end mb-0.5" : "" 
          )}
          data-ai-hint={sender['data-ai-hint'] || "person portrait"}
          key={sender.avatar_url || sender.id}
        />
         <div className="flex flex-col w-full">
          {!isCurrentUser && (
            <p className="text-xs font-semibold text-muted-foreground mb-0.5 ml-0.5">{sender.display_name}</p>
          )}
          {messageContentDiv}
        </div>
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className={cn('text-xs text-muted-foreground mt-1 px-2 cursor-default', isCurrentUser ? 'text-right' : 'text-left ml-10')}>
              {formattedTime}
            </p>
          </TooltipTrigger>
           {message.created_at && message.status !== 'sending' && ( // Only show full timestamp if not sending
            <TooltipContent>
                <p>{format(parseISO(message.created_at), 'PPpp')}</p>
            </TooltipContent>
           )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
