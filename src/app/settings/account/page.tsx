
"use client";

import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { useAvatar } from '@/hooks/useAvatar';
import { MAX_AVATAR_SIZE_KB } from '@/config/app-config';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Camera, User as UserIcon, Mail } from 'lucide-react';
import SettingsHeader from '@/components/settings/SettingsHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import type { User, PasswordChangeRequest } from '@/types';


// Zod schemas for validation
const profileFormSchema = z.object({
  display_name: z.string().min(2, { message: "Display name must be at least 2 characters." }).max(50, { message: "Display name must be less than 50 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }).or(z.literal('')),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

const passwordFormSchema = z.object({
    current_password: z.string().min(1, "Please enter your current password."),
    new_password: z.string().min(8, "New password must be at least 8 characters."),
}).refine(data => data.current_password !== data.new_password, {
    message: "New password must be different from the current one.",
    path: ["new_password"],
});
type PasswordFormValues = z.infer<typeof passwordFormSchema>;


export default function AccountSettingsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { currentUser, isLoading: isAuthLoading, fetchAndUpdateUser } = useAuth();
    
    const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [partner, setPartner] = useState<User | null>(null);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const { avatarPreview, handleFileChange: onFileChange, setAvatarPreview } = useAvatar({ maxSizeKB: MAX_AVATAR_SIZE_KB, toast });

    const profileForm = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            display_name: '',
            email: '',
        },
    });
    
    useEffect(() => {
        if (currentUser) {
            profileForm.reset({
                display_name: currentUser.display_name || '',
                email: currentUser.email || '',
            });
            setAvatarPreview(currentUser.avatar_url);
        }
    }, [currentUser, profileForm, setAvatarPreview]);

    const passwordForm = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: { current_password: '', new_password: '' },
    });

    // Effect to fetch partner details
    useEffect(() => {
        if (currentUser?.partner_id) {
            api.getUserProfile(currentUser.partner_id).then(setPartner).catch(console.error);
        }
    }, [currentUser?.partner_id]);

    const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        onFileChange(e, currentUser?.avatar_url || undefined);
    };

    const handleProfileSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
        setIsSubmittingProfile(true);
        try {
            // Handle avatar upload if a new one is staged
            if (avatarInputRef.current?.files?.[0]) {
                await api.uploadAvatar(avatarInputRef.current.files[0], () => {}); // progress handler is optional
            }
            
            // Handle profile data update
            await api.updateUserProfile({ display_name: data.display_name, email: data.email || undefined });

            await fetchAndUpdateUser();
            toast({ title: 'Profile Updated', description: 'Your profile has been saved successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsSubmittingProfile(false);
        }
    };
    
    const handlePasswordSubmit: SubmitHandler<PasswordFormValues> = async (data) => {
        setIsSubmittingPassword(true);
        try {
            await api.changePassword(data);
            toast({ title: 'Password Changed', description: 'Your password has been updated.' });
            passwordForm.reset();
            document.getElementById('close-password-dialog')?.click();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSubmittingPassword(false);
        }
    };
    
    const handleDisconnectPartner = async () => {
        setIsDisconnecting(true);
        try {
            await api.disconnectPartner();
            toast({ title: 'Partner Disconnected', description: 'You are no longer partners.' });
            await fetchAndUpdateUser(); 
            router.push('/onboarding/find-partner');
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsDisconnecting(false);
        }
    }

    if (isAuthLoading || !currentUser) {
        return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="min-h-screen bg-muted/40 pb-16">
            <SettingsHeader title="Account & Security" />
            <main className="max-w-3xl mx-auto space-y-6 p-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Edit Profile</CardTitle>
                        <CardDescription>Update your avatar, display name, and email.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...profileForm}>
                            <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                                <div className="flex items-center gap-4">
                                     <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                                     <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative group flex-shrink-0">
                                         <Avatar className="w-20 h-20">
                                            <AvatarImage src={avatarPreview || undefined} alt={currentUser.display_name} />
                                            <AvatarFallback className="text-3xl">{currentUser.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Camera size={24} />
                                        </div>
                                     </button>
                                     <FormField
                                        control={profileForm.control}
                                        name="display_name"
                                        render={({ field }) => (
                                            <FormItem className="flex-grow">
                                                <FormLabel>Display Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Your display name" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={profileForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="your@email.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSubmittingProfile}>
                                    {isSubmittingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Security</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline">Change Password</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Change Your Password</DialogTitle></DialogHeader>
                                <Form {...passwordForm}>
                                    <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                                         <FormField control={passwordForm.control} name="current_password" render={({ field }) => (<FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                         <FormField control={passwordForm.control} name="new_password" render={({ field }) => (<FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                         <DialogFooter>
                                            <DialogClose asChild><Button id="close-password-dialog" type="button" variant="ghost">Cancel</Button></DialogClose>
                                            <Button type="submit" disabled={isSubmittingPassword}>
                                                 {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Update Password
                                            </Button>
                                         </DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>Manage Partner</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {partner ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={partner.avatar_url || undefined} />
                                        <AvatarFallback>{partner.display_name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{partner.display_name}</span>
                                </div>
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="destructive" disabled={isDisconnecting}>Disconnect</Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will end your partnership. You will both be able to find new partners.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDisconnectPartner}>Disconnect</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-4">
                                <p>You are not currently partnered.</p>
                                <Button variant="link" onClick={() => router.push('/onboarding/find-partner')}>Find a Partner</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

    
