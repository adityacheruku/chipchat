
import type { User } from '@/types';
import MoodIndicator from './MoodIndicator';
import { Button } from '@/components/ui/button';
import { Settings, Heart } from 'lucide-react';
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  currentUser: User;
  otherUser: User;
  onProfileClick: () => void;
  onSendThinkingOfYou: (targetUserId: string) => void;
  isTargetUserBeingThoughtOf: boolean;
}

export default function ChatHeader({ currentUser, otherUser, onProfileClick, onSendThinkingOfYou, isTargetUserBeingThoughtOf }: ChatHeaderProps) {
  const lastSeenDate = otherUser.lastSeen ? new Date(otherUser.lastSeen) : null;
  const formattedLastSeen = lastSeenDate 
    ? `Last seen: ${lastSeenDate.toLocaleDateString()} at ${lastSeenDate.toLocaleTimeString()}`
    : 'Last seen: N/A';

  return (
    <header className="flex items-center justify-between p-4 border-b border-border bg-card rounded-t-lg">
      <div className="flex items-center space-x-3">
        <div className="relative">
          <Image 
            src={otherUser.avatar} 
            alt={otherUser.name} 
            width={40} 
            height={40} 
            className="rounded-full object-cover"
            data-ai-hint={otherUser['data-ai-hint'] || "person portrait"}
            key={otherUser.avatar} // Force re-render if avatar changes
          />
          {otherUser.isOnline ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-card ring-1 ring-green-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{otherUser.name} is online</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-gray-400 border-2 border-card ring-1 ring-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{otherUser.name} is offline. {formattedLastSeen}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
