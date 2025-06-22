
"use client";

import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import Image from 'next/image';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface FullScreenMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
}

export default function FullScreenMediaModal({
  isOpen,
  onClose,
  mediaUrl,
  mediaType
}: FullScreenMediaModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-0 bg-black/80 border-none shadow-2xl h-screen w-screen max-w-full rounded-none flex items-center justify-center">
        {mediaType === 'image' ? (
          <Image
            src={mediaUrl}
            alt="Full screen media"
            layout="fill"
            objectFit="contain"
            className="p-4"
          />
        ) : (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-w-full max-h-full"
          />
        )}
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 hover:text-white rounded-full"
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
