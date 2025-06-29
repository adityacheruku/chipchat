
"use client";

import type { Message } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';

interface MessageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
}

export default function MessageInfoModal({ isOpen, onClose, message }: MessageInfoModalProps) {
  if (!isOpen || !message) return null;

  const sentAt = message.created_at ? format(parseISO(message.created_at), 'MMM d, yyyy, p') : 'N/A';
  const isRead = message.status === 'read';
  // Backend doesn't support read timestamps yet, so this is just a placeholder.
  const readStatusText = isRead ? "Your partner has seen the message." : "Not yet seen.";

  const renderMessageContent = () => {
    switch(message.message_subtype) {
      case 'text':
        return <p className="whitespace-pre-wrap break-words">{message.text}</p>;
      case 'sticker':
        return <img src={message.sticker_image_url} alt="Sticker" className="w-32 h-32" />;
      case 'image':
        return <img src={message.image_thumbnail_url || message.image_url} alt="Image" className="max-w-full rounded-md" />;
      case 'voice_message':
        return <p>Voice Message</p>; // Simplified view for info modal
      default:
        return <p className="italic">Media message</p>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message Info</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="p-3 rounded-lg bg-muted text-muted-foreground">
                {renderMessageContent()}
            </div>
            <Separator />
            <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                    <CheckCheck className="h-5 w-5 text-primary" />
                    <div>
                        <p className="font-semibold">Sent</p>
                        <p className="text-muted-foreground">{sentAt}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-3">
                    <CheckCheck className={`h-5 w-5 ${isRead ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    <div>
                        <p className="font-semibold">Read</p>
                        <p className="text-muted-foreground">{readStatusText}</p>
                    </div>
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
