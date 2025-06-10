import type { Message, User } from '@/types';
import MessageBubble from './MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useRef } from 'react';

interface MessageAreaProps {
  messages: Message[];
  currentUser: User;
  users: User[]; // All users, to find sender details
}

export default function MessageArea({ messages, currentUser, users }: MessageAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);
  
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
