
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Loader2 } from 'lucide-react';
import type { User, DefaultChatPartnerResponse } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

export default function QuickThinkPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  
  const [recipient, setRecipient] = useState<DefaultChatPartnerResponse | null>(null);
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(true);
  const [pingSent, setPingSent] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "Please log in to ChirpChat first to send a ping.",
        duration: 5000,
      });
      router.replace('/');
      return;
    }

    if (isAuthenticated && currentUser) {
      const fetchRecipientAndPing = async () => {
        setIsLoadingRecipient(true);
        try {
          const partner = await api.getDefaultChatPartner();
          if (partner) {
            setRecipient(partner);
            await api.sendThinkingOfYouPing(partner.user_id);
            toast({
              title: "Ping Sent!",
              description: `You let ${partner.display_name} know you're thinking of them!`,
              duration: 4000,
            });
            setPingSent(true);
            console.log(`Action: Thinking of You ping sent to ${partner.display_name} by ${currentUser.display_name}.`);
          } else {
            toast({ variant: "destructive", title: "No Recipient", description: "Could not determine who to send the ping to." });
            setPingSent(false); // Explicitly false
          }
        } catch (error: any) {
          toast({ variant: "destructive", title: "Ping Failed", description: error.message });
          setPingSent(false);
        } finally {
          setIsLoadingRecipient(false);
        }
      };
      fetchRecipientAndPing();
    }
  }, [isAuthLoading, isAuthenticated, currentUser, router, toast]);

  const isLoadingPage = isAuthLoading || (isAuthenticated && isLoadingRecipient && !pingSent);

  if (isLoadingPage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-foreground">Sending your ping...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
     return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 py-4">Please log in via the main ChirpChat app to use this feature.</p>
            <Button onClick={() => router.push('/')} className="w-full" variant="outline">Go to Login</Button>
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
            <Heart className={`w-16 h-16 text-primary ${pingSent ? 'animate-pulse-subtle' : ''}`} />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Thinking of You</CardTitle>
          {pingSent && recipient ? (
            <CardDescription className="text-muted-foreground">
              You've sent a "Thinking of You" ping to {recipient.display_name}. They'll appreciate it!
            </CardDescription>
          ) : !isLoadingRecipient && !recipient ? (
             <CardDescription className="text-destructive">
              Could not find a recipient for your ping.
            </CardDescription>
          ) : (
            <CardDescription className="text-muted-foreground">
              Something went wrong, or recipient could not be determined.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          <Button onClick={() => router.push('/chat')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Back to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
