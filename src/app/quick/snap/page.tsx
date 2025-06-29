
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
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          toast({ variant: "destructive", title: "File Too Large", description: "File must be smaller than 10MB." });
          return;
        }
        setSelectedFile(file);
        if(file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setPreview(null); // No preview for video
        }
      } else {
        toast({ variant: "destructive", title: "Invalid File", description: "Please select an image or video." });
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
      const uploadFunction = selectedFile.type.startsWith('image/') ? api.uploadChatImage : api.uploadChatVideo;
      const uploadRes = await uploadFunction(selectedFile, () => {});
      
      let messagePayload: any = {
          mode: 'incognito',
          client_temp_id: `snap-${Date.now()}`
      };

      if (selectedFile.type.startsWith('image/')) {
          messagePayload.image_url = (uploadRes as any).image_url;
          messagePayload.image_thumbnail_url = (uploadRes as any).image_thumbnail_url;
          messagePayload.message_subtype = 'image';
      } else {
          messagePayload.clip_url = (uploadRes as any).file_url;
          messagePayload.clip_type = 'video';
          messagePayload.image_thumbnail_url = (uploadRes as any).thumbnail_url;
          messagePayload.duration_seconds = (uploadRes as any).duration_seconds;
          messagePayload.message_subtype = 'clip';
      }

      await api.sendMessageHttp(recipientChat.id, messagePayload);
      
      toast({ title: "Snap Sent!", description: "Your snap will disappear after being viewed." });
      router.push('/chat');

    } catch (error: any) {
      toast({ variant: "destructive", title: "Send Failed", description: error.message });
    } finally {
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
                <p className="text-xs text-muted-foreground">Image or Video (Max 10MB)</p>
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
