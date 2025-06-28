
// ⚡️ Wrapped with React.memo to avoid re-renders when props don’t change
import { memo } from 'react';
import type { User } from '@/types';
import MoodIndicator from './MoodIndicator';
import { Button, buttonVariants } from '@/components/ui/button';
import { UserCircle2, Heart, Phone, X, Copy, Share2, Trash2, MoreHorizontal } from 'lucide-react';
import Image from 'next/image';
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
import { cn } from '@/lib/utils';
import { differenceInDays, formatDistanceToNowStrict, parseISO } from 'date-fns';

interface ChatHeaderProps {
  currentUser: User;
  otherUser: User | null; 
  onProfileClick: () => void;
  onSendThinkingOfYou: () => void;
  isTargetUserBeingThoughtOf: boolean;
  onOtherUserAvatarClick: () => void;
  isOtherUserTyping?: boolean;
  isSelectionMode: boolean;
  selectedMessageCount: number;
  onExitSelectionMode: () => void;
  onCopySelected: () => void;
  onDeleteSelected: () => void;
  onShareSelected: () => void;
  onClearChat: () => void;
}

const SelectionActionBar = ({
  count,
  onClose,
  onCopy,
  onDelete,
  onShare
}: {
  count: number;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onShare: () => void;
}) => (
    <div className="w-full flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="h-5 w-5" />
          <span className="sr-only">Cancel selection</span>
        </Button>
        <span className="font-semibold text-lg">{count}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onCopy} className="rounded-full" aria-label="Copy selected messages">
          <Copy className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onShare} className="rounded-full" aria-label="Share selected messages">
          <Share2 className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} className="rounded-full hover:bg-destructive/10 hover:text-destructive" aria-label="Delete selected messages">
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
);


function ChatHeader({ 
  currentUser, 
  otherUser, 
  onProfileClick, 
  onSendThinkingOfYou, 
  isTargetUserBeingThoughtOf,
  onOtherUserAvatarClick,
  isOtherUserTyping,
  isSelectionMode,
  selectedMessageCount,
  onExitSelectionMode,
  onCopySelected,
  onDeleteSelected,
  onShareSelected,
  onClearChat,
}: ChatHeaderProps) {
    
  let presenceStatusText = otherUser ? `${otherUser.display_name} is offline.` : "";
  let formattedLastSeen = otherUser ? "Last seen: N/A" : "";
  let srPresenceText = otherUser ? `${otherUser.display_name} is offline. Last seen information not available.` : "No other user connected.";

  if (otherUser) {
    if (otherUser.is_online) {
      presenceStatusText = `${otherUser.display_name} is online.`;
      formattedLastSeen = "Currently online";
      srPresenceText = `${otherUser.display_name} is online.`;
    } else if (otherUser.last_seen) {
      try {
          const lastSeenDate = parseISO(otherUser.last_seen);
          if (differenceInDays(new Date(), lastSeenDate) > 7) {
          formattedLastSeen = "Last seen a while ago";
          } else {
          formattedLastSeen = `Last seen: ${formatDistanceToNowStrict(lastSeenDate, { addSuffix: true })}`;
          }
          presenceStatusText = `${otherUser.display_name} is offline. ${formattedLastSeen}`;
          srPresenceText = `${otherUser.display_name} is offline. ${formattedLastSeen}`;
      } catch (e) {
          console.warn("Could not parse last_seen date for otherUser", otherUser.last_seen);
          formattedLastSeen = "Last seen: Unknown";
          presenceStatusText = `${otherUser.display_name} is offline. ${formattedLastSeen}`;
          srPresenceText = `${otherUser.display_name} is offline. ${formattedLastSeen}`;
      }
    }
  }

  const displayNameOrTyping = otherUser 
    ? (isOtherUserTyping ? <span className="italic text-primary">typing...</span> : otherUser.display_name)
    : "Chat";

  return (
    <header className="flex items-center justify-between p-3 sm:p-4 border-b bg-card rounded-t-lg h-[72px] transition-all duration-200">
      {isSelectionMode ? (
        <SelectionActionBar
            count={selectedMessageCount}
            onClose={onExitSelectionMode}
            onCopy={onCopySelected}
            onDelete={onDeleteSelected}
            onShare={onShareSelected}
        />
      ) : (
      <>
        {/* Left Section: Other User's Avatar */}
        <div className="flex-shrink-0">
          {otherUser ? (
            <button
              onClick={onOtherUserAvatarClick}
              aria-label={`View ${otherUser.display_name}'s avatar`}
              className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card transition-all hover:scale-105 active:scale-95"
            >
              <Image 
                src={otherUser.avatar_url || "https://placehold.co/100x100.png"} 
                alt={otherUser.display_name} 
                width={44} 
                height={44} 
                className="rounded-full object-cover"
                data-ai-hint={otherUser['data-ai-hint'] || "person portrait"}
                key={otherUser.avatar_url || otherUser.id} 
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-card ring-1",
                        otherUser.is_online ? "bg-green-500 ring-green-500" : "bg-gray-400 ring-gray-400"
                      )}
                      aria-hidden="true" 
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{otherUser.is_online ? `${otherUser.display_name} is online` : `${otherUser.display_name} is offline. ${formattedLastSeen}`}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </button>
          ) : (
            <div className="w-11 h-11 bg-muted rounded-full flex items-center justify-center">
              <UserCircle2 size={24} className="text-muted-foreground" />
            </div>
          )}
        </div>
        <span className="sr-only">{srPresenceText}</span>

        {/* Center Section: Other User's Name, Mood, Typing */}
        <div className="flex-grow min-w-0 text-center px-2">
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center space-x-2">
              <h2 className="font-semibold text-lg text-foreground font-headline truncate">{displayNameOrTyping}</h2>
              {otherUser && isTargetUserBeingThoughtOf && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Heart size={16} className="text-red-500 animate-pulse-subtle fill-red-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{currentUser.display_name} is thinking of you!</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {otherUser && <MoodIndicator mood={otherUser.mood} size={14}/>}
            {!otherUser && <p className="text-xs text-muted-foreground">Looking for someone...</p>}
          </div>
        </div>

        {/* Right Section: Action Icons */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 justify-end">
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                 <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/20 rounded-full"
                  aria-label="More options"
                >
                  <MoreHorizontal size={22} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onProfileClick}>
                    <UserCircle2 className="mr-2 h-4 w-4" />
                    <span>Your Account</span>
                </DropdownMenuItem>
                {otherUser?.phone && 
                    <DropdownMenuItem onSelect={() => window.location.href = `tel:${otherUser.phone?.replace(/\s|-/g, "")}` }>
                        <Phone className="mr-2 h-4 w-4"/>
                        <span>Call {otherUser.display_name}</span>
                    </DropdownMenuItem>
                }
                 <DropdownMenuItem onSelect={onSendThinkingOfYou}>
                    <Heart className="mr-2 h-4 w-4" />
                    <span>Send "Thinking of You"</span>
                </DropdownMenuItem>
                 <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onClearChat} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Clear Chat For Me</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </>
      )}
    </header>
  );
}

export default memo(ChatHeader);
