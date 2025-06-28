
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import type { User, PartnerRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus, Mail, Share2, Check, X, BellRing, Send, Clock, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function FindPartnerPage() {
    const { currentUser, isLoading: isAuthLoading, isAuthenticated, fetchAndUpdateUser, logout } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<PartnerRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<PartnerRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [suggestionsRes, incomingRequestsRes, outgoingRequestsRes] = await Promise.all([
                api.getPartnerSuggestions(),
                api.getIncomingRequests(),
                api.getOutgoingRequests()
            ]);
            setSuggestions(suggestionsRes.users);
            setIncomingRequests(incomingRequestsRes.requests);
            setOutgoingRequests(outgoingRequestsRes.requests);
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
            // Refresh all data to reflect the new state
            fetchData();
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
                await fetchAndUpdateUser(); // This will update context and trigger redirect via useEffect
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
        const inviteMessage = `Hey! I’m using this app made for just two people to stay emotionally connected. I’d love to connect with you here 💌. Join me → ${window.location.origin}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join me on ChirpChat!',
                    text: inviteMessage,
                    url: window.location.origin,
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            // Fallback for browsers that don't support Web Share API
            navigator.clipboard.writeText(inviteMessage);
            toast({ description: "Web Share API not supported. Invite text copied to clipboard!" });
        }
    };

    if (isAuthLoading || isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    const filteredSuggestions = suggestions.filter(user => 
        user.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background relative">
             <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                aria-label="Log out"
            >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
            </Button>
            <Card className="w-full max-w-lg shadow-xl mt-16 sm:mt-0">
                <CardHeader>
                    <CardTitle className="text-center">Choose Your Partner</CardTitle>
                    <CardDescription className="text-center">
                        This is a space for just the two of you. Pick one person you'd love to stay emotionally connected with.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Incoming Requests Section */}
                    {incomingRequests.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><BellRing className="text-accent"/> Incoming Requests</h3>
                            <ul className="space-y-3">
                                {incomingRequests.map(req => (
                                    <li key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
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
                    
                     {/* Outgoing/Pending Requests Section */}
                    {outgoingRequests.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><Clock className="text-accent"/> Pending Requests</h3>
                            <ul className="space-y-3">
                                {outgoingRequests.map(req => (
                                    <li key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={req.recipient.avatar_url || undefined} />
                                                <AvatarFallback>{req.recipient.display_name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{req.recipient.display_name}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground italic">Waiting for response...</p>
                                    </li>
                                ))}
                            </ul>
                            <Separator />
                        </div>
                    )}


                    {/* Suggestions Section */}
                    <div className="space-y-4">
                         <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><UserPlus className="text-accent"/>Find a Partner</h3>
                         <div className="relative">
                            <Input
                                placeholder="Search by name"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 bg-input"
                            />
                         </div>
                        {filteredSuggestions.length > 0 ? (
                             <ul className="space-y-3 max-h-60 overflow-y-auto p-1">
                                {filteredSuggestions.map(user => (
                                    <li key={user.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={user.avatar_url || undefined} />
                                                <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                               <span className="font-medium">{user.display_name}</span>
                                               <span className="text-xs text-green-600">✅ Already on app</span>
                                            </div>
                                        </div>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="default" disabled={isSubmitting}>
                                                    <Mail className="mr-2 h-4 w-4"/>
                                                    Request
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="flex items-center gap-4">
                                                        <Avatar className="w-16 h-16">
                                                            <AvatarImage src={user.avatar_url || undefined} />
                                                            <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        Send a partner request to {user.display_name}?
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        They will be notified and can choose to accept your request. Once they accept, you will become partners.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleSendRequest(user.id)}>
                                                        <Send className="mr-2 h-4 w-4"/>
                                                        Send Request
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-muted-foreground text-sm p-4 bg-muted/50 rounded-md">No available users found matching your search. Try inviting someone!</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Button onClick={handleInvite} className="fixed bottom-10 right-10 rounded-full h-14 w-14 shadow-lg bg-accent hover:bg-accent/90">
                <Share2 className="h-6 w-6 text-accent-foreground"/>
                <span className="sr-only">Invite via Link</span>
            </Button>
        </div>
    );
}
