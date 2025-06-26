
"use client";

import type { Message, User, SupportedEmoji } from '@/types';
import { ALL_SUPPORTED_EMOJIS } from '@/types';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { PlayCircle, SmilePlus, FileText, Clock, Play, Pause, Dot, AlertTriangle, RefreshCw, Check, CheckCheck, MoreHorizontal, Reply, Forward, Copy, Trash2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect, useRef, memo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLongPress } from '@/hooks/useLongPress';
import UploadProgressIndicator from './UploadProgressIndicator';


const EMOJI_ONLY_REGEX = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/;


interface MessageBubbleProps {
  message: Message;
  sender: User;
  isCurrentUser: boolean;
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
  onShowReactions: (message: Message, allUsers: Record<string, User>) => void;
  onShowMedia: (url: string, type: 'image' | 'video') => void;
  allUsers: Record<string, User>;
  onRetrySend?: (message: Message) => void;
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
            const playEvent = new CustomEvent('audio-play', { detail: { player: audioRef.current } });
            document.dispatchEvent(playEvent);
            audioRef.current.play();
            if (!hasBeenPlayed) {
                setHasBeenPlayed(true);
            }
        }
        setIsPlaying(!isPlaying);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const handleGlobalPlay = (event: Event) => {
            if ((event as CustomEvent).detail.player !== audio) { audio.pause(); setIsPlaying(false); }
        };
        audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
        audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
        audio.addEventListener('ended', () => setIsPlaying(false));
        audio.addEventListener('error', () => { setHasError(true); toast({ variant: "destructive", title: "Playback Error" }); });
        document.addEventListener('audio-play', handleGlobalPlay);
        return () => {
            document.removeEventListener('audio-play', handleGlobalPlay);
        };
    }, [toast]);

    const playerColorClass = isCurrentUser ? 'text-primary-foreground' : 'text-secondary-foreground';
    
    if (hasError) return <div className={cn("flex items-center gap-2", isCurrentUser ? "text-red-300" : "text-red-500")}><AlertTriangle size={18} /><span className="text-sm">Audio error</span></div>;

    const SimulatedWaveform = () => (
        <div className="flex items-center h-8 w-full">
            {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className={cn("w-0.5 rounded-full", playerColorClass)} style={{ height: `${Math.sin(i / 30 * Math.PI * 2 + currentTime) * 40 + 60}%`, backgroundColor: isPlaying && currentTime > (i / 30) * duration ? 'currentColor' : 'hsla(var(--muted-foreground), 0.5)' }}/>
            ))}
        </div>
    );

    return (
        <div className={cn("flex items-center gap-3 w-full max-w-[250px]", playerColorClass)}>
            <audio ref={audioRef} src={src} preload="metadata" />
            <div className="relative">
                <Button variant="ghost" size="icon" onClick={handlePlayPause} className={cn("w-11 h-11 rounded-full", isCurrentUser ? 'hover:bg-primary-foreground/20' : 'hover:bg-secondary-foreground/20')}>
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </Button>
                 {!hasBeenPlayed && <span className="absolute -top-1 -right-1 block h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
            </div>
            <div className="flex-grow flex flex-col justify-center gap-1">
                 <SimulatedWaveform />
                 <div className="text-xs opacity-80 text-right">
                     {formatDuration(isPlaying ? currentTime : duration)}
                 </div>
            </div>
        </div>
    );
});
AudioPlayer.displayName = "AudioPlayer";

const MessageStatusIndicator = ({ status }: { status: Message['status'] }) => {
    switch (status) {
        case 'sending': return <Clock size={12} className="inline-block ml-1" />;
        case 'sent': return <Check size={14} className="inline-block ml-1" />;
        case 'delivered': return <CheckCheck size={14} className="inline-block ml-1" />;
        case 'read': return <CheckCheck size={14} className="inline-block ml-1 text-blue-500" />;
        case 'failed': return <AlertTriangle size={12} className="inline-block ml-1 text-destructive" />;
        default: return null;
    }
};

function MessageBubble({ message, sender, isCurrentUser, currentUserId, onToggleReaction, onShowReactions, onShowMedia, allUsers, onRetrySend }: MessageBubbleProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const handleCopy = () => {
    if (message.text) {
        navigator.clipboard.writeText(message.text);
        toast({ title: "Copied!", description: "Message text copied to clipboard." });
    }
  };

  const { toast } = useToast();
  
  const longPressEvents = useLongPress(() => {
    if(navigator.vibrate) navigator.vibrate(50);
    setIsActionMenuOpen(true);
  }, { threshold: 300 });

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

  const bubbleColorClass = isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground';
  const bubbleAlignment = isCurrentUser ? 'self-end' : 'self-start';
  const tailPosition = isCurrentUser ? 'after:right-[-8px]' : 'after:left-[-8px]';
  const tailColor = isCurrentUser ? 'after:border-l-primary' : 'after:border-r-secondary';
  
  const isStickerMessage = message.message_subtype === 'sticker';
  const isEmojiOnlyMessage = message.message_subtype === 'text' && message.text && EMOJI_ONLY_REGEX.test(message.text.trim()) && message.text.trim().length <= 5;
  const isMediaBubble = isStickerMessage || isEmojiOnlyMessage || message.message_subtype === 'image' || message.message_subtype === 'voice_message' || message.status === 'uploading';


  let formattedTime = "sending...";
  try {
    if (message.created_at && message.status !== 'sending' && message.status !== 'uploading') {
        formattedTime = format(parseISO(message.created_at), 'p');
    }
  } catch(e) { console.warn("Could not parse message timestamp:", message.created_at) }

  const renderMessageContent = () => {
    if (message.status === 'uploading') return <UploadProgressIndicator fileName={message.file?.name || 'File'} progress={message.uploadProgress || 0} previewUrl={message.image_url || message.clip_url} fileType={message.file?.type || ''} />;
    
    switch (message.message_subtype) {
      case 'sticker': return message.sticker_image_url ? <Image src={message.sticker_image_url} alt="Sticker" width={128} height={128} className="bg-transparent animate-pop" unoptimized /> : null;
      case 'voice_message': return message.clip_url ? <AudioPlayer src={message.clip_url} initialDuration={message.duration_seconds} isCurrentUser={isCurrentUser} /> : <p className="text-sm italic">Voice message unavailable</p>;
      case 'image': return message.image_url ? (
        <button onClick={() => onShowMedia(message.image_url!, 'image')} className="block max-w-xs relative group/media">
            <Image src={message.image_thumbnail_url || message.image_url} alt="Chat image" width={200} height={150} className="rounded-md object-cover" data-ai-hint="chat photo"/>
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                <PlayCircle size={40} className="text-white"/>
            </div>
        </button>
      ) : <p className="text-sm italic">Image unavailable</p>;
      case 'clip': return message.clip_url ? (
         <button onClick={() => onShowMedia(message.clip_url!, 'video')} className="flex items-center gap-2 group/media">
              <PlayCircle size={32} className={cn(isCurrentUser ? "text-primary-foreground/80" : "text-secondary-foreground/80", "group-hover/media:scale-110 transition-transform")} />
              <span className="text-sm italic underline hover:opacity-80">{message.clip_placeholder_text || `View ${message.clip_type} clip`}</span>
         </button>
      ) : <p className="text-sm italic">Clip unavailable</p>;
      case 'document': return message.document_url ? (
        <a href={message.document_url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: isCurrentUser ? 'secondary' : 'outline' }), 'h-auto py-2')}>
            <FileText size={24} className="mr-2" />
            <div className="flex flex-col text-left">
                <span className="font-semibold">{message.document_name || 'Document'}</span>
                <span className="text-xs">Click to open</span>
            </div>
        </a>
      ) : <p className="text-sm italic">Document unavailable</p>;
      case 'text':
      case 'emoji_only':
      default: return message.text ? <p className={cn("text-sm whitespace-pre-wrap break-words", isEmojiOnlyMessage && "text-5xl")}>{message.text}</p> : <p className="text-sm italic">Message unavailable</p>;
    }
  };

  const showRetry = message.status === 'failed' && onRetrySend;
  const reactionsDisabled = message.mode === 'incognito';

  return (
    <div className={cn(
        'flex flex-col group transition-opacity duration-500', 
        bubbleAlignment, 
        isCurrentUser ? 'pl-10' : 'pr-10',
        message.mode === 'incognito' && 'opacity-70'
    )}>
      <DropdownMenu open={isActionMenuOpen} onOpenChange={setIsActionMenuOpen}>
        <DropdownMenuTrigger asChild>
           <div {...longPressEvents} className={cn(
              'relative rounded-xl shadow-md max-w-md transition-all',
              isMediaBubble ? 'p-0 bg-transparent shadow-none' : cn(bubbleColorClass, 'p-3'),
              !isMediaBubble && `after:content-[''] after:absolute after:bottom-0 after:w-0 after:h-0 after:border-[10px] after:border-solid after:border-transparent`,
              !isMediaBubble && tailPosition,
              !isMediaBubble && tailColor,
              message.mode === 'fight' && !isMediaBubble && 'border-2 border-destructive/80'
            )}>
              {renderMessageContent()}
            </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isCurrentUser ? 'end' : 'start'}>
            <DropdownMenuItem onSelect={() => onToggleReaction(message.id, '❤️')} disabled={reactionsDisabled}><SmilePlus className="mr-2 h-4 w-4" /> React</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleCopy()} disabled={!message.text}><Copy className="mr-2 h-4 w-4" /> Copy</DropdownMenuItem>
            <DropdownMenuItem disabled><Reply className="mr-2 h-4 w-4" /> Reply</DropdownMenuItem>
            <DropdownMenuItem disabled><Forward className="mr-2 h-4 w-4" /> Forward</DropdownMenuItem>
            <DropdownMenuItem disabled className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className={cn('pt-1', isCurrentUser ? 'pr-2' : 'pl-2')}>
        {!reactionsDisabled && message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className={cn("flex flex-wrap gap-1", isCurrentUser ? "justify-end" : "justify-start")}>
            {(Object.keys(message.reactions) as SupportedEmoji[]).map(emoji => {
                const reactors = message.reactions?.[emoji];
                if (!reactors || reactors.length === 0) return null;
                const currentUserReacted = reactors.includes(currentUserId);
                return (
                <TooltipProvider key={emoji} delayDuration={100}>
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <button onClick={() => onShowReactions(message, allUsers)} className={cn("text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-all", currentUserReacted ? "bg-accent text-accent-foreground border-accent/80" : "bg-card/50 border-border hover:bg-muted")}>
                        <span>{emoji}</span>
                        <span className="font-medium">{reactors.length}</span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent><p>{getReactorNames(reactors)}</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                );
            })}
            </div>
        )}

        <p className={cn('text-xs text-muted-foreground mt-0.5 cursor-default flex items-center', isCurrentUser ? 'justify-end' : 'justify-start')}>
            {formattedTime}
            {isCurrentUser && <MessageStatusIndicator status={message.status} />}
        </p>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
