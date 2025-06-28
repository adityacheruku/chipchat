
"use client";

import type { Message, User, SupportedEmoji, DeleteType } from '@/types';
import { QUICK_REACTION_EMOJIS } from '@/types';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { PlayCircle, SmilePlus, FileText, Clock, Play, Pause, AlertTriangle, RefreshCw, Check, CheckCheck, MoreHorizontal, Reply, Forward, Copy, Trash2, Heart, ImageOff, Loader2, Eye, FileEdit } from 'lucide-react';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDoubleTap } from '@/hooks/useDoubleTap';
import DeleteMessageDialog from './DeleteMessageDialog';
import { useSwipe } from '@/hooks/useSwipe';


const EMOJI_ONLY_REGEX = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/;


interface MessageBubbleProps {
  message: Message;
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
  wrapperId?: string;
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
            // Dispatch a global event to pause other players
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
        const updateDuration = () => setDuration(audio.duration);
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

    const playerColorClass = isCurrentUser ? 'text-primary-foreground' : 'text-secondary-foreground';
    
    if (hasError) return <div className={cn("flex items-center gap-2", isCurrentUser ? "text-red-300" : "text-red-500")}><AlertTriangle size={18} /><span className="text-sm">Audio error</span></div>;

    return (
        <div className={cn("flex items-center gap-3 w-full max-w-[250px]", playerColorClass)}>
            <audio ref={audioRef} src={src} preload="metadata" />
            <div className="relative">
                <Button variant="ghost" size="icon" onClick={handlePlayPause} className={cn("w-11 h-11 rounded-full", isCurrentUser ? 'hover:bg-primary-foreground/20' : 'hover:bg-secondary-foreground/20')} aria-label={isPlaying ? "Pause voice message" : "Play voice message"}>
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </Button>
                 {!hasBeenPlayed && <span className="absolute -top-1 -right-1 block h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></span>}
            </div>
            <div className="flex-grow flex flex-col justify-center gap-1">
                 <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    step={0.1}
                    onValueChange={handleSeek}
                    className={cn(isCurrentUser && "[&>div>span]:bg-primary-foreground")}
                    aria-label="Seek audio"
                 />
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

function formatFileSize(bytes?: number | null): string | null {
  if (bytes === null || bytes === undefined) return null;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


function MessageBubble({ message, sender, isCurrentUser, currentUserId, onToggleReaction, onShowReactions, onShowMedia, onShowDocumentPreview, allUsers, onRetrySend, onDelete, wrapperId }: MessageBubbleProps) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const { toast } = useToast();
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasLongPressRef = useRef(false);

  const handleReply = () => {
    toast({ title: 'Reply Coming Soon!', description: 'This feature is currently under development.' });
  }

  const { ref: swipeRef, translateX, handlers: swipeHandlers } = useSwipe({
    onSwipeLeft: () => !isCurrentUser && setIsDeleteDialogOpen(true),
    onSwipeRight: () => !isCurrentUser && handleReply(),
  });

  const handleCopy = () => {
    if (message.text) {
        navigator.clipboard.writeText(message.text);
        toast({ title: "Copied!", description: "Message text copied to clipboard." });
    }
  };

  const handleDoubleTap = useCallback(() => {
    if (message.status !== 'failed' && message.status !== 'sending' && message.mode !== 'incognito') {
      onToggleReaction(message.id, '❤️');
    }
  }, [message.id, message.status, message.mode, onToggleReaction]);
  
  const doubleTapEvents = useDoubleTap(handleDoubleTap, 300);
  
  const handlePointerDown = useCallback(() => {
    wasLongPressRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
        if(navigator.vibrate) navigator.vibrate(50);
        setIsActionMenuOpen(true);
        wasLongPressRef.current = true;
    }, 400); // 400ms threshold
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
    }
  }, []);

  const handleBubbleClick = useCallback((e: React.MouseEvent) => {
    if (wasLongPressRef.current) {
        e.preventDefault();
        return;
    }
    // Handle single tap actions
    if (message.message_subtype === 'image' && message.image_url && message.status !== 'failed') {
        onShowMedia(message.image_url, 'image');
    } else if (message.message_subtype === 'document' && message.document_url && message.status !== 'failed') {
        onShowDocumentPreview(message);
    }
  }, [message, onShowMedia, onShowDocumentPreview]);

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
  const isMediaBubble = isStickerMessage || isEmojiOnlyMessage || message.message_subtype === 'image' || message.message_subtype === 'voice_message';


  let formattedTime = "sending...";
  try {
    if (message.created_at && message.status !== 'sending' && message.status !== 'uploading') {
        formattedTime = format(parseISO(message.created_at), 'p');
    }
  } catch(e) { console.warn("Could not parse message timestamp:", message.created_at) }

  const renderMessageContent = () => {
    if (message.status === 'uploading') {
      if (message.message_subtype === 'document') {
        return (
          <div className="w-48 flex items-center gap-2 opacity-50">
            <Loader2 className="w-6 h-6 flex-shrink-0 animate-spin text-muted-foreground" />
            <span className="truncate">{message.file?.name || 'Uploading...'}</span>
          </div>
        );
      }
      if (message.message_subtype === 'image') {
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
            <Loader2 className="animate-spin h-8 w-8 text-white/90 relative z-10" />
          </div>
        );
      }
      return (
        <div className="w-48 flex items-center gap-2">
          <Loader2 className="w-6 h-6 flex-shrink-0 animate-spin text-muted-foreground opacity-50" />
          <p className="text-xs font-semibold truncate opacity-50">{message.file?.name || 'File'}</p>
        </div>
      );
    }
    
    switch (message.message_subtype) {
      case 'sticker': return message.sticker_image_url ? <Image src={message.sticker_image_url} alt="Sticker" width={128} height={128} className="bg-transparent animate-pop" unoptimized loading="lazy" /> : null;
      case 'voice_message': return message.clip_url ? <AudioPlayer src={message.clip_url} initialDuration={message.duration_seconds} isCurrentUser={isCurrentUser} /> : <p className="text-sm italic">Voice message unavailable</p>;
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
      case 'clip': return message.clip_url ? (
         <button onClick={() => onShowMedia(message.clip_url!, 'video')} className="flex items-center gap-2 group/media">
              <PlayCircle size={32} className={cn(isCurrentUser ? "text-primary-foreground/80" : "text-secondary-foreground/80", "group-hover/media:scale-110 transition-transform")} />
              <span className="text-sm italic underline hover:opacity-80">{message.clip_placeholder_text || `View ${message.clip_type} clip`}</span>
         </button>
      ) : <p className="text-sm italic">Clip unavailable</p>;
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
          <button className={cn(buttonVariants({ variant: isCurrentUser ? 'secondary' : 'outline' }), 'h-auto py-2 w-full max-w-[250px] bg-card/80')} aria-label={`Preview document: ${message.document_name}`}>
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
  };

  const showRetry = message.status === 'failed' && onRetrySend && message.message_subtype !== 'image' && message.message_subtype !== 'document';
  const reactionsDisabled = message.mode === 'incognito';
  const swipeDisabled = isCurrentUser || isMediaBubble;

  return (
    <div
      id={wrapperId}
      className={cn(
        'flex w-full group animate-in fade-in-0 slide-in-from-bottom-2',
        isCurrentUser ? 'justify-end' : 'justify-start',
        isShaking && 'animate-shake'
      )}
    >
      <div className={cn('flex flex-col max-w-[85vw] sm:max-w-md', isCurrentUser ? 'items-end' : 'items-start')}>
        <div className="relative overflow-hidden rounded-xl">
          {!swipeDisabled && (
            <>
              <div className="absolute inset-y-0 left-0 flex items-center bg-blue-500 px-4 text-white rounded-l-xl" style={{ opacity: Math.max(0, translateX / 50) }}>
                  <Reply size={20} />
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center bg-destructive px-4 text-white rounded-r-xl" style={{ opacity: Math.max(0, -translateX / 50) }}>
                  <Trash2 size={20} />
              </div>
            </>
          )}

          <div
            ref={swipeRef}
            style={{ transform: `translateX(${translateX}px)` }}
            className={!swipeDisabled ? "touch-pan-y" : ""}
            {...(!swipeDisabled ? swipeHandlers : {})}
          >
            <DropdownMenu open={isActionMenuOpen} onOpenChange={setIsActionMenuOpen}>
              <DropdownMenuTrigger asChild>
                <div
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onClick={handleBubbleClick}
                  onContextMenu={(e) => e.preventDefault()}
                  {...doubleTapEvents}
                  className={cn(
                    'relative rounded-xl shadow-md transition-transform',
                    isMediaBubble || message.message_subtype === 'document' ? 'p-0 bg-transparent shadow-none' : cn(bubbleColorClass, 'p-3'),
                    !isMediaBubble && message.message_subtype !== 'document' && `after:content-[''] after:absolute after:bottom-0 after:w-0 after:h-0 after:border-[10px] after:border-solid after:border-transparent`,
                    !isMediaBubble && message.message_subtype !== 'document' && (isCurrentUser ? 'after:right-[-8px] after:border-l-primary' : 'after:left-[-8px] after:border-r-secondary'),
                    message.mode === 'fight' && !isMediaBubble && 'border-2 border-destructive/80'
                  )}
                >
                    {renderMessageContent()}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isCurrentUser ? 'end' : 'start'}>
                  {message.message_subtype === 'document' && message.document_url ? (
                    <>
                        <DropdownMenuItem onSelect={() => onShowDocumentPreview(message)}>
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Preview</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => {
                            navigator.clipboard.writeText(message.document_url!);
                            toast({ title: "Link Copied" });
                        }}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Copy Link</span>
                        </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger disabled={reactionsDisabled}>
                            <SmilePlus className="mr-2 h-4 w-4" />
                            <span>React</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <div className="flex p-1">
                                {QUICK_REACTION_EMOJIS.map((emoji) => (
                                  <DropdownMenuItem
                                    key={emoji}
                                    className="flex-1 justify-center rounded-md p-0 focus:bg-accent/50"
                                    onSelect={() => onToggleReaction(message.id, emoji)}
                                  >
                                    <span className="text-xl p-1.5">{emoji}</span>
                                  </DropdownMenuItem>
                                ))}
                              </div>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuItem onSelect={handleCopy} disabled={!message.text}><Copy className="mr-2 h-4 w-4" /> Copy</DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onSelect={handleReply} disabled><Reply className="mr-2 h-4 w-4" /> Reply</DropdownMenuItem>
                  <DropdownMenuItem disabled><Forward className="mr-2 h-4 w-4" /> Forward</DropdownMenuItem>
                  {message.message_subtype === 'document' && (
                    <DropdownMenuItem onSelect={() => {}} disabled>
                        <FileEdit className="mr-2 h-4 w-4" />
                        <span>Rename</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

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
        <DeleteMessageDialog 
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          isCurrentUser={isCurrentUser}
        />
      </div>
    </div>
  );
}

export default memo(MessageBubble);
