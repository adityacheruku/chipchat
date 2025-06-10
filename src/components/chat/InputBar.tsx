
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile, Mic } from 'lucide-react'; // Added Mic icon
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InputBarProps {
  onSendMessage: (text: string) => void;
  onSendMoodClip: (clipType: 'audio' | 'video') => void; // New prop
}

export default function InputBar({ onSendMessage, onSendMoodClip }: InputBarProps) {
  const [messageText, setMessageText] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  const handleMoodClipClick = () => {
    // For now, let's default to 'audio'. This could be more sophisticated later.
    onSendMoodClip('audio'); 
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center p-3 border-t border-border bg-card rounded-b-lg"
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              type="button" 
              className="text-muted-foreground hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded-full mr-2 focus-visible:ring-ring"
              aria-label="Open emoji picker (coming soon)"
            >
              <Smile size={22} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Emoji - Coming Soon!</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

       <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              type="button" 
              onClick={handleMoodClipClick}
              className="text-muted-foreground hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded-full mr-2 focus-visible:ring-ring"
              aria-label="Send mood clip (mock)"
            >
              <Mic size={22} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Send Audio Mood Clip (Mock)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Input
        type="text"
        placeholder="Type a message..."
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        className="flex-grow bg-card border-input focus-visible:ring-ring mr-2"
        autoComplete="off"
      />
      <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-full focus-visible:ring-ring">
        <Send size={20} />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
}
