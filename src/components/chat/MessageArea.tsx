
import type { Message, User, SupportedEmoji } from '@/types';
import MessageBubble from './MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef } from 'react';
import { useAutoScroll } from '@/hooks/useAutoScroll';

interface MessageAreaProps {
  messages: Message[];
  currentUser: User;
  allUsers: Record<string, User>; // Changed from User[] to Record<string, User> for easier lookup
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
}

export default function MessageArea({ messages, currentUser, allUsers, onToggleReaction }: MessageAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null); 
  const viewportRef = useRef<HTMLDivElement>(null); 

  useAutoScroll(viewportRef, [messages]);
  
  // If sender info is not in allUsers (e.g., self message before full hydration), default to currentUser info
  const findUser = (userId: string) => allUsers[userId] || (userId === currentUser.id ? currentUser : null);

  return (
    <ScrollArea className="flex-grow p-4 bg-transparent" viewportRef={viewportRef} ref={scrollAreaRef}>
      <div className="space-y-4">
        {messages.map((msg) => {
          const sender = findUser(msg.user_id);
          if (!sender) {
            console.warn("Sender not found for message:", msg.id, "senderId:", msg.user_id);
            // Optionally render a placeholder or skip rendering this message
            return null;
          }
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              sender={sender}
              isCurrentUser={msg.user_id === currentUser.id}
              currentUserId={currentUser.id}
              onToggleReaction={onToggleReaction}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}
