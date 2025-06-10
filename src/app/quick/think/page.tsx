// src/app/quick/think/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';

export default function QuickThinkPage() {
  const router = useRouter();

  useEffect(() => {
    // Placeholder for actual "Thinking of You" logic
    // For example, make an API call or update local state
    console.log("Action: Thinking of You ping triggered via PWA shortcut.");
    
    // Automatically redirect after a short delay, or keep user on page
    // const timer = setTimeout(() => {
    //   router.push('/chat');
    // }, 3000);
    // return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Heart className="w-16 h-16 text-primary animate-pulse-subtle" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Thinking of You</CardTitle>
          <CardDescription className="text-muted-foreground">
            Your "Thinking of You" ping has been noted!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>This page was accessed via a PWA shortcut.</p>
          <p>In a real app, this would send a notification to your chat partner.</p>
          <Button onClick={() => router.push('/chat')} className="w-full">
            Go to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
