
"use client";

import type { Message, User, SupportedEmoji, DeleteType } from '@/types';
import { QUICK_REACTION_EMOJIS } from '@/types';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { PlayCircle, SmilePlus, FileText, Clock, Play, Pause, AlertTriangle, RefreshCw, Check, CheckCheck, MoreHorizontal, Reply, Forward, Copy, Trash2, Heart, ImageOff, Eye, FileEdit, Mic, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDoubleTap } from '@/hooks/useDoubleTap';
import DeleteMessageDialog from './DeleteMessageDialog';
import { useSwipe } from '@/hooks/useSwipe';
import { useLongPress } from '@/hooks/useLongPress';
import Spinner from '../common/Spinner';

const EMOJI_ONLY_REGEX = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/;

interface MessageBubbleProps {
  message: Message;
  messages: Message[];
  sender: User;
  isCurrentUser: boolean;
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
  onShowReactions: (message: Message, allUsers: Record<string, User>) => void;
  onShowMedia: (url: string, type: 'image' | 'video') => void;
  onShowDocumentPreview: (message: Message) => void;
  allUsers: Record<string, User>;
  onRetrySend: (message: Message) => void;
  onDelete: (messageId: string, deleteType: DeleteType) => void;
  onSetReplyingTo: (message: Message | null) => void;
  wrapperId?: string;
  isSelectionMode: boolean;
  isSelected: boolean;
  onEnterSelectionMode: (messageId: string) => void;
  onToggleSelection: (messageId: string) => void;
}

function formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

const AudioPlayer = memo(({ message, sender, isCurrentUser }: { message: Message; sender: User; isCurrentUser: boolean; }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(message.duration_seconds || 0);
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
            audioRef.current.play().catch(e => {
                console.error("Audio play failed:", e);
                setHasError(true);
                toast({ variant: 'destructive', title: 'Playback Error' });
            });
            if (!hasBeenPlayed) {
                setHasBeenPlayed(true);
            }
        }
        setIsPlaying(!isPlaying);
    };
    
    const handleSeek = (value: number[]) => {
      if (audioRef.current) {
        audioRef.current.currentTime = value[0];
        setCurrentTime(value[0]);
      }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleGlobalPlay = (event: Event) => {
            if ((event as CustomEvent).detail.player !== audio) {
                audio.pause();
                setIsPlaying(false);
            }
        };

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => {
            if (!isNaN(audio.duration) && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        }
        const handleEnd = () => setIsPlaying(false);
        const handleError = () => { setHasError(true); toast({ variant: "destructive", title: "Playback Error" }); };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnd);
        audio.addEventListener('error', handleError);
        document.addEventListener('audio-play', handleGlobalPlay);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnd);
            audio.removeEventListener('error', handleError);
            document.removeEventListener('audio-play', handleGlobalPlay);
        };
    }, [toast]);
    
    let formattedTime = "sending...";
    try {
        if (message.created_at && message.status !== 'sending' && message.status !== 'uploading') {
            formattedTime = format(parseISO(message.created_at), 'p');
        }
    } catch(e) { console.warn("Could not parse message timestamp:", message.created_at) }

    const playerColorClass = isCurrentUser ? 'text-primary-foreground' : 'text-secondary-foreground';
    const sliderThumbClass = isCurrentUser ? '[&>span]:bg-primary-foreground' : '[&>span]:bg-primary';
    const sliderTrackClass = isCurrentUser ? 'bg-primary-foreground/30' : 'bg-secondary-foreground/30';
    const sliderRangeClass = isCurrentUser ? 'bg-primary-foreground' : 'bg-secondary-foreground';
    const micIndicatorBg = isCurrentUser ? 'bg-background' : 'bg-green-500';
    const micIndicatorIcon = isCurrentUser ? 'text-primary' : 'text-white';
    
    if (hasError) return <div className={cn("flex items-center gap-2 p-2", isCurrentUser ? "text-red-300" : "text-red-500")}><AlertTriangle size={18} /><span className="text-sm">Audio error</span></div>;

    return (
        <div className={cn("flex items-center gap-2 p-2 w-full max-w-[250px] sm:max-w-xs", playerColorClass)}>
            <audio ref={audioRef} src={message.clip_url!} preload="metadata" />
            <div className="relative flex-shrink-0">
                <Avatar className="w-10 h-10">
                    <AvatarImage src={sender.avatar_url || undefined} alt={sender.display_name} />
                    <AvatarFallback>{sender.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                {!hasBeenPlayed && !isCurrentUser && (
                  <div className={cn("absolute bottom-[-2px] right-[-2px] w-4 h-4 rounded-full flex items-center justify-center border-2", isCurrentUser ? "border-primary" : "border-secondary", micIndicatorBg)}>
                    <Mic size={10} className={micIndicatorIcon} />
                  </div>
                )}
            </div>

            <Button variant="ghost" size="icon" onClick={handlePlayPause} className={cn("w-10 h-10 rounded-full flex-shrink-0", isCurrentUser ? 'hover:bg-white/20' : 'hover:bg-black/10')} aria-label={isPlaying ? "Pause voice message" : "Play voice message"}>
                {isPlaying ? <Pause size={20} className={playerColorClass} /> : <Play size={20} className={cn("ml-0.5", playerColorClass)} />}
            </Button>
            
            <div className="flex-grow flex flex-col justify-center gap-1.5 w-full">
                 <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="w-full h-1"
                    classNames={{
                      track: cn('h-1', sliderTrackClass),
                      range: cn('h-1', sliderRangeClass),
                      thumb: cn('h-3 w-3', sliderThumbClass)
                    }}
                    aria-label="Seek audio"
                 />
                 <span className="text-xs opacity-70">{formatDuration(duration)}</span>
            </div>

            <div className="self-end text-xs opacity-70 whitespace-nowrap pl-2 flex items-center">
                <span>{formattedTime}</span>
                {isCurrentUser && <MessageStatusIndicator status={message.status} />}
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

function formatFileSize(bytes?: number | null): string | null {
  if (bytes === null || bytes === undefined) return null;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


function MessageBubble({ message, messages, sender, isCurrentUser, currentUserId, onToggleReaction, onShowReactions, onShowMedia, onShowDocumentPreview, allUsers, onRetrySend, onDelete, onSetReplyingTo, wrapperId, isSelectionMode, isSelected, onEnterSelectionMode, onToggleSelection }: MessageBubbleProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const { toast } = useToast();

  const swipeHandlers = useSwipe({
    onSwipeRight: () => {
      if (isSelectionMode) return;
      isCurrentUser ? setIsDeleteDialogOpen(true) : onSetReplyingTo(message);
    },
    onSwipeLeft: () => {
      if (isSelectionMode) return;
      isCurrentUser ? onSetReplyingTo(message) : setIsDeleteDialogOpen(true);
    },
  });
  
  const longPressHandlers = useLongPress(() => {
    if (navigator.vibrate) navigator.vibrate(50);
    if (!isSelectionMode) onEnterSelectionMode(message.id);
  });

  const handleCopy = () => {
    if (message.text) {
        navigator.clipboard.writeText(message.text);
        toast({ title: "Copied!", description: "Message text copied to clipboard." });
    }
  };

  const handleDoubleTap = useCallback(() => {
    if (message.status !== 'failed' && message.status !== 'sending' && message.mode !== 'incognito' && !isSelectionMode) {
      onToggleReaction(message.id, '❤️');
    }
  }, [message.id, message.status, message.mode, onToggleReaction, isSelectionMode]);
  
  const doubleTapEvents = useDoubleTap(handleDoubleTap);
  
  const handleBubbleClick = (e: React.MouseEvent) => {
    if (swipeHandlers.isSwiping()) {
      e.preventDefault();
      return;
    }
    if (longPressHandlers.isLongPressing()) {
      e.preventDefault();
      return;
    }
    if (isSelectionMode) {
      onToggleSelection(message.id);
      return;
    }
    if (message.message_subtype === 'image' && message.image_url && message.status !== 'failed') {
        onShowMedia(message.image_url, 'image');
    } else if (message.message_subtype === 'clip' && message.clip_type === 'video' && message.clip_url && message.status !== 'failed') {
        onShowMedia(message.clip_url, 'video');
    } else if (message.message_subtype === 'document' && message.document_url && message.status !== 'failed') {
        onShowDocumentPreview(message);
    }
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
  
  const handleConfirmDelete = (deleteType: DeleteType) => {
    onDelete(message.id, deleteType);
    setIsDeleteDialogOpen(false);
  }
  
  const handleRetry = (message: Message) => {
      setIsShaking(true);
      onRetrySend(message);
      setTimeout(() => setIsShaking(false), 600); // Animation duration
  };

  const bubbleColorClass = isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground';
  
  const isStickerMessage = message.message_subtype === 'sticker';
  const isEmojiOnlyMessage = message.message_subtype === 'text' && message.text && EMOJI_ONLY_REGEX.test(message.text.trim()) && message.text.trim().length <= 5;
  const isMediaBubble = isStickerMessage || isEmojiOnlyMessage || message.message_subtype === 'image' || message.message_subtype === 'voice_message' || (message.message_subtype === 'clip' && message.clip_type === 'video');


  let formattedTime = "sending...";
  try {
    if (message.created_at && message.status !== 'sending' && message.status !== 'uploading') {
        formattedTime = format(parseISO(message.created_at), 'p');
    }
  } catch(e) { console.warn("Could not parse message timestamp:", message.created_at) }

  if (message.message_subtype === 'history_cleared_marker') {
      return null;
  }
  
  const repliedToMessage = message.reply_to_message_id ? messages.find(m => m.id === message.reply_to_message_id) : null;
  const repliedToSender = repliedToMessage ? allUsers[repliedToMessage.user_id] : null;

  const renderMessageContent = () => {
    if (message.status === 'uploading') {
      if (message.message_subtype === 'document') {
        return (
          <div className="w-48 flex items-center gap-2 opacity-50">
            <Spinner />
            <span className="truncate">{message.file?.name || 'Uploading...'}</span>
          </div>
        );
      }
      if (message.message_subtype === 'image' || message.message_subtype === 'clip') {
        return (
          <div className="w-[120px] h-[120px] rounded-md overflow-hidden bg-muted relative flex items-center justify-center animate-pulse">
            {message.image_url && (
              <Image
                src={message.image_url} // This is the local blob URL
                alt="Uploading preview"
                fill
                className="object-cover"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-black/20" />
            <Spinner />
          </div>
        );
      }
      return (
        <div className="w-48 flex items-center gap-2">
          <Spinner />
          <p className="text-xs font-semibold truncate opacity-50">{message.file?.name || 'File'}</p>
        </div>
      );
    }
    
    const content = (() => {
        switch (message.message_subtype) {
          case 'sticker': return message.sticker_image_url ? <Image src={message.sticker_image_url} alt="Sticker" width={128} height={128} className="bg-transparent animate-pop" unoptimized loading="lazy" /> : null;
          case 'voice_message': return message.clip_url ? <AudioPlayer message={message} sender={sender} isCurrentUser={isCurrentUser} /> : <p className="text-sm italic">Voice message unavailable</p>;
          case 'image':
            if (message.status === 'failed') {
              return (
                 <div className="w-[120px] h-[120px] rounded-md border-2 border-dashed border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center p-2 text-center text-destructive">
                    <ImageOff size={28} className="mb-2" />
                    <p className="text-xs font-semibold mb-2">Upload Failed</p>
                    <Button variant="destructive" size="sm" onClick={() => handleRetry(message)} className="h-auto px-2 py-1 text-xs">
                      <RefreshCw size={12} className="mr-1" />
                      Retry
                    </Button>
                  </div>
              );
            }
            return message.image_url ? (
              <button onClick={() => onShowMedia(message.image_url!, 'image')} className="block w-[120px] h-[120px] relative group/media rounded-md overflow-hidden bg-muted transition-transform active:scale-95 md:hover:scale-105 shadow-md md:hover:shadow-lg" aria-label={`View image sent at ${formattedTime}`}>
                  <Image src={message.image_thumbnail_url || message.image_url} alt={`Image from ${sender.display_name}`} layout="fill" className="object-cover" data-ai-hint="chat photo" loading="lazy"/>
              </button>
            ) : <p className="text-sm italic">Image unavailable</p>;
          case 'clip':
            if (message.clip_type === 'video') {
                return message.clip_url ? (
                  <button onClick={() => onShowMedia(message.clip_url!, 'video')} className="block w-full max-w-[250px] aspect-video relative group/media rounded-md overflow-hidden bg-muted transition-transform active:scale-95 md:hover:scale-105 shadow-md md:hover:shadow-lg" aria-label={`View video sent at ${formattedTime}`}>
                      <Image src={message.image_thumbnail_url || "https://placehold.co/250x140.png"} alt={`Video thumbnail from ${sender.display_name}`} layout="fill" className="object-cover" data-ai-hint="video thumbnail" loading="lazy"/>
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <PlayCircle size={48} className="text-white/80 transition-transform group-hover/media:scale-110" />
                      </div>
                  </button>
                ) : <p className="text-sm italic">Video unavailable</p>;
            }
            return <p className="text-sm italic">Clip unavailable</p>;
          case 'document':
            if (message.status === 'failed') {
              return (
                <button className={cn(buttonVariants({ variant: 'outline' }), 'h-auto py-2 w-full max-w-[250px] bg-destructive/20 text-destructive border-destructive/50 hover:bg-destructive/30')} onClick={() => handleRetry(message)}>
                  <AlertTriangle size={24} className="mr-3 flex-shrink-0" />
                  <div className="flex flex-col text-left min-w-0">
                      <span className="font-medium text-sm">Upload Failed</span>
                      <span className="text-xs">Click to retry</span>
                  </div>
                </button>
              );
            }
            return message.document_url ? (
              <button onClick={() => onShowDocumentPreview(message)} className={cn(buttonVariants({ variant: isCurrentUser ? 'secondary' : 'outline' }), 'h-auto py-2 w-full max-w-[250px] bg-card/80')} aria-label={`Preview document: ${message.document_name}`}>
                <FileText size={24} className="mr-3 flex-shrink-0 text-foreground/80" />
                <div className="flex flex-col text-left min-w-0">
                    <span className="font-medium text-sm line-clamp-2 text-foreground">{message.document_name || 'Document'}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(message.file_size_bytes) || 'Click to preview'}</span>
                </div>
            </button>
          ) : (
              <div className="flex items-center p-3 text-destructive">
                <AlertTriangle className="w-6 h-6 mr-2" />
                <span className="text-sm">Cannot load document</span>
              </div>
          );
          case 'text':
          case 'emoji_only':
          default: return message.text ? <p className={cn("text-sm whitespace-pre-wrap break-words", isEmojiOnlyMessage && "text-5xl")}>{message.text}</p> : <p className="text-sm italic">Message unavailable</p>;
        }
    })();
    
    return (
      <div className="space-y-1">
        {repliedToMessage && repliedToSender && (
            <div className={cn("p-2 rounded-md mb-0 bg-black/10 dark:bg-white/10 border-l-2 border-accent", isCurrentUser ? "bg-primary-foreground/20" : "bg-secondary-foreground/10")}>
                <p className="font-bold text-accent text-sm">{repliedToSender.display_name}</p>
                <p className={cn("text-sm opacity-90 truncate", isCurrentUser ? "text-primary-foreground/90" : "text-secondary-foreground/90")}>{repliedToMessage.text || 'Attachment'}</p>
            </div>
        )}
        {content}
      </div>
    );
  };

  const showRetry = message.status === 'failed' && onRetrySend && message.message_subtype !== 'image' && message.message_subtype !== 'document';
  const reactionsDisabled = message.mode === 'incognito' || isSelectionMode;
  const swipeDisabled = isMediaBubble || isSelectionMode;
  const isVoiceMessage = message.message_subtype === 'voice_message';

  const RightSwipeIcon = isCurrentUser ? Trash2 : Reply;
  const LeftSwipeIcon = isCurrentUser ? Reply : Trash2;
  const rightSwipeBg = isCurrentUser ? 'bg-destructive' : 'bg-blue-500';
  const leftSwipeBg = isCurrentUser ? 'bg-blue-500' : 'bg-destructive';

  return (
    <div
      id={wrapperId}
      className={cn(
        'flex w-full group animate-in fade-in-0 slide-in-from-bottom-2',
        isCurrentUser ? 'justify-end' : 'justify-start',
        isShaking && 'animate-shake'
      )}
    >
      <div className={cn('flex items-center gap-2 max-w-[85vw] sm:max-w-md', isCurrentUser ? 'flex-row-reverse' : 'flex-row')}>
        {isSelectionMode && (
          <div className="flex items-center justify-center flex-shrink-0">
              <button onClick={() => onToggleSelection(message.id)} className="h-full px-2" aria-label={`Select message from ${sender.display_name}`}>
                  <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", isSelected ? "bg-primary border-primary" : "border-muted-foreground")}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
              </button>
          </div>
        )}
        <div className={cn('flex flex-col', isCurrentUser ? 'items-end' : 'items-start')}>
          <div
            className="relative overflow-hidden rounded-xl"
            {...(!swipeDisabled ? swipeHandlers.events : {})}
          >
            {!swipeDisabled && (
              <>
                <div className={cn("absolute inset-y-0 left-0 flex items-center px-4 text-white rounded-l-xl transition-opacity", rightSwipeBg)} style={{ opacity: Math.max(0, swipeHandlers.translateX / 60) }}>
                    <RightSwipeIcon size={20} />
                </div>
                <div className={cn("absolute inset-y-0 right-0 flex items-center px-4 text-white rounded-r-xl transition-opacity", leftSwipeBg)} style={{ opacity: Math.max(0, -swipeHandlers.translateX / 60) }}>
                    <LeftSwipeIcon size={20} />
                </div>
              </>
            )}

            <div
              style={{ transform: `translateX(${swipeHandlers.translateX}px)` }}
              className={cn("transition-transform duration-200 ease-out", !swipeDisabled ? "touch-pan-y" : "")}
            >
              <DropdownMenu open={isActionMenuOpen} onOpenChange={setIsActionMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <div
                    {...longPressHandlers}
                    {...doubleTapEvents}
                    onClickCapture={handleBubbleClick}
                    onContextMenu={(e) => { if (!isSelectionMode) e.preventDefault(); }}
                    className={cn(
                      'relative rounded-xl shadow-md transition-all active:scale-95',
                      isMediaBubble || message.message_subtype === 'document' ? 'p-0 bg-transparent shadow-none' : cn(bubbleColorClass, 'p-3'),
                      isVoiceMessage && cn(bubbleColorClass, 'p-0'),
                      !isMediaBubble && message.message_subtype !== 'document' && !repliedToMessage && `after:content-[''] after:absolute after:bottom-0 after:w-0 after:h-0 after:border-[10px] after:border-solid after:border-transparent`,
                      !isMediaBubble && message.message_subtype !== 'document' && !repliedToMessage && (isCurrentUser ? 'after:right-[-8px] after:border-l-primary' : 'after:left-[-8px] after:border-r-secondary'),
                      message.mode === 'fight' && !isMediaBubble && 'border-2 border-destructive/80',
                      (message.mode === 'incognito' && message.status !== 'sending') && 'border-2 border-dashed border-muted-foreground/50'
                    )}
                  >
                    {renderMessageContent()}
                    {message.mode === 'incognito' && <Eye className="absolute top-1 right-1 h-3 w-3 text-muted-foreground/80" />}
                    {isSelected && <div className="absolute inset-0 bg-primary/20 rounded-xl border-2 border-primary pointer-events-none" />}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isCurrentUser ? 'end' : 'start'}>
                    <div className="flex justify-around p-1">
                      {QUICK_REACTION_EMOJIS.map((emoji) => (
                        <DropdownMenuItem
                          key={emoji}
                          className="flex-1 justify-center p-0 focus:bg-accent/50 rounded-md"
                          onSelect={() => onToggleReaction(message.id, emoji)}
                        >
                          <span className="text-xl p-1.5">{emoji}</span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onSetReplyingTo(message)}><Reply className="mr-2 h-4 w-4" /> Reply</DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleCopy} disabled={!message.text}><Copy className="mr-2 h-4 w-4" /> Copy</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {!isVoiceMessage && (
              <div className={cn('pt-1', isCurrentUser ? 'pr-2' : 'pl-2')}>
              {!reactionsDisabled && message.reactions && Object.keys(message.reactions).length > 0 && (
                  <div className={cn("flex flex-wrap gap-1 mt-1", isCurrentUser ? "justify-end" : "justify-start")}>
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

              <div className={cn('text-xs text-muted-foreground mt-0.5 cursor-default flex items-center', isCurrentUser ? 'justify-end' : 'justify-start')}>
                  {showRetry && (
                      <div className="text-destructive flex items-center mr-2">
                          <span>Failed to send.</span>
                          <Button variant="link" size="sm" onClick={() => handleRetry(message)} className="h-auto p-1 text-destructive hover:underline">
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Retry
                          </Button>
                      </div>
                  )}
                  <span>{formattedTime}</span>
                  {isCurrentUser && <MessageStatusIndicator status={message.status} />}
              </div>
              </div>
          )}
          <DeleteMessageDialog 
            isOpen={isDeleteDialogOpen}
            onClose={() => setIsDeleteDialogOpen(false)}
            onConfirm={handleConfirmDelete}
            isCurrentUser={isCurrentUser}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
