import type { Message, User } from '@/types';
import { format } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  sender: User;
  isCurrentUser: boolean;
}

export default function MessageBubble({ message, sender, isCurrentUser }: MessageBubbleProps) {
  const alignmentClass = isCurrentUser ? 'items-end' : 'items-start';
  const bubbleColorClass = isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground';
  const bubbleBorderRadius = isCurrentUser ? 'rounded-br-none' : 'rounded-bl-none';

  return (
    <div className={cn('flex flex-col mb-4', alignmentClass)}>
      <div className={cn('flex items-end space-x-2 max-w-xs md:max-w-md lg:max-w-lg', isCurrentUser ? 'flex-row-reverse space-x-reverse' : 'flex-row')}>
        <Image
          src={sender.avatar}
          alt={sender.name}
          width={32}
          height={32}
          className="rounded-full"
          data-ai-hint="person portrait"
        />
        <div
          className={cn(
            'p-3 rounded-xl shadow',
            bubbleColorClass,
            bubbleBorderRadius
          )}
        >
          {!isCurrentUser && (
            <p className="text-xs font-semibold mb-1">{sender.name}</p>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      </div>
      <p className={cn('text-xs text-muted-foreground mt-1 px-2', isCurrentUser ? 'text-right' : 'text-left')}>
        {format(new Date(message.timestamp), 'p')}
      </p>
    </div>
  );
}
