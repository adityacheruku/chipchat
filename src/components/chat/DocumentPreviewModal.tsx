
"use client";

import type { Message } from '@/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FileText, Download, ArrowUpRightFromSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
}

function formatFileSize(bytes?: number | null): string | null {
  if (bytes === null || bytes === undefined) return null;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


export default function DocumentPreviewModal({ isOpen, onClose, message }: DocumentPreviewModalProps) {
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!message?.document_url) return;
    try {
      const response = await fetch(message.document_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = message.document_name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Download Started", description: `Downloading ${message.document_name}` });
    } catch (error) {
      toast({ variant: 'destructive', title: "Download Failed", description: "Could not download the file." });
    }
  };

  const handleOpenIn = async () => {
    if (!message?.document_url || !message.document_name) return;

    try {
        const response = await fetch(message.document_url);
        const blob = await response.blob();
        const file = new File([blob], message.document_name, { type: blob.type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: message.document_name,
                text: `Check out this document: ${message.document_name}`,
            });
        } else {
             window.open(message.document_url, '_blank', 'noopener,noreferrer');
        }
    } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error("Share failed, falling back:", error);
          window.open(message.document_url, '_blank', 'noopener,noreferrer');
        }
    }
  };

  if (!message) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-lg p-0">
        <SheetHeader className="p-6 pb-2 text-center">
            <SheetTitle className="flex items-center gap-2 justify-center">
                <FileText className="h-6 w-6 text-primary" />
                Document
            </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 border-y">
            <div className="p-4 bg-muted rounded-full">
                <FileText className="w-16 h-16 text-muted-foreground" />
            </div>
            <div className="max-w-full">
                <p className="font-semibold text-lg text-foreground break-words">{message.document_name}</p>
                {message.file_size_bytes && (
                    <p className="text-sm text-muted-foreground">{formatFileSize(message.file_size_bytes)}</p>
                )}
            </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 p-4">
            <Button onClick={handleDownload} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download
            </Button>
            <Button onClick={handleOpenIn} variant="secondary" className="w-full">
                <ArrowUpRightFromSquare className="mr-2 h-4 w-4" />
                Open In…
            </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
