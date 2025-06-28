"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Loader2, ChevronRight, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SettingsHeader from '@/components/settings/SettingsHeader';
import { api } from '@/services/api';

const SettingsItemButton = ({ children, onClick, destructive=false, ...props }: { children: React.ReactNode, onClick?: () => void, destructive?: boolean, disabled?: boolean }) => {
    return (
         <button onClick={onClick} className={`flex items-center justify-between py-3 w-full text-left hover:bg-muted/50 -mx-4 px-4 rounded-lg ${destructive ? 'text-destructive hover:bg-destructive/10' : ''} disabled:opacity-50 disabled:cursor-not-allowed`} {...props}>
            {children}
        </button>
    );
};
const SettingsItem = ({ children }: { children: React.ReactNode }) => {
    return <div className="flex items-center justify-between py-4">{children}</div>;
};

export default function PrivacySettingsPage() {
    const { currentUser, isLoading: isAuthLoading, logout } = useAuth();
    const { toast } = useToast();

    const [readReceipts, setReadReceipts] = useState(true);
    const [aiSuggestions, setAiSuggestions] = useState(true);
    
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [reAuthPassword, setReAuthPassword] = useState('');
    const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    
    const handleFinalDeleteAccount = () => {
        console.log("Final account deletion initiated. Password:", reAuthPassword);
        toast({title: "Account Deletion Initiated", description: "This is a mock action. No data was deleted."});
        setIsReAuthModalOpen(false);
        setReAuthPassword('');
        logout();
    };

    if (isAuthLoading || !currentUser) {
        return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="min-h-screen bg-muted/40 pb-16">
            <SettingsHeader title="Privacy & Data" />
            <main className="max-w-3xl mx-auto space-y-6 p-4">
                 <Card>
                    <CardContent className="divide-y p-4">
                         <SettingsItem>
                            <Label htmlFor="read-receipts-toggle">Read Receipts</Label>
                            <Switch id="read-receipts-toggle" checked={readReceipts} onCheckedChange={setReadReceipts}/>
                        </SettingsItem>
                        <SettingsItem>
                            <Label htmlFor="ai-suggestions-toggle">AI Mood Suggestions</Label>
                            <Switch id="ai-suggestions-toggle" checked={aiSuggestions} onCheckedChange={setAiSuggestions} />
                        </SettingsItem>
                         <SettingsItemButton onClick={() => toast({title: "Coming Soon!", description: "Conversation export will be available in a future update."})}>
                            <div className="font-medium flex items-center gap-2"><FileText/> Export Conversation</div>
                            <ChevronRight className="text-muted-foreground" />
                        </SettingsItemButton>
                         
                         <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                            <AlertDialogTrigger asChild>
                               <SettingsItemButton destructive>
                                    <div className="font-medium flex items-center gap-2"><Trash2/> Delete Account</div>
                                    <ChevronRight/>
                                </SettingsItemButton>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete your account, messages, and all data. To confirm, type "DELETE" below.</AlertDialogDescription></AlertDialogHeader>
                                <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="DELETE" />
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => { setIsDeleteConfirmOpen(false); setIsReAuthModalOpen(true); }} disabled={deleteConfirmText !== 'DELETE'}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </main>
            
            <AlertDialog open={isReAuthModalOpen} onOpenChange={setIsReAuthModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Final Step: Re-authenticate to Delete</AlertDialogTitle><AlertDialogDescription>For your security, please enter your password to permanently delete your account.</AlertDialogDescription></AlertDialogHeader>
                    <Input type="password" placeholder="Enter your password" value={reAuthPassword} onChange={e => setReAuthPassword(e.target.value)} />
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setReAuthPassword('')}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleFinalDeleteAccount} disabled={!reAuthPassword}>Delete My Account Forever</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}