
import type { Message, User } from '@/types';
import MessageBubble from './MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef } from 'react';
import { useAutoScroll } from '@/hooks/useAutoScroll';

interface MessageAreaProps {
  messages: Message[];
  currentUser: User;
  users: User[]; // All users, to find sender details
}

export default function MessageArea({ messages, currentUser, users }: MessageAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null); // Ref for the ScrollArea component itself
  const viewportRef = useRef<HTMLDivElement>(null); // Ref for the viewport div inside ScrollArea

  useAutoScroll(viewportRef, [messages]);
  
  const findUser = (userId: string) => users.find(u => u.id === userId) || currentUser;

  return (
    <ScrollArea className="flex-grow p-4 bg-background" viewportRef={viewportRef} ref={scrollAreaRef}>
      <div className="space-y-4">
        {messages.map((msg) => {
          const sender = findUser(msg.userId);
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              sender={sender}
              isCurrentUser={msg.userId === currentUser.id}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}
