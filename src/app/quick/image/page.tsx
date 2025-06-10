
// src/app/quick/image/page.tsx
"use client";

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Import Input
import { Image as ImageIcon, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function QuickImagePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    console.log("Action: Send Mood Image triggered via PWA shortcut.");
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
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
          description: "Please select an image file.",
        });
        setSelectedFile(null);
        setPreview(null);
      }
    }
  };

  const handleSendImage = () => {
    if (selectedFile) {
      // Placeholder for actual image sending logic
      console.log("Sending image:", selectedFile.name);
      toast({
        title: "Image Selected (Mock)",
        description: `You've selected ${selectedFile.name}. In a real app, this would be uploaded.`,
      });
      // In a real app, you would upload the file and then redirect or update UI
      // router.push('/chat'); // Or stay on page to show upload progress
    } else {
      toast({
        variant: "destructive",
        title: "No Image",
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
            Pick an image to share.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p>This page was accessed via a PWA shortcut.</p>
          
          <div className="space-y-2">
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted border-input"
            >
              {preview ? (
                <img src={preview} alt="Selected preview" className="h-full w-full object-contain rounded-md" />
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB (Mock)</p>
                </div>
              )}
              <Input
                id="image-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </label>
            {selectedFile && <p className="text-sm text-muted-foreground">Selected: {selectedFile.name}</p>}
          </div>
          
          <Button onClick={handleSendImage} className="w-full" disabled={!selectedFile}>
            Send Image (Mock)
          </Button>
          <Button onClick={() => router.push('/chat')} className="w-full" variant="outline">
            Go to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
