
import type { User } from '@/types';
import MoodIndicator from './MoodIndicator';
import { Button } from '@/components/ui/button';
import { Settings, Heart, PanelLeftOpen } from 'lucide-react'; // Added PanelLeftOpen
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

interface ChatHeaderProps {
  currentUser: User;
  otherUser: User;
  onProfileClick: () => void;
  onSendThinkingOfYou: (targetUserId: string) => void;
  isTargetUserBeingThoughtOf: boolean;
  onToggleSidebar: () => void; // New prop
}

export default function ChatHeader({ 
  currentUser, 
  otherUser, 
  onProfileClick, 
  onSendThinkingOfYou, 
  isTargetUserBeingThoughtOf,
  onToggleSidebar 
}: ChatHeaderProps) {
  let presenceStatusText = `${otherUser.name} is offline.`;
  let formattedLastSeen = "Last seen: N/A";

  if (otherUser.isOnline) {
    presenceStatusText = `${otherUser.name} is online.`;
    formattedLastSeen = "Currently online";
  } else if (otherUser.lastSeen) {
    const lastSeenDate = new Date(otherUser.lastSeen);
    if (differenceInDays(new Date(), lastSeenDate) > 7) {
      formattedLastSeen = "Last seen a while ago";
    } else {
      formattedLastSeen = `Last seen: ${lastSeenDate.toLocaleDateString()} at ${lastSeenDate.toLocaleTimeString()}`;
    }
    presenceStatusText = `${otherUser.name} is offline. ${formattedLastSeen}`;
  } else {
     presenceStatusText = `${otherUser.name} is offline. Last seen: N/A`;
  }


  return (
    <header className="flex items-center justify-between p-4 border-b border-border bg-card rounded-t-lg">
      <div className="flex items-center space-x-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSidebar}
                className="text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/20 rounded-full mr-1"
                aria-label="Toggle event timeline"
              >
                <PanelLeftOpen size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Event Timeline</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="relative">
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
                <span
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
           <span className="sr-only">{presenceStatusText}</span>
        </div>
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
      <div className="flex items-center space-x-2">
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
