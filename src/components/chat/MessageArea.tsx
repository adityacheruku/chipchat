
// ⚡️ Wrapped with React.memo to avoid re-renders when props don’t change
import { memo, type RefObject } from 'react';
import type { Message, User, SupportedEmoji, DeleteType } from '@/types';
import MessageBubble from './MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef } from 'react';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';

interface MessageAreaProps {
  viewportRef: RefObject<HTMLDivElement>;
  messages: Message[];
  currentUser: User;
  allUsers: Record<string, User>;
  onToggleReaction: (messageId: string, emoji: SupportedEmoji) => void;
  onShowReactions: (message: Message, allUsers: Record<string, User>) => void;
  onShowMedia: (url: string, type: 'image' | 'video') => void;
  onShowDocumentPreview: (message: Message) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onRetrySend: (message: Message) => void;
  onDeleteMessage: (messageId: string, deleteType: DeleteType) => void;
  onSetReplyingTo: (message: Message | null) => void;
  isSelectionMode: boolean;
  selectedMessageIds: Set<string>;
  onEnterSelectionMode: (messageId: string) => void;
  onToggleMessageSelection: (messageId: string) => void;
}

function MessageArea({ 
  messages, 
  currentUser, 
  allUsers, 
  onToggleReaction, 
  onShowReactions, 
  onShowMedia,
  onShowDocumentPreview,
  viewportRef,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onRetrySend,
  onDeleteMessage,
  onSetReplyingTo,
  isSelectionMode,
  selectedMessageIds,
  onEnterSelectionMode,
  onToggleMessageSelection,
}: MessageAreaProps) {
  const lastMessageId = messages[messages.length - 1]?.id;
  useAutoScroll(viewportRef, [lastMessageId]);
  
  const findUser = (userId: string) => allUsers[userId] || (userId === currentUser.id ? currentUser : null);

  return (
    <ScrollArea className="flex-grow p-4 bg-transparent" viewportRef={viewportRef}>
      <div className="flex flex-col space-y-4">
        {hasMore && (
            <div className="text-center">
                <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
                    {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Load Older Messages
                </Button>
            </div>
        )}
        {messages.map((msg) => {
          const sender = findUser(msg.user_id);
          if (!sender) {
            console.warn("Sender not found for message:", msg.id, "senderId:", msg.user_id);
            return null;
          }
          return (
            <MessageBubble
              key={msg.client_temp_id}
              wrapperId={`message-${msg.id}`}
              message={msg}
              sender={sender}
              isCurrentUser={msg.user_id === currentUser.id}
              currentUserId={currentUser.id}
              onToggleReaction={onToggleReaction}
              onShowReactions={(message) => onShowReactions(message, allUsers)}
              onShowMedia={onShowMedia}
              onShowDocumentPreview={onShowDocumentPreview}
              allUsers={allUsers}
              onRetrySend={onRetrySend}
              onDelete={onDeleteMessage}
              onSetReplyingTo={onSetReplyingTo}
              isSelectionMode={isSelectionMode}
              isSelected={selectedMessageIds.has(msg.id)}
              onEnterSelectionMode={onEnterSelectionMode}
              onToggleSelection={onToggleMessageSelection}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default memo(MessageArea);

    