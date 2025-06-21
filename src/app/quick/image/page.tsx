
"use client";

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { DefaultChatPartnerResponse, Chat } from '@/types';

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
    console.log("Action: Send Mood Image triggered via PWA shortcut.");
    if (!isAuthLoading && !isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first to send an image.",
        duration: 5000,
      });
      router.replace('/');
      return;
    }
    if (isAuthenticated && currentUser) {
        setIsLoadingRecipient(true);
        api.getDefaultChatPartner()
            .then(partner => {
                if (partner) {
                    return api.createOrGetChat(partner.user_id);
                }
                throw new Error("Could not find a chat partner.");
            })
            .then(chatSession => {
                setRecipientChat(chatSession);
            })
            .catch(err => {
                toast({variant: 'destructive', title: 'Chat Error', description: err.message || "Could not establish chat session."});
            })
            .finally(() => setIsLoadingRecipient(false));
    }

  }, [isAuthLoading, isAuthenticated, currentUser, router, toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({ variant: "destructive", title: "File Too Large", description: "Image must be smaller than 5MB." });
            setSelectedFile(null); setPreview(null); event.target.value = "";
            return;
        }
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        toast({ variant: "destructive", title: "Invalid File", description: "Please select an image." });
        setSelectedFile(null); setPreview(null); event.target.value = "";
      }
    }
  };

  const handleSendImage = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "No Image", description: "Please select an image." });
      return;
    }
    if (!recipientChat) {
        toast({ variant: "destructive", title: "No Recipient", description: "Cannot determine who to send the image to." });
        return;
    }

    setIsSubmitting(true);
    try {
      const uploadRes = await api.uploadChatImage(selectedFile);
      // After upload, send message via API (or ideally WebSocket if useWebSocket hook was available here)
      // For simplicity, using HTTP POST. A WebSocket message would be better for real-time.
      await api.sendMessageHttp(recipientChat.id, { 
        image_url: uploadRes.image_url,
        image_thumbnail_url: uploadRes.image_thumbnail_url,
        message_subtype: 'image'
      });
      
      toast({
        title: "Image Sent!",
        description: `Your image has been sent to the chat.`,
        duration: 5000,
      });
      router.push('/chat');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Send Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isLoadingPage = isAuthLoading || (isAuthenticated && isLoadingRecipient);

  if (isLoadingPage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-foreground">Loading image sender...</p>
      </main>
    );
  }

   if (!isAuthenticated || !currentUser) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl text-center">
           <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
           <CardContent>
             <p className="text-red-600 py-4">Please log in via the main ChirpChat app.</p>
             <Button onClick={() => router.push('/')} className="w-full" variant="outline">Go to Login</Button>
           </CardContent>
        </Card>
      </main>
    );
  }


  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <ImageIcon className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Send Mood Image</CardTitle>
          <CardDescription className="text-muted-foreground">
            {recipientChat ? `Pick an image to share in your chat.` : "Loading chat information..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          
          <div className="space-y-2">
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted border-input transition-colors"
            >
              {preview ? (
                <img src={preview} alt="Selected preview" className="h-full w-full object-contain rounded-md p-1" />
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">Click to upload</span> or drag & drop
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF (Max 5MB)</p>
                </div>
              )}
              <Input
                id="image-upload" type="file" className="hidden" accept="image/*"
                onChange={handleFileChange} disabled={isSubmitting || !recipientChat}
              />
            </label>
            {selectedFile && <p className="text-sm text-muted-foreground">Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
          </div>
          
          <Button onClick={handleSendImage} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!selectedFile || isSubmitting || !recipientChat}>
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Send Image"}
          </Button>
          <Button onClick={() => router.push('/chat')} className="w-full" variant="outline" disabled={isSubmitting}>
            Back to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
