
import type { Message, User, SupportedEmoji } from '@/types';
import MessageBubble from './MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef } from 'react';
import { useAutoScroll } from '@/hooks/useAutoScroll';

interface MessageAreaProps {
  messages: Message[];
  currentUser: User;
  users: User[]; // All users, to find sender details
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
}

export default function MessageArea({ messages, currentUser, users, onToggleReaction }: MessageAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null); 
  const viewportRef = useRef<HTMLDivElement>(null); 

  useAutoScroll(viewportRef, [messages]);
  
  const findUser = (userId: string) => users.find(u => u.id === userId) || currentUser;

  return (
    <ScrollArea className="flex-grow p-4 bg-transparent" viewportRef={viewportRef} ref={scrollAreaRef}>
      <div className="space-y-4">
        {messages.map((msg) => {
          const sender = findUser(msg.userId);
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              sender={sender}
              isCurrentUser={msg.userId === currentUser.id}
              currentUserId={currentUser.id}
              onToggleReaction={onToggleReaction}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}
