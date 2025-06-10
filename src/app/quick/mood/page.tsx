
// src/app/quick/mood/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SmilePlus } from 'lucide-react'; // Changed icon for more "set mood" feel
import type { Mood, User } from '@/types';
import { ALL_MOODS } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function QuickMoodPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    console.log("Action: Set My Mood triggered via PWA shortcut.");
    const activeUsername = localStorage.getItem('chirpChatActiveUsername');
    if (!activeUsername) {
      setIsLoggedIn(false);
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first to set your mood.",
        duration: 5000,
      });
      setIsLoading(false);
      return;
    }
    setIsLoggedIn(true);

    const userProfileKey = `chirpChatUserProfile_${activeUsername}`;
    const storedProfileJson = localStorage.getItem(userProfileKey);

    if (storedProfileJson) {
      try {
        const user = JSON.parse(storedProfileJson) as User;
        setCurrentUser(user);
        setSelectedMood(user.mood); 
      } catch (error) {
        console.error("Failed to parse stored user profile:", error);
        toast({
          variant: "destructive",
          title: "Profile Error",
          description: "Could not load your profile. Try logging in via the main app.",
        });
        setCurrentUser(null); // Ensure currentUser is null on error
      }
    } else {
       toast({
        variant: "destructive",
        title: "Profile Not Found",
        description: "Your profile was not found. Please log in again via the main app.",
      });
       setCurrentUser(null);
    }
    setIsLoading(false);
  }, [toast]);

  const handleSetMood = () => {
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User profile not loaded or found. Cannot set mood. Please log in via the main app.",
      });
      return;
    }
    if (!isLoggedIn) {
       toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first.",
      });
      return;
    }
    if (selectedMood) {
      const originalLoginUsername = localStorage.getItem('chirpChatActiveUsername');
      if (!originalLoginUsername) { // Should not happen if isLoggedIn is true, but defensive check
          toast({ variant: "destructive", title: "Critical Error", description: "Active username not found."});
          return;
      }
      const updatedUser = { ...currentUser, mood: selectedMood, lastSeen: Date.now() };
      const userProfileKey = `chirpChatUserProfile_${originalLoginUsername}`; 
      localStorage.setItem(userProfileKey, JSON.stringify(updatedUser));
      
      toast({
        title: "Mood Updated!",
        description: `Your mood has been set to: ${selectedMood}. This will reflect in the chat.`,
        duration: 4000,
      });
      router.push('/chat');
    } else {
      toast({
        variant: "destructive",
        title: "No Mood Selected",
        description: "Please select a mood first.",
      });
    }
  };

  if (isLoading && isLoggedIn) { // Only show global loading if we expect to load a profile
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <SmilePlus className="w-12 h-12 text-primary animate-pulse mb-4" />
        <p className="text-foreground">Loading your mood settings...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <SmilePlus className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Set Your Mood</CardTitle>
          <CardDescription className="text-muted-foreground">
            {currentUser && isLoggedIn ? `Hi ${currentUser.name}, how are you feeling?` : 
             isLoggedIn ? "Loading your profile..." : "Log in to ChirpChat to set your mood."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          
          {isLoggedIn ? (
            <>
              <Select value={selectedMood} onValueChange={(value) => setSelectedMood(value as Mood)} disabled={!currentUser || isLoading}>
                <SelectTrigger className="w-full bg-card focus:ring-primary text-foreground">
                  <SelectValue placeholder="Select your mood" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_MOODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleSetMood} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!selectedMood || !currentUser || isLoading}>
                Set Mood & Go to Chat
              </Button>
            </>
          ) : (
            <p className="text-red-600 py-4">Please open ChirpChat and log in to use this feature.</p>
          )}
          <Button onClick={() => router.push(isLoggedIn && currentUser ? '/chat' : '/')} className="w-full" variant="outline">
            {isLoggedIn && currentUser ? "Cancel & Go to Chat" : "Go to Login"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
