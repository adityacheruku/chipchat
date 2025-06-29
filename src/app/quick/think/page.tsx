
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Loader2 } from 'lucide-react';
import type { User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

export default function QuickThinkPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  
  const [partner, setPartner] = useState<User | null>(null);
  const [isLoadingPartner, setIsLoadingPartner] = useState(true);
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
      const fetchPartnerAndPing = async () => {
        setIsLoadingPartner(true);
        try {
          if (!currentUser.partner_id) {
            throw new Error("You don't have a partner to send a ping to.");
          }
          const partnerDetails = await api.getUserProfile(currentUser.partner_id);
          setPartner(partnerDetails);
          await api.sendThinkingOfYouPing(partnerDetails.id);
          toast({
            title: "Ping Sent!",
            description: `You let ${partnerDetails.display_name} know you're thinking of them!`,
            duration: 4000,
          });
          setPingSent(true);
          console.log(`Action: Thinking of You ping sent to ${partnerDetails.display_name} by ${currentUser.display_name}.`);
        } catch (error: any) {
          toast({ variant: "destructive", title: "Ping Failed", description: error.message });
          setPingSent(false);
        } finally {
          setIsLoadingPartner(false);
        }
      };
      fetchPartnerAndPing();
    }
  }, [isAuthLoading, isAuthenticated, currentUser, router, toast]);

  const isLoadingPage = isAuthLoading || (isAuthenticated && isLoadingPartner && !pingSent);

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
            <CardTitle className="text-2xl font-headline text-primary text-center">Access Denied</CardTitle>
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
            <Heart className={cn("w-16 h-16 text-primary", pingSent && 'animate-pulse-subtle')} />
          </div>
          <CardTitle className="text-2xl font-headline text-primary text-center">Thinking of You</CardTitle>
          {pingSent && partner ? (
            <CardDescription className="text-center">
              You've sent a "Thinking of You" ping to {partner.display_name}. They'll appreciate it!
            </CardDescription>
          ) : !isLoadingPartner && !partner ? (
             <CardDescription className="text-destructive text-center">
              Could not find a partner for your ping.
            </CardDescription>
          ) : (
            <CardDescription className="text-center">
              Something went wrong, or recipient could not be determined.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This page was accessed via a PWA shortcut.</p>
          <Button onClick={() => router.push('/chat')} className="w-full">
            Back to Chat
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
