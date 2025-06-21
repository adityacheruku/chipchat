
import type { User } from '@/types';
import MoodIndicator from './MoodIndicator';
import { Button, buttonVariants } from '@/components/ui/button';
import { UserCircle2, Heart, Phone } from 'lucide-react'; // Changed Settings to UserCircle2
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { differenceInDays, formatDistanceToNowStrict, parseISO } from 'date-fns';

interface ChatHeaderProps {
  currentUser: User;
  otherUser: User | null; 
  onProfileClick: () => void; // This will now be triggered by UserCircle2 icon
  onSendThinkingOfYou: (targetUserId: string) => void;
  isTargetUserBeingThoughtOf: boolean;
  onOtherUserAvatarClick: () => void;
  isOtherUserTyping?: boolean;
}

export default function ChatHeader({ 
  currentUser, 
  otherUser, 
  onProfileClick, 
  onSendThinkingOfYou, 
  isTargetUserBeingThoughtOf,
  onOtherUserAvatarClick,
  isOtherUserTyping,
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
    <header className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-card rounded-t-lg h-16">
      {/* Left Section: Other User's Avatar */}
      <div className="flex-shrink-0 w-1/5">
        {otherUser ? (
          <button
            onClick={onOtherUserAvatarClick}
            aria-label={`View ${otherUser.display_name}'s avatar`}
            className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card transition-all hover:scale-105 active:scale-95"
          >
            <Image 
              src={otherUser.avatar_url || "https://placehold.co/100x100.png"} 
              alt={otherUser.display_name} 
              width={40} 
              height={40} 
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
          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
            <UserCircle2 size={24} className="text-muted-foreground" />
          </div>
        )}
      </div>
      <span className="sr-only">{srPresenceText}</span>

      {/* Center Section: Other User's Name, Mood, Typing */}
      <div className="flex-grow min-w-0 text-center px-2">
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center space-x-2">
            <h2 className="font-semibold text-base text-foreground font-headline truncate">{displayNameOrTyping}</h2>
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
      <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 w-1/5 justify-end">
        {otherUser && otherUser.phone && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`tel:${otherUser.phone.replace(/\s|-/g, "")}`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "text-muted-foreground hover:text-green-600 hover:bg-green-600/10 active:bg-green-600/20 rounded-full w-9 h-9 sm:w-10 sm:h-10"
                  )}
                  aria-label={`Call ${otherUser.display_name}`}
                >
                  <Phone size={18} sm-size={20} />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Call {otherUser.display_name} ({otherUser.phone})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {otherUser && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSendThinkingOfYou(otherUser!.id)} 
                  className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 active:bg-red-500/20 rounded-full w-9 h-9 sm:w-10 sm:h-10"
                  aria-label={`Send ${otherUser.display_name} a "Thinking of You"`}
                  disabled={!otherUser}
                >
                  <Heart size={18} sm-size={20} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Let {otherUser.display_name} know you're thinking of them</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={onProfileClick} 
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/20 rounded-full w-9 h-9 sm:w-10 sm:h-10"
                      aria-label="Open your profile and settings"
                    >
                      <UserCircle2 size={18} sm-size={20} />
                    </Button>
                </TooltipTrigger>
                 <TooltipContent>
                    <p>Your Account & Settings</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
