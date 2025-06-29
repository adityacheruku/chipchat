
"use client";

import { useUploadProgress } from '@/hooks/useUploadProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { X, RefreshCw, Pause, Play } from 'lucide-react';

interface UploadQueueManagerProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function UploadQueueManager({ isVisible, onClose }: UploadQueueManagerProps) {
    const { progress, retryUpload, cancelUpload } = useUploadProgress();
    
    if (!isVisible) return null;
    
    const uploads = Object.values(progress).filter(p => p.status !== 'completed' && p.status !== 'cancelled');

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <Card className="w-80 shadow-lg bg-card/80 backdrop-blur-sm border-border">
                <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                    <div className="space-y-1">
                        <CardTitle className="text-base">Uploads</CardTitle>
                        <CardDescription className="text-xs">{uploads.filter(u => u.status === 'uploading').length} active</CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6"><Play className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><Pause className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-4 w-4" /></Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-48">
                        <div className="p-4 space-y-4">
                            {uploads.length === 0 && <p className="text-sm text-center text-muted-foreground p-4">No active uploads.</p>}
                            {uploads.map(item => (
                                <div key={item.messageId} className="text-sm">
                                    <p className="truncate text-xs font-medium">File Upload</p>
                                    <div className="flex items-center gap-2">
                                        <Progress value={item.progress} className="flex-1 h-1.5" />
                                        <span className="text-xs font-mono">{item.progress}%</span>
                                        {item.status === 'failed' ? (
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => retryUpload(item.messageId)}>
                                                <RefreshCw className="h-4 w-4"/>
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => cancelUpload(item.messageId)}>
                                                <X className="h-4 w-4"/>
                                            </Button>
                                        )}
                                    </div>
                                    {item.status === 'failed' && <p className="text-xs text-destructive mt-1">{item.error}</p>}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
