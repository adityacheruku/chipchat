"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronRight, LogOut } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import SettingsHeader from '@/components/settings/SettingsHeader';

const SettingsItemButton = ({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) => {
    return (
         <button onClick={onClick} className="flex items-center justify-between py-3 w-full text-left hover:bg-muted/50 -mx-4 px-4 rounded-lg">
            {children}
        </button>
    );
};


export default function AccountSettingsPage() {
    const { currentUser, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    if (isAuthLoading || !currentUser) {
        return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="min-h-screen bg-muted/40">
            <SettingsHeader title="Account & Security" />
            <main className="max-w-3xl mx-auto space-y-6 p-4">
                 <Card>
                    <CardContent className="divide-y p-4">
                       <SettingsItemButton><div className="font-medium">Edit Profile</div><ChevronRight className="text-muted-foreground" /></SettingsItemButton>
                       <SettingsItemButton><div className="font-medium">Change Password</div><ChevronRight className="text-muted-foreground" /></SettingsItemButton>
                       <SettingsItemButton><div className="font-medium">Manage Partner</div><ChevronRight className="text-muted-foreground" /></SettingsItemButton>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
