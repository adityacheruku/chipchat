
"use client";

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { Chat } from '@/types';
import Spinner from '@/components/common/Spinner';
import FullPageLoader from '@/components/common/FullPageLoader';
import { uploadManager } from '@/services/uploadManager';
import { v4 as uuidv4 } from 'uuid';
import { validateFile } from '@/utils/fileValidation';

export default function QuickImagePage() {
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
      toast({ variant: "destructive", title: "Not Logged In", description: "Please log in to send an image." });
      router.replace('/');
      return;
    }
    if (isAuthenticated && currentUser) {
        setIsLoadingRecipient(true);
        if (currentUser.partner_id) {
            api.createOrGetChat(currentUser.partner_id)
                .then(setRecipientChat)
                .catch(err => {
                    toast({variant: 'destructive', title: 'Chat Error', description: err.message || "Could not establish chat session."});
                })
                .finally(() => setIsLoadingRecipient(false));
        } else {
             toast({variant: 'destructive', title: 'No Partner', description: "You don't have a partner to send an image to."});
             setIsLoadingRecipient(false);
        }
    }
  }, [isAuthLoading, isAuthenticated, currentUser, router, toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validation = validateFile(file);
      if (validation.isValid && validation.fileType === 'image') {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        toast({ variant: "destructive", title: "Invalid File", description: validation.errors.join(', ') || 'Please select an image file.' });
        setSelectedFile(null); setPreview(null);
      }
    }
  };

  const handleSendImage = async () => {
    if (!selectedFile || !recipientChat) {
      toast({ variant: "destructive", title: "Error", description: "Please select an image and ensure a recipient is available." });
      return;
    }
    setIsSubmitting(true);
    try {
      uploadManager.addToQueue({
        id: uuidv4(),
        file: selectedFile,
        messageId: uuidv4(),
        chatId: recipientChat.id,
        priority: 3, // Medium-high priority for quick actions
        subtype: 'image',
      });
      
      toast({
        title: "Image Queued!",
        description: "Your image will be sent shortly.",
      });
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
          <div className="flex justify-center mb-4"><ImageIcon className="w-16 h-16 text-primary" /></div>
          <CardTitle className="text-2xl font-headline text-primary text-center">Send Image</CardTitle>
          <CardDescription className="text-center">
            {recipientChat ? `Pick an image to share in your chat.` : "Loading chat info..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted border-input transition-colors">
            {preview ? ( <img src={preview} alt="Selected preview" className="h-full w-full object-contain rounded-md p-1" />
            ) : (
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span></p>
                <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
              </div>
            )}
            <Input id="image-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isSubmitting || !recipientChat} />
          </label>
          <Button onClick={handleSendImage} className="w-full" disabled={!selectedFile || isSubmitting || !recipientChat}>
            {isSubmitting ? <Spinner /> : "Send Image"}
          </Button>
          <Button onClick={() => router.push('/chat')} className="w-full" variant="outline" disabled={isSubmitting}>Back to Chat</Button>
        </CardContent>
      </Card>
    </main>
  );
}
