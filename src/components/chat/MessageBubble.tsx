
"use client";

import type { Message, User, SupportedEmoji } from '@/types';
import { ALL_SUPPORTED_EMOJIS } from '@/types';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlayCircle, SmilePlus, FileText, Clock, Play, Pause, Dot, AlertCircle } from 'lucide-react';
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
import { Slider } from "@/components/ui/slider";
import { useState, useEffect, useRef, memo } from 'react';
import { useToast } from '@/hooks/use-toast';

interface MessageBubbleProps {
  message: Message;
  sender: User;
  isCurrentUser: boolean;
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
  onShowReactions: (message: Message, allUsers: Record<string, User>) => void;
  allUsers: Record<string, User>;
}

function formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

const AudioPlayer = memo(({ src, initialDuration, isCurrentUser }: { src: string; initialDuration: number | null | undefined, isCurrentUser: boolean }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(initialDuration || 0);
    const [currentTime, setCurrentTime] = useState(0);
    const [hasBeenPlayed, setHasBeenPlayed] = useState(false);
    const [hasError, setHasError] = useState(false);
    const { toast } = useToast();

    const handlePlayPause = () => {
        if (!audioRef.current) return;
        
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            // Dispatch event to pause other players
            const playEvent = new CustomEvent('audio-play', { detail: { player: audioRef.current } });
            document.dispatchEvent(playEvent);
            audioRef.current.play();
            if (!hasBeenPlayed) {
                setHasBeenPlayed(true);
            }
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };
    
    const handleSeek = (value: number[]) => {
        if (audioRef.current) {
            audioRef.current.currentTime = value[0];
            setCurrentTime(value[0]);
        }
    };

    const handleError = () => {
        console.error(`AudioPlayer: Failed to load audio source: ${src}`);
        toast({
            variant: "destructive",
            title: "Playback Error",
            description: "Could not load the audio message. It may be corrupt or unavailable.",
        });
        setHasError(true);
    };


    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleGlobalPlay = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail.player !== audio) {
                audio.pause();
                setIsPlaying(false);
            }
        };
        
        document.addEventListener('audio-play', handleGlobalPlay);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', () => setIsPlaying(false));
        audio.addEventListener('error', handleError);

        return () => {
            document.removeEventListener('audio-play', handleGlobalPlay);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', () => setIsPlaying(false));
            audio.removeEventListener('error', handleError);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    const playerColorClass = isCurrentUser ? 'text-primary-foreground' : 'text-secondary-foreground';

    if (hasError) {
        return (
            <div className={cn("flex items-center gap-2 text-destructive", isCurrentUser ? "text-red-300" : "text-red-500")}>
                <AlertCircle size={18} />
                <span className="text-sm">Audio failed to load</span>
            </div>
        );
    }
    
    return (
        <div className={cn("flex items-center gap-3 w-full max-w-[250px]", playerColorClass)}>
            <audio ref={audioRef} src={src} preload="metadata" />
            <div className="relative">
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePlayPause}
                    className={cn("w-8 h-8 rounded-full flex-shrink-0", isCurrentUser ? 'hover:bg-primary-foreground/20' : 'hover:bg-secondary-foreground/20')}
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </Button>
                 {!hasBeenPlayed && (
                    <span className="absolute -top-1 -right-1 block h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" title="Unheard message"></span>
                    </span>
                 )}
            </div>
            <div className="flex-grow flex flex-col justify-center gap-1">
                 <Slider
                    value={[currentTime]}
                    max={duration || 1} // Use 1 as a fallback to prevent division by zero
                    step={0.1}
                    onValueChange={handleSeek}
                    className={cn(isCurrentUser ? '[&>span>span]:bg-primary-foreground' : '[&>span>span]:bg-secondary-foreground')}
                 />
                 <div className="text-xs opacity-80 text-right">
                     {formatDuration(currentTime)} / {formatDuration(duration)}
                 </div>
            </div>
        </div>
    );
});
AudioPlayer.displayName = "AudioPlayer";


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
    setIsPickerOpen(false);
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
  
  const hasSticker = !!message.sticker_image_url;
  const contentBubbleColor = hasSticker ? 'bg-transparent' : cn(bubbleColorClass, bubbleBorderRadius);


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

  const renderMessageContent = () => {
    if (hasSticker) {
      return (
        <Image
          src={message.sticker_image_url!}
          alt={`Sticker sent by ${sender.display_name}`}
          width={128}
          height={128}
          className="bg-transparent"
          unoptimized
        />
      );
    }
    if (message.clip_url && message.clip_type === 'audio') {
        return <AudioPlayer src={message.clip_url} initialDuration={message.duration_seconds} isCurrentUser={isCurrentUser} />;
    }
    if (message.clip_url && message.clip_type === 'video') {
      return (
        <div className="flex items-center gap-2">
          <PlayCircle size={24} className={cn(isCurrentUser ? "text-primary-foreground/80" : "text-secondary-foreground/80")} />
          <a href={message.clip_url} target="_blank" rel="noopener noreferrer" className="text-sm italic underline hover:opacity-80">
            {message.clip_placeholder_text || `View ${message.clip_type} clip`}
          </a>
        </div>
      );
    }
    if (message.image_url) {
      const imageUrl = message.image_thumbnail_url || message.image_url;
      return (
        <a href={message.image_url} target="_blank" rel="noopener noreferrer" className="block max-w-xs">
          <Image
              src={imageUrl}
              alt="Chat image"
              width={200}
              height={150}
              className="rounded-md object-cover cursor-pointer hover:opacity-80"
              data-ai-hint="chat photo"
          />
        </a>
      );
    }
    if (message.document_url) {
      return (
        <div className="flex items-center gap-2">
          <FileText size={24} className={cn(isCurrentUser ? "text-primary-foreground/80" : "text-secondary-foreground/80")} />
          <a href={message.document_url} target="_blank" rel="noopener noreferrer" className="text-sm italic underline hover:opacity-80">
            {message.document_name || 'View Document'}
          </a>
        </div>
      );
    }
    if (message.text) {
      return <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>;
    }
    return <p className="text-sm italic text-muted-foreground">Message content not available</p>;
  };

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
          <div className={cn(
            'p-3 rounded-xl shadow min-w-[80px]',
            hasSticker ? 'bg-transparent p-0 shadow-none' : cn(bubbleColorClass, bubbleBorderRadius)
            )}>
            {renderMessageContent()}
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
