
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, ChevronRight, User, Bell, Palette, Shield, LogOut } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import FullPageLoader from '@/components/common/FullPageLoader';

const SettingsLink = ({ href, icon, title, description }: { href: string; icon: React.ElementType; title: string; description: string }) => {
    const Icon = icon;
    return (
        <Link href={href} className="flex items-center p-4 -mx-4 rounded-lg hover:bg-muted/50 transition-colors group">
            <div className="p-3 bg-muted group-hover:bg-primary/10 rounded-lg mr-4 transition-colors">
                <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-grow">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
    );
};


export default function SettingsHubPage() {
    const { currentUser, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            router.replace('/');
        }
    }, [isAuthLoading, isAuthenticated, router]);

    if (isAuthLoading || !currentUser) {
        return <FullPageLoader />;
    }

    return (
        <div className="min-h-screen bg-muted/40">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Back</span>
                    </Button>
                </div>
                <h1 className="text-lg font-semibold text-foreground absolute left-1/2 -translate-x-1/2">Settings</h1>
            </header>
            <main className="p-4 max-w-3xl mx-auto">
                {/* Profile Section */}
                <div className="flex flex-col items-center my-8">
                    <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-md">
                        <AvatarImage src={currentUser.avatar_url || undefined} alt={currentUser.display_name} />
                        <AvatarFallback className="text-3xl">{currentUser.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h2 className="text-2xl font-bold text-foreground">{currentUser.display_name}</h2>
                    <p className="text-muted-foreground">{currentUser.phone}</p>
                </div>

                {/* Navigation Links */}
                <Card>
                    <CardContent className="p-2 divide-y">
                       <SettingsLink 
                            href="/settings/account"
                            icon={User}
                            title="Account & Security"
                            description="Profile, password, partner"
                       />
                        <SettingsLink 
                            href="/settings/notifications"
                            icon={Bell}
                            title="Notifications"
                            description="Push, quiet hours, sounds"
                       />
                       <SettingsLink 
                            href="/settings/appearance"
                            icon={Palette}
                            title="Appearance"
                            description="Theme, text size, backgrounds"
                       />
                       <SettingsLink 
                            href="/settings/privacy"
                            icon={Shield}
                            title="Privacy & Data"
                            description="Receipts, history, account data"
                       />
                    </CardContent>
                </Card>

                 <Card className="mt-6">
                    <CardContent className="p-2">
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button className="flex items-center justify-between py-3 w-full text-left hover:bg-destructive/10 -mx-2 px-4 rounded-lg text-destructive">
                                    <div className="flex items-center gap-3 font-medium"><LogOut /> Logout</div>
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>You will be returned to the login screen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={logout}>Logout</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
