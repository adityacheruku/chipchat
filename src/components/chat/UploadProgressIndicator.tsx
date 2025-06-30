
"use client";

import { Progress } from "@/components/ui/progress";
import { AlertTriangle, FileText, ImageOff, RefreshCw } from "lucide-react";
import Image from "next/image";
import Spinner from "../common/Spinner";
import { Button } from "../ui/button";
import type { Message } from "@/types";

interface UploadProgressIndicatorProps {
  message: Message;
  onRetry: () => void;
}

export default function UploadProgressIndicator({ message, onRetry }: UploadProgressIndicatorProps) {
    if (message.status === 'failed' || message.uploadStatus === 'failed') {
        const Icon = message.message_subtype === 'image' ? ImageOff : FileText;
        return (
            <div className="w-[120px] h-[120px] rounded-md border-2 border-dashed border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center p-2 text-center text-destructive">
                <Icon size={28} className="mb-2" />
                <p className="text-xs font-semibold mb-2">Upload Failed</p>
                {message.uploadError?.retryable && (
                    <Button variant="destructive" size="sm" onClick={onRetry} className="h-auto px-2 py-1 text-xs">
                        <RefreshCw size={12} className="mr-1" />
                        Retry
                    </Button>
                )}
            </div>
        );
    }
    
    const imageUrl = message.thumbnailDataUrl || message.image_url;
    const isDocument = message.message_subtype === 'document';

    return (
        <div className="w-full h-full rounded-md overflow-hidden bg-muted relative flex items-center justify-center animate-pulse p-2">
            {imageUrl && !isDocument ? (
                <Image
                    src={imageUrl}
                    alt="Uploading preview"
                    fill
                    className="object-cover"
                    loading="lazy"
                />
            ) : isDocument ? (
                 <div className="flex flex-col items-center justify-center text-muted-foreground text-center">
                    <FileText size={40} />
                    <p className="text-xs mt-2 break-all line-clamp-2">{message.file?.name}</p>
                 </div>
            ) : (
                <div className="w-full h-full bg-muted"></div>
            )}
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-2 text-center">
                <Spinner />
                <p className="text-xs font-semibold mt-2">{message.uploadProgress || 0}%</p>
                {message.uploadStatus === 'compressing' && <p className="text-xs mt-1">Compressing...</p>}
            </div>
        </div>
    );
}
