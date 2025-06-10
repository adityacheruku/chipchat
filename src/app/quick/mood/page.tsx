
// src/app/quick/mood/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import type { Mood, User } from '@/types';
import { ALL_MOODS } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast'; // Import useToast

export default function QuickMoodPage() {
  const router = useRouter();
  const { toast } = useToast(); // Initialize toast
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("Action: Set My Mood triggered via PWA shortcut.");
    const activeUsername = localStorage.getItem('chirpChatActiveUsername');
    if (!activeUsername) {
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first to set your mood.",
      });
      setIsLoading(false);
      // Consider redirecting to login: router.push('/');
      return;
    }

    const userProfileKey = `chirpChatUserProfile_${activeUsername}`;
    const storedProfileJson = localStorage.getItem(userProfileKey);

    if (storedProfileJson) {
      try {
        const user = JSON.parse(storedProfileJson) as User;
        setCurrentUser(user);
        setSelectedMood(user.mood); // Pre-select current mood
      } catch (error) {
        console.error("Failed to parse stored user profile:", error);
        toast({
          variant: "destructive",
          title: "Profile Error",
          description: "Could not load your profile.",
        });
      }
    } else {
       toast({
        variant: "destructive",
        title: "Profile Not Found",
        description: "Your profile was not found. Please log in again via the main app.",
      });
    }
    setIsLoading(false);
  }, [toast, router]);

  const handleSetMood = () => {
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User profile not loaded. Cannot set mood.",
      });
      return;
    }
    if (selectedMood) {
      const updatedUser = { ...currentUser, mood: selectedMood, lastSeen: Date.now() };
      const userProfileKey = `chirpChatUserProfile_${currentUser.name}`; // Use original name for key consistency
      localStorage.setItem(userProfileKey, JSON.stringify(updatedUser));
      
      toast({
        title: "Mood Updated!",
        description: `Your mood has been set to: ${selectedMood}.`,
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

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <p className="text-foreground">Loading your mood...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Smile className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Set Your Mood</CardTitle>
          <CardDescription className="text-muted-foreground">
            {currentUser ? `Hi ${currentUser.name}, how are you feeling?` : "How are you feeling right now?"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p>This page was accessed via a PWA shortcut.</p>
          
          <Select value={selectedMood} onValueChange={(value) => setSelectedMood(value as Mood)} disabled={!currentUser}>
            <SelectTrigger className="w-full bg-card focus:ring-primary">
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

          <Button onClick={handleSetMood} className="w-full" disabled={!selectedMood || !currentUser}>
            Set Mood & Go to Chat
          </Button>
          <Button onClick={() => router.push('/chat')} className="w-full" variant="outline">
            Cancel
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
