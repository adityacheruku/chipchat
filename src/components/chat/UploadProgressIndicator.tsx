
"use client";

import { Progress } from "@/components/ui/progress";
import { FileText, Loader2 } from "lucide-react";

interface UploadProgressIndicatorProps {
  fileName: string;
  progress: number;
}

export default function UploadProgressIndicator({
  fileName,
  progress,
}: UploadProgressIndicatorProps) {
  
  return (
    <div className="w-48 flex items-center gap-2 bg-muted/50 rounded-lg p-2 overflow-hidden text-secondary-foreground">
      <FileText className="w-8 h-8 flex-shrink-0" />
      <div className="flex-grow min-w-0">
        <p className="text-xs font-semibold truncate">{fileName}</p>
        <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-grow" />
            <span className="text-xs font-mono">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
