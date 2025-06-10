
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import Image from 'next/image';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface FullScreenAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  avatarUrl: string;
  userName: string;
  dataAiHint?: string;
}

export default function FullScreenAvatarModal({
  isOpen,
  onClose,
  avatarUrl,
  userName,
  dataAiHint,
}: FullScreenAvatarModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 bg-card border-none shadow-2xl rounded-lg overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-lg font-semibold text-card-foreground">{userName}'s Avatar</DialogTitle>
          <DialogClose asChild>
             <Button variant="ghost" size="icon" className="absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="p-4 flex justify-center items-center">
          <Image
            src={avatarUrl}
            alt={`${userName}'s avatar`}
            width={300}
            height={300}
            className="rounded-lg object-cover aspect-square"
            data-ai-hint={dataAiHint || "person portrait large"}
            priority // Load this image with high priority as it's the main content of the modal
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
