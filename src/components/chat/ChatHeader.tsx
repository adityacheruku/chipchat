
import type { User } from '@/types';
import MoodIndicator from './MoodIndicator';
import { Button } from '@/components/ui/button';
import { Settings, Heart, PanelLeftOpen, Phone } from 'lucide-react';
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { differenceInDays, formatDistanceToNowStrict } from 'date-fns';

interface ChatHeaderProps {
  currentUser: User;
  otherUser: User;
  onProfileClick: () => void;
  onSendThinkingOfYou: (targetUserId: string) => void;
  isTargetUserBeingThoughtOf: boolean;
  onOtherUserAvatarClick: () => void; // New prop for avatar click
  onToggleSidebar?: () => void;
}

export default function ChatHeader({ 
  currentUser, 
  otherUser, 
  onProfileClick, 
  onSendThinkingOfYou, 
  isTargetUserBeingThoughtOf,
  onOtherUserAvatarClick,
  onToggleSidebar 
}: ChatHeaderProps) {
  let presenceStatusText = `${otherUser.name} is offline.`;
  let formattedLastSeen = "Last seen: N/A";
  let srPresenceText = `${otherUser.name} is offline. Last seen information not available.`;

  if (otherUser.isOnline) {
    presenceStatusText = `${otherUser.name} is online.`;
    formattedLastSeen = "Currently online";
    srPresenceText = `${otherUser.name} is online.`;
  } else if (otherUser.lastSeen) {
    const lastSeenDate = new Date(otherUser.lastSeen);
    if (differenceInDays(new Date(), lastSeenDate) > 7) {
      formattedLastSeen = "Last seen a while ago";
    } else {
      formattedLastSeen = `Last seen: ${formatDistanceToNowStrict(lastSeenDate, { addSuffix: true })}`;
    }
    presenceStatusText = `${otherUser.name} is offline. ${formattedLastSeen}`;
    srPresenceText = `${otherUser.name} is offline. ${formattedLastSeen}`;
  }


  return (
    <header className="flex items-center justify-between p-4 border-b border-border bg-card rounded-t-lg">
      <div className="flex items-center space-x-3">
        {onToggleSidebar && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onToggleSidebar} 
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/20 rounded-full mr-2 md:hidden"
                        aria-label="Toggle Event Timeline"
                    >
                        <PanelLeftOpen size={20} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Toggle Event Timeline</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        )}
        <button
          onClick={onOtherUserAvatarClick}
          aria-label={`View ${otherUser.name}'s avatar`}
          className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card transition-all hover:scale-105 active:scale-95"
        >
          <Image 
            src={otherUser.avatar} 
            alt={otherUser.name} 
            width={40} 
            height={40} 
            className="rounded-full object-cover"
            data-ai-hint={otherUser['data-ai-hint'] || "person portrait"}
            key={otherUser.avatar} 
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span // This span is not clickable, just an indicator. The button around Image is clickable.
                  className={cn(
                    "absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-card ring-1",
                    otherUser.isOnline ? "bg-green-500 ring-green-500" : "bg-gray-400 ring-gray-400"
                  )}
                  aria-hidden="true" 
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{otherUser.isOnline ? `${otherUser.name} is online` : `${otherUser.name} is offline. ${formattedLastSeen}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </button>
           <span className="sr-only">{srPresenceText}</span>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-semibold text-foreground font-headline">{otherUser.name}</h2>
            {isTargetUserBeingThoughtOf && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Heart size={18} className="text-red-500 animate-pulse-subtle fill-red-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{currentUser.name} is thinking of you!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <MoodIndicator mood={otherUser.mood} />
        </div>
      </div>
      <div className="flex items-center space-x-1 sm:space-x-2">
        {otherUser.phone && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`tel:${otherUser.phone.replace(/\s|-/g, "")}`} // Sanitize phone number for tel link
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "text-muted-foreground hover:text-green-600 hover:bg-green-600/10 active:bg-green-600/20 rounded-full"
                  )}
                  aria-label={`Call ${otherUser.name}`}
                >
                  <Phone size={20} />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Call {otherUser.name} ({otherUser.phone})</p>
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
                onClick={() => onSendThinkingOfYou(otherUser.id)}
                className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 active:bg-red-500/20 rounded-full"
                aria-label={`Send ${otherUser.name} a "Thinking of You"`}
              >
                <Heart size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Let {otherUser.name} know you're thinking of them</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-sm text-muted-foreground hidden md:inline">
          You: {currentUser.name}
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onProfileClick} 
          className="text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/20 rounded-full"
          aria-label="Open your profile"
        >
          <Settings size={20} />
        </Button>
      </div>
    </header>
  );
}
