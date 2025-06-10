
// src/app/quick/think/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import type { User } from '@/types';
import { mockUsers } from '@/lib/mock-data'; // To find a potential recipient name

export default function QuickThinkPage() {
  const router = useRouter();
  const [recipientName, setRecipientName] = useState<string>("your chat partner");

  useEffect(() => {
    console.log("Action: Thinking of You ping triggered via PWA shortcut.");
    
    const activeUsername = localStorage.getItem('chirpChatActiveUsername');
    if (activeUsername) {
      const currentUserProfileKey = `chirpChatUserProfile_${activeUsername}`;
      const storedProfileJson = localStorage.getItem(currentUserProfileKey);
      let currentUser: User | null = null;
      if (storedProfileJson) {
        try {
          currentUser = JSON.parse(storedProfileJson) as User;
        } catch (e) { console.error("Error parsing current user for think page", e); }
      }

      // Attempt to find a different user to be the recipient for the message
      const otherMockUser = mockUsers.find(u => u.name.toLowerCase() !== activeUsername.toLowerCase());
      if (otherMockUser) {
        setRecipientName(otherMockUser.name);
      } else if (currentUser && mockUsers.length > 0 && mockUsers[0].id !== currentUser.id) {
        setRecipientName(mockUsers[0].name);
      } else if (mockUsers.length > 1) {
        setRecipientName(mockUsers[1].name); // Fallback if current user is the first mock user
      }
    }
    // In a real app, this might set a flag in localStorage or make an API call.
    // For now, it's a UI confirmation.
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Heart className="w-16 h-16 text-primary animate-pulse-subtle" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Thinking of You</CardTitle>
          <CardDescription className="text-muted-foreground">
            A "Thinking of You" ping for {recipientName} has been noted!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          <p className="text-sm">In a real app, this would send a notification or update the chat.</p>
          <Button onClick={() => router.push('/chat')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Go to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

