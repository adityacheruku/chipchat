
"use client";

import { Progress } from "@/components/ui/progress";
import { File, Loader2 } from "lucide-react";
import Image from "next/image";

interface UploadProgressIndicatorProps {
  fileName: string;
  progress: number;
  previewUrl?: string | null; // Local object URL for image/video previews
  fileType: string;
}

export default function UploadProgressIndicator({
  fileName,
  progress,
  previewUrl,
  fileType,
}: UploadProgressIndicatorProps) {
  const isImage = fileType.startsWith("image/");
  
  return (
    <div className="relative w-48 h-32 flex flex-col items-center justify-center bg-muted/50 rounded-lg p-2 overflow-hidden">
      {isImage && previewUrl ? (
        <Image
          src={previewUrl}
          alt={`Preview of ${fileName}`}
          layout="fill"
          objectFit="cover"
          className="opacity-40"
        />
      ) : (
        <File className="w-12 h-12 text-muted-foreground" />
      )}
      
      <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center p-2 text-white z-10">
        <Loader2 className="animate-spin h-6 w-6 mb-2" />
        <p className="text-xs font-semibold truncate w-full text-center">{fileName}</p>
        <div className="w-full mt-2">
          <Progress value={progress} className="h-2 [&>span]:bg-white" />
          <p className="text-xs text-center mt-1">{progress}%</p>
        </div>
      </div>
    </div>
  );
}
