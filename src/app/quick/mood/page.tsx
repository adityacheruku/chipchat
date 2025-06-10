
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SmilePlus, Loader2 } from 'lucide-react';
import type { Mood, User } from '@/types';
import { ALL_MOODS } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

export default function QuickMoodPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: isAuthLoading, isAuthenticated, fetchAndUpdateUser } = useAuth();
  
  const [selectedMood, setSelectedMood] = useState<Mood | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    console.log("Action: Set My Mood triggered via PWA shortcut.");
    if (!isAuthLoading && !isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first to set your mood.",
        duration: 5000,
      });
      router.replace('/'); // Use replace to prevent back navigation to this page
      return;
    }
    if (currentUser) {
      setSelectedMood(currentUser.mood); 
    }
  }, [isAuthLoading, isAuthenticated, currentUser, router, toast]);

  const handleSetMood = async () => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Error", description: "User profile not loaded." });
      return;
    }
    if (!selectedMood) {
      toast({ variant: "destructive", title: "No Mood Selected", description: "Please select a mood." });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.updateUserProfile({ mood: selectedMood });
      await fetchAndUpdateUser(); // Update context
      toast({
        title: "Mood Updated!",
        description: `Your mood has been set to: ${selectedMood}.`,
        duration: 4000,
      });
      router.push('/chat');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoadingPage = isAuthLoading || (isAuthenticated && !currentUser);

  if (isLoadingPage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-foreground">Loading your mood settings...</p>
      </main>
    );
  }
  
  if (!isAuthenticated || !currentUser) {
    // This case should ideally be handled by the useEffect redirect, but as a fallback:
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 py-4">Please log in via the main ChirpChat app to use this feature.</p>
            <Button onClick={() => router.push('/')} className="w-full" variant="outline">
              Go to Login
            </Button>
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
            <SmilePlus className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Set Your Mood</CardTitle>
          <CardDescription className="text-muted-foreground">
            Hi {currentUser.display_name}, how are you feeling?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          
          <Select value={selectedMood} onValueChange={(value) => setSelectedMood(value as Mood)} disabled={isSubmitting}>
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

          <Button onClick={handleSetMood} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!selectedMood || isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Set Mood & Go to Chat"}
          </Button>
          <Button onClick={() => router.push('/chat')} className="w-full" variant="outline" disabled={isSubmitting}>
            Cancel & Go to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
