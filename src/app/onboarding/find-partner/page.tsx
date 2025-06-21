
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { User, PartnerRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserPlus, Mail, Share2, Check, X, BellRing } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function FindPartnerPage() {
    const { currentUser, isLoading: isAuthLoading, isAuthenticated, fetchAndUpdateUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<PartnerRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [suggestionsRes, requestsRes] = await Promise.all([
                api.getPartnerSuggestions(),
                api.getIncomingRequests()
            ]);
            setSuggestions(suggestionsRes.users);
            setIncomingRequests(requestsRes.requests);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to load data: ${error.message}` });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            router.push('/');
            return;
        }
        if (currentUser?.partner_id) {
            router.push('/chat');
            return;
        }
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthLoading, isAuthenticated, currentUser, router, fetchData]);

    const handleSendRequest = async (recipientId: string) => {
        setIsSubmitting(true);
        try {
            await api.sendPartnerRequest(recipientId);
            toast({ title: 'Request Sent!', description: 'Your partner request has been sent.' });
            // Refresh suggestions to remove the user you just sent a request to
            setSuggestions(prev => prev.filter(user => user.id !== recipientId));
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRespondToRequest = async (requestId: string, action: 'accept' | 'reject') => {
        setIsSubmitting(true);
        try {
            await api.respondToPartnerRequest(requestId, action);
            if (action === 'accept') {
                toast({ title: 'Partner Accepted!', description: 'You are now partners. Redirecting to chat...' });
                await fetchAndUpdateUser(); // This will update context with partner_id
                router.push('/chat');
            } else {
                toast({ title: 'Request Rejected', description: 'The request has been rejected.' });
                setIncomingRequests(prev => prev.filter(req => req.id !== requestId));
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInvite = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join me on ChirpChat!',
                    text: `Let's connect on ChirpChat. Here is my invite link:`,
                    url: window.location.origin, // You can add referral codes here
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            toast({ description: "Web Share API not supported on your browser. You can copy the link manually." });
        }
    };

    if (isAuthLoading || isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-headline text-primary">Find Your Partner</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Connect with your partner to start chatting.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Incoming Requests Section */}
                    {incomingRequests.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><BellRing className="text-accent"/> Incoming Requests</h3>
                            <ul className="space-y-3">
                                {incomingRequests.map(req => (
                                    <li key={req.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={req.sender.avatar_url || undefined} />
                                                <AvatarFallback>{req.sender.display_name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{req.sender.display_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="icon" variant="outline" className="text-green-500 hover:bg-green-100 hover:text-green-600" onClick={() => handleRespondToRequest(req.id, 'accept')} disabled={isSubmitting}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="outline" className="text-red-500 hover:bg-red-100 hover:text-red-600" onClick={() => handleRespondToRequest(req.id, 'reject')} disabled={isSubmitting}>
                                                <X className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <Separator />
                        </div>
                    )}

                    {/* Suggestions Section */}
                    <div className="space-y-4">
                         <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><UserPlus className="text-accent"/>Find a Partner</h3>
                        {suggestions.length > 0 ? (
                             <ul className="space-y-3 max-h-60 overflow-y-auto p-1">
                                {suggestions.map(user => (
                                    <li key={user.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={user.avatar_url || undefined} />
                                                <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{user.display_name}</span>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => handleSendRequest(user.id)} disabled={isSubmitting}>
                                            <Mail className="mr-2 h-4 w-4"/>
                                            Request
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-muted-foreground text-sm p-4 bg-muted rounded-md">No available users found. Try inviting someone!</p>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                    <Separator/>
                     <p className="text-sm text-muted-foreground">Can't find your partner?</p>
                    <Button onClick={handleInvite} className="w-full bg-primary hover:bg-primary/90">
                        <Share2 className="mr-2 h-4 w-4"/>
                        Invite a Friend
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}