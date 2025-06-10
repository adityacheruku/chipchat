
// src/app/quick/image/page.tsx
"use client";

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function QuickImagePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    console.log("Action: Send Mood Image triggered via PWA shortcut.");
    const activeUsername = localStorage.getItem('chirpChatActiveUsername');
    if (activeUsername) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first to send an image.",
        duration: 5000,
      });
    }
  }, [toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        // Basic client-side size check (e.g., 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast({
                variant: "destructive",
                title: "File Too Large",
                description: "Please select an image smaller than 5MB.",
            });
            setSelectedFile(null);
            setPreview(null);
            event.target.value = ""; // Reset file input
            return;
        }
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File",
          description: "Please select an image file (PNG, JPG, GIF).",
        });
        setSelectedFile(null);
        setPreview(null);
        event.target.value = ""; // Reset file input
      }
    }
  };

  const handleSendImage = () => {
    if (selectedFile && isLoggedIn) {
      toast({
        title: "Image Selected (Mock)",
        description: `You've selected ${selectedFile.name}. In a real app, this image would be uploaded and sent.`,
        duration: 5000,
      });
      // In a real app, you would upload the file.
      // For now, we just show a toast and could potentially redirect.
      // router.push('/chat');
    } else if (!isLoggedIn) {
       toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "No Image Selected",
        description: "Please select an image first.",
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <ImageIcon className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Send Mood Image</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLoggedIn ? "Pick an image to share with your friend." : "Log in to ChirpChat to share images."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          
          {isLoggedIn ? (
            <>
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
                    id="image-upload"
                    type="file"
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif"
                    onChange={handleFileChange}
                  />
                </label>
                {selectedFile && <p className="text-sm text-muted-foreground">Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
              </div>
              
              <Button onClick={handleSendImage} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!selectedFile}>
                Send Image (Mock)
              </Button>
            </>
          ) : (
             <p className="text-red-600">Please open ChirpChat and log in to use this feature.</p>
          )}
          <Button onClick={() => router.push(isLoggedIn ? '/chat' : '/')} className="w-full" variant="outline">
            {isLoggedIn ? "Back to Chat" : "Go to Login"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
