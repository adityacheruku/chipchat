
"use client";

import { Progress } from "@/components/ui/progress";
import { AlertTriangle, ImageOff, RefreshCw } from "lucide-react";
import Image from "next/image";
import Spinner from "../common/Spinner";
import { Button } from "../ui/button";
import type { Message } from "@/types";

interface UploadProgressIndicatorProps {
  message: Message;
  onRetry: () => void;
}

export default function UploadProgressIndicator({ message, onRetry }: UploadProgressIndicatorProps) {
    if (message.status === 'failed') {
        return (
            <div className="w-[120px] h-[120px] rounded-md border-2 border-dashed border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center p-2 text-center text-destructive">
                <ImageOff size={28} className="mb-2" />
                <p className="text-xs font-semibold mb-2">Upload Failed</p>
                <p className="text-xs text-destructive/80 mb-2 leading-tight">
                    {message.uploadError?.message || "An unknown error occurred."}
                </p>
                {message.uploadError?.retryable && (
                    <Button variant="destructive" size="sm" onClick={onRetry} className="h-auto px-2 py-1 text-xs">
                        <RefreshCw size={12} className="mr-1" />
                        Retry
                    </Button>
                )}
            </div>
        );
    }
    
    // Default to uploading view
    return (
        <div className="w-[120px] h-[120px] rounded-md overflow-hidden bg-muted relative flex items-center justify-center animate-pulse">
            {message.image_url && (
                <Image
                    src={message.image_url} // This is the local blob URL
                    alt="Uploading preview"
                    fill
                    className="object-cover"
                    loading="lazy"
                />
            )}
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <Spinner />
                <p className="text-xs font-semibold mt-2">{message.uploadProgress || 0}%</p>
            </div>
        </div>
    );
}
