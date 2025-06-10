// src/app/quick/image/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon } from 'lucide-react'; // Renamed to avoid conflict with Next/Image

export default function QuickImagePage() {
  const router = useRouter();

  useEffect(() => {
    console.log("Action: Send Mood Image triggered via PWA shortcut.");
    // Placeholder for image picking logic
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <ImageIcon className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Send Mood Image</CardTitle>
          <CardDescription className="text-muted-foreground">
            Ready to share an image!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>This page was accessed via a PWA shortcut.</p>
          <p>In a real app, this page would allow you to pick and send an image.</p>
           {/* Add an input type="file" here for actual image selection */}
          <Button onClick={() => router.push('/chat')} className="w-full">
            Go to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
