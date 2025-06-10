import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Smile } from 'lucide-react'; // Smile for emoji icon

interface InputBarProps {
  onSendMessage: (text: string) => void;
}

export default function InputBar({ onSendMessage }: InputBarProps) {
  const [messageText, setMessageText] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center p-3 border-t border-border bg-card rounded-b-lg"
    >
      <Button variant="ghost" size="icon" type="button" className="text-muted-foreground hover:text-accent hover:bg-accent/10 active:bg-accent/20 rounded-full mr-2">
        <Smile size={22} />
        <span className="sr-only">Emoji</span>
      </Button>
      <Input
        type="text"
        placeholder="Type a message..."
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        className="flex-grow bg-card border-input focus:ring-primary mr-2"
        autoComplete="off"
      />
      <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-full">
        <Send size={20} />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
}
