import type { User } from '@/types';
import MoodIndicator from './MoodIndicator';
import { Button } from '@/components/ui/button';
import { User as UserIcon, Settings } from 'lucide-react'; // Settings or UserIcon for profile
import Image from 'next/image';

interface ChatHeaderProps {
  currentUser: User;
  otherUser: User;
  onProfileClick: () => void;
}

export default function ChatHeader({ currentUser, otherUser, onProfileClick }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 border-b border-border bg-card rounded-t-lg">
      <div className="flex items-center space-x-3">
        <Image 
          src={otherUser.avatar} 
          alt={otherUser.name} 
          width={40} 
          height={40} 
          className="rounded-full"
          data-ai-hint="person portrait"
        />
        <div>
          <h2 className="font-semibold text-foreground font-headline">{otherUser.name}</h2>
          <MoodIndicator mood={otherUser.mood} />
        </div>
      </div>
      <div className="flex items-center space-x-2">
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
