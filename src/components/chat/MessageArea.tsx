
import { memo } from 'react';
import type { Message, User, SupportedEmoji } from '@/types';
import MessageBubble from './MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef } from 'react';
import { useAutoScroll } from '@/hooks/useAutoScroll';

interface MessageAreaProps {
  messages: Message[];
  currentUser: User;
  allUsers: Record<string, User>;
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
  onShowReactions: (message: Message, allUsers: Record<string, User>) => void;
  onShowMedia: (url: string, type: 'image' | 'video') => void; // Added for full-screen media
}

function MessageArea({ messages, currentUser, allUsers, onToggleReaction, onShowReactions, onShowMedia }: MessageAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null); 
  const viewportRef = useRef<HTMLDivElement>(null); 

  useAutoScroll(viewportRef, [messages]);
  
  const findUser = (userId: string) => allUsers[userId] || (userId === currentUser.id ? currentUser : null);

  return (
    <ScrollArea className="flex-grow p-4 bg-transparent" viewportRef={viewportRef} ref={scrollAreaRef}>
      <div className="flex flex-col space-y-4">
        {messages.map((msg) => {
          const sender = findUser(msg.user_id);
          if (!sender) {
            console.warn("Sender not found for message:", msg.id, "senderId:", msg.user_id);
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
              onShowReactions={(message) => onShowReactions(message, allUsers)}
              onShowMedia={onShowMedia} // Pass down the handler
              allUsers={allUsers}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default memo(MessageArea);
