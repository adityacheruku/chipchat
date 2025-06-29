
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Smile, Frown, Meh, PartyPopper, Brain, Glasses, Angry, HelpCircle, SmilePlus } from 'lucide-react';
import type { Mood } from '@/types';
import { ALL_MOODS } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import Spinner from '@/components/common/Spinner';
import FullPageLoader from '@/components/common/FullPageLoader';

const moodIcons: Record<string, React.ElementType> = {
  Happy: Smile,
  Sad: Frown,
  Neutral: Meh,
  Excited: PartyPopper,
  Thoughtful: Brain,
  Chilling: Glasses,
  Angry: Angry,
  Anxious: HelpCircle,
  Content: Smile,
};


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
        description: "Please log in to Kuchlu first to set your mood.",
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
    if (!selectedMood || selectedMood.trim().length === 0) {
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
    return <FullPageLoader />;
  }
  
  if (!isAuthenticated || !currentUser) {
    // This case should ideally be handled by the useEffect redirect, but as a fallback:
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary text-center">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 py-4">Please log in via the main Kuchlu app to use this feature.</p>
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
          <CardTitle className="text-2xl font-headline text-primary text-center">Set Your Mood</CardTitle>
          <CardDescription className="text-center">
            Hi {currentUser.display_name}, how are you feeling?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {ALL_MOODS.map(mood => {
                const Icon = moodIcons[mood] || Smile;
                return (
                  <Button
                    key={mood}
                    variant={selectedMood === mood ? 'default' : 'outline'}
                    onClick={() => setSelectedMood(mood)}
                    className={cn(
                      'flex items-center justify-center gap-2 h-12',
                      selectedMood === mood && 'bg-primary text-primary-foreground hover:bg-primary/90'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{mood}</span>
                  </Button>
                );
              })}
            </div>
             <Input
                id="custom-mood"
                placeholder="Or type a custom mood..."
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="bg-card focus:ring-primary text-center"
              />
          </div>

          <Button onClick={handleSetMood} className="w-full" disabled={!selectedMood || isSubmitting}>
            {isSubmitting ? <Spinner /> : "Set Mood & Go to Chat"}
          </Button>
          <Button onClick={() => router.push('/chat')} className="w-full" variant="outline" disabled={isSubmitting}>
            Cancel & Go to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
