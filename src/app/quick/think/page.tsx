
// src/app/quick/think/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import type { User } from '@/types';
import { mockUsers } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';

export default function QuickThinkPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [recipientName, setRecipientName] = useState<string>("your chat partner");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const activeUsername = localStorage.getItem('chirpChatActiveUsername');
    if (activeUsername) {
      setIsLoggedIn(true);
      const currentUserProfileKey = `chirpChatUserProfile_${activeUsername}`;
      const storedProfileJson = localStorage.getItem(currentUserProfileKey);
      let userFromStorage: User | null = null;
      if (storedProfileJson) {
        try {
          userFromStorage = JSON.parse(storedProfileJson) as User;
          setCurrentUser(userFromStorage);
        } catch (e) { 
          console.error("Error parsing current user for think page", e);
          toast({ variant: "destructive", title: "Profile Error", description: "Could not load your profile."});
        }
      } else {
        // This case means user is "logged in" via activeUsername but profile is missing.
        // Might happen if localStorage was cleared partially.
         toast({ variant: "destructive", title: "Profile Not Found", description: "Please log in again via the main app."});
      }

      // Attempt to find a different user to be the recipient for the message
      // This logic is basic and assumes mockUsers is representative or a placeholder.
      const otherMockUser = mockUsers.find(u => u.name.toLowerCase() !== activeUsername.toLowerCase());
      if (otherMockUser) {
        setRecipientName(otherMockUser.name);
      } else if (userFromStorage && mockUsers.length > 0 && mockUsers[0].id !== userFromStorage.id) {
        setRecipientName(mockUsers[0].name);
      } else if (mockUsers.length > 1) {
        // Fallback if current user is the first mock user and no other distinct user found
        setRecipientName(mockUsers[1].name); 
      } else if (mockUsers.length === 1 && mockUsers[0].id !== userFromStorage?.id) {
        // Only one mock user, and it's not the current user (edge case)
        setRecipientName(mockUsers[0].name);
      } else {
        // Default if no other user can be easily determined
        setRecipientName("your friend");
      }

      // For now, this is a UI confirmation and a toast.
      // In a real app, this might make an API call or update shared state.
      toast({
        title: "Ping Sent! (Mock)",
        description: `A "Thinking of You" message for ${recipientName} has been noted!`,
        duration: 4000,
      });
      console.log(`Action: Thinking of You ping triggered for ${recipientName} by ${activeUsername}.`);

    } else {
      setIsLoggedIn(false);
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first to send a ping.",
        duration: 5000,
      });
    }
  }, [toast]); // Removed recipientName from dependency array to avoid re-triggering toast on recipientName change

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Heart className="w-16 h-16 text-primary animate-pulse-subtle" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Thinking of You</CardTitle>
          {isLoggedIn && currentUser ? (
            <CardDescription className="text-muted-foreground">
              You've sent a "Thinking of You" ping to {recipientName}. They'll appreciate it!
            </CardDescription>
          ) : (
            <CardDescription className="text-muted-foreground">
              Log in to ChirpChat to send a "Thinking of You" ping.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          {isLoggedIn ? (
            <p className="text-sm">This quick action helps you connect with {recipientName} instantly.</p>
          ) : (
            <p className="text-red-600 py-2">Please open ChirpChat and log in to use this feature.</p>
          )}
          <Button onClick={() => router.push(isLoggedIn ? '/chat' : '/')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isLoggedIn ? "Back to Chat" : "Go to Login"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
