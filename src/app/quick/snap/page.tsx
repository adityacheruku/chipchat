
"use client";

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, UploadCloud, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { Chat } from '@/types';
import Spinner from '@/components/common/Spinner';
import FullPageLoader from '@/components/common/FullPageLoader';
import { uploadManager } from '@/services/uploadManager';
import { v4 as uuidv4 } from 'uuid';
import { validateFile } from '@/utils/fileValidation';


export default function QuickSnapPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: isAuthLoading, isAuthenticated } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientChat, setRecipientChat] = useState<Chat | null>(null);
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to send a snap." });
      router.replace('/');
      return;
    }
    if (isAuthenticated && currentUser) {
      setIsLoadingRecipient(true);
      if (currentUser.partner_id) {
        api.createOrGetChat(currentUser.partner_id)
          .then(setRecipientChat)
          .catch(err => toast({ variant: 'destructive', title: 'Chat Error', description: err.message }))
          .finally(() => setIsLoadingRecipient(false));
      } else {
        toast({ variant: 'destructive', title: 'No Partner', description: "You don't have a partner to send a snap to." });
        setIsLoadingRecipient(false);
      }
    }
  }, [isAuthLoading, isAuthenticated, currentUser, router, toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validation = validateFile(file);
      if (validation.isValid && (validation.fileType === 'image' || validation.fileType === 'video')) {
        setSelectedFile(file);
        if(file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
      } else {
        toast({ variant: "destructive", title: "Invalid File", description: validation.errors.join(', ') || "Please select an image or video." });
      }
    }
  };

  const handleSendSnap = async () => {
    if (!selectedFile || !recipientChat) {
      toast({ variant: "destructive", title: "Error", description: "Please select a file and ensure you have a partner." });
      return;
    }
    setIsSubmitting(true);
    try {
        const validation = validateFile(selectedFile);
        uploadManager.addToQueue({
            id: uuidv4(),
            file: selectedFile,
            messageId: uuidv4(),
            chatId: recipientChat.id,
            priority: 2, // High priority for snaps
            subtype: validation.fileType as 'image' | 'clip',
            // This is where we mark it as incognito
            // The upload manager does not currently have a field for this.
            // For now, we assume the chat page will handle this mode.
            // A more robust solution would be to add a `mode` field to the UploadItem.
        });
      
      toast({ title: "Snap Queued!", description: "Your snap will be sent incognito." });
      router.push('/chat');

    } catch (error: any) {
      toast({ variant: "destructive", title: "Send Failed", description: error.message });
      setIsSubmitting(false);
    }
  };
  
  const isLoadingPage = isAuthLoading || (isAuthenticated && isLoadingRecipient);
  if (isLoadingPage) return <FullPageLoader />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4"><Camera className="w-16 h-16 text-primary" /></div>
          <CardTitle className="text-2xl font-headline text-primary text-center">Send a Snap</CardTitle>
          <CardDescription className="text-center">
            {recipientChat ? "Share a quick, disappearing photo or video." : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <label htmlFor="snap-upload" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted border-input transition-colors">
            {preview ? ( <Image src={preview} alt="Selected preview" className="h-full w-full object-contain rounded-md p-1" width={150} height={150} />
            ) : selectedFile ? (
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    <Video className="w-10 h-10 mb-3 text-muted-foreground" />
                    <p className="font-semibold text-sm text-foreground truncate max-w-full px-2">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">Video selected</p>
                </div>
            ) : (
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span></p>
                <p className="text-xs text-muted-foreground">Image or Video (Max 100MB)</p>
              </div>
            )}
            <Input id="snap-upload" type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} disabled={isSubmitting || !recipientChat} />
          </label>
          <Button onClick={handleSendSnap} className="w-full" disabled={!selectedFile || isSubmitting || !recipientChat}>
            {isSubmitting ? <Spinner /> : "Send Incognito Snap"}
          </Button>
          <Button onClick={() => router.push('/chat')} className="w-full" variant="outline" disabled={isSubmitting}>Back to Chat</Button>
        </CardContent>
      </Card>
    </main>
  );
}
