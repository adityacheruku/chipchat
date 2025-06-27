
"use client";

import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import Image from 'next/image';
import { X, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  if (!isOpen) {
    return null;
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const fileExtension = mediaUrl.split('.').pop()?.split('?')[0] || (mediaType === 'image' ? 'jpg' : 'mp4');
      a.download = `chirpchat-${mediaType}-${Date.now()}.${fileExtension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Download Started", description: "Your file is being downloaded." });

    } catch (error) {
      console.error("Download failed", error);
      toast({ variant: 'destructive', title: "Download Failed", description: "Could not download the file." });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-0 bg-black/80 border-none shadow-2xl h-screen w-screen max-w-full rounded-none flex items-center justify-center">
        {mediaType === 'image' ? (
          <Image
            src={mediaUrl}
            alt="Full screen media"
            fill
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
        <div className="absolute top-4 right-4 flex gap-2">
            <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-white bg-black/50 hover:bg-black/70 hover:text-white rounded-full"
                aria-label="Download media"
              >
                <Download className="h-6 w-6" />
                <span className="sr-only">Download</span>
            </Button>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white bg-black/50 hover:bg-black/70 hover:text-white rounded-full"
                aria-label="Close media viewer"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
