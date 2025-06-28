
"use client";

import type { Message } from '@/types';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FileText, Download, ArrowUpRightFromSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const isMobile = useIsMobile();
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

  const handleOpenInNewTab = () => {
    if (!message?.document_url) return;
    window.open(message.document_url, '_blank', 'noopener,noreferrer');
  };

  if (!message) return null;

  const Content = () => (
    <>
      <SheetHeader className="text-left sm:text-center">
        <SheetTitle className="flex items-center gap-2 sm:justify-center">
            <FileText className="h-6 w-6 text-primary" />
            Document Preview
        </SheetTitle>
        <SheetDescription>
          Download or open the document in a new tab.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
        <FileText className="w-24 h-24 text-muted-foreground/50" />
        <p className="font-semibold text-foreground break-all">{message.document_name}</p>
        {message.file_size_bytes && (
            <p className="text-sm text-muted-foreground">{formatFileSize(message.file_size_bytes)}</p>
        )}
      </div>
       <div className="flex flex-col sm:flex-row gap-2 p-4 pt-0">
          <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={handleOpenInNewTab} variant="outline" className="w-full">
             <ArrowUpRightFromSquare className="mr-2 h-4 w-4" />
            Open in New Tab
          </Button>
        </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="rounded-t-lg p-0">
          <Content />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0">
         <Content />
      </DialogContent>
    </Dialog>
  );
}
