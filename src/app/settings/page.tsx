
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { NotificationSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ArrowLeft, User, Bell, Palette, Lock, Shield, BrainCircuit, LogOut, Trash2, FileText, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function SettingsItem({ children }: { children: React.ReactNode }) {
    return <div className="flex items-center justify-between py-3">{children}</div>;
}

export default function SettingsPage() {
    const { currentUser, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();
    const { isSubscribed, notificationSettings, updateNotificationSettings, isSubscribing, isPushApiSupported, permissionStatus, subscribeToPush, unsubscribeFromPush } = usePushNotifications();
    const router = useRouter();
    const { toast } = useToast();

    // State for settings
    const [localNotificationSettings, setLocalNotificationSettings] = useState<Partial<NotificationSettings>>({});
    const [theme, setTheme] = useState('system');
    const [textSize, setTextSize] = useState([16]);
    const [dynamicBackgrounds, setDynamicBackgrounds] = useState(true);
    const [readReceipts, setReadReceipts] = useState(true);
    const [aiSuggestions, setAiSuggestions] = useState(true);

    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [reAuthPassword, setReAuthPassword] = useState('');
    const [isReAuthModalOpen, setIsReAuthModalOpen] = useState(false);

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            router.replace('/');
        }
    }, [isAuthLoading, isAuthenticated, router]);

    useEffect(() => {
        if (notificationSettings) {
            setLocalNotificationSettings(notificationSettings);
        }
    }, [notificationSettings]);
    
    useEffect(() => {
        const storedTheme = window.localStorage.getItem('theme') || 'system';
        setTheme(storedTheme);
        document.documentElement.classList.remove('light', 'dark');
        if (storedTheme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.classList.add(systemTheme);
        } else {
            document.documentElement.classList.add(storedTheme);
        }
    }, []);

    const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.remove('light', 'dark');
         if (newTheme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.classList.add(systemTheme);
        } else {
            document.documentElement.classList.add(newTheme);
        }
    };


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

    const masterNotificationsEnabled = isSubscribed && permissionStatus === 'granted';

    return (
        <div className="min-h-screen bg-muted/20 pb-16">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Back</span>
                    </Button>
                    <h1 className="text-xl font-bold text-foreground">Settings</h1>
                </div>
            </header>
            <main className="max-w-3xl mx-auto space-y-6 p-4">
                {/* Account Section */}
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3 text-lg"><User className="text-primary"/> Account & Security</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                       <SettingsItem><Label>Edit Profile</Label><Button variant="ghost" size="icon"><ChevronRight /></Button></SettingsItem>
                       <SettingsItem><Label>Change Password</Label><Button variant="ghost" size="icon"><ChevronRight /></Button></SettingsItem>
                       <SettingsItem><Label>Manage Partner</Label><Button variant="ghost" size="icon"><ChevronRight /></Button></SettingsItem>
                         <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" className="w-full justify-between text-destructive hover:text-destructive hover:bg-destructive/10 mt-2 p-3 h-auto"><div className="flex items-center gap-2"><LogOut /> Logout</div><ChevronRight/></Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>You will be returned to the login screen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={logout}>Logout</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
                
                {/* Notifications Section */}
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3 text-lg"><Bell className="text-primary"/> Notifications</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                        <SettingsItem><Label className="font-semibold">Master Toggle</Label><Switch checked={masterNotificationsEnabled} onCheckedChange={masterNotificationsEnabled ? unsubscribeFromPush : subscribeToPush} disabled={isSubscribing || (permissionStatus === 'denied' && !masterNotificationsEnabled)}/></SettingsItem>
                        <div className={`space-y-3 pt-3 transition-opacity ${!masterNotificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <p className="text-sm text-muted-foreground">Granular Toggles</p>
                            <SettingsItem><Label>New Messages</Label><Switch checked={localNotificationSettings.messages ?? true} onCheckedChange={c => setLocalNotificationSettings(p => ({...p, messages: c}))} /></SettingsItem>
                            <SettingsItem><Label>Reactions</Label><Switch checked={localNotificationSettings.mood_updates ?? true} onCheckedChange={c => setLocalNotificationSettings(p => ({...p, mood_updates: c}))} /></SettingsItem>
                            <SettingsItem><Label>"Thinking of You" Pings</Label><Switch checked={localNotificationSettings.thinking_of_you ?? true} onCheckedChange={c => setLocalNotificationSettings(p => ({...p, thinking_of_you: c}))}/></SettingsItem>
                            <Separator />
                            <SettingsItem><Label className="font-semibold">Quiet Hours</Label><Switch /></SettingsItem>
                        </div>
                    </CardContent>
                </Card>

                 {/* Appearance & Accessibility Section */}
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3 text-lg"><Palette className="text-primary"/> Appearance</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                        <SettingsItem>
                            <Label className="font-semibold">Theme</Label>
                            <RadioGroup defaultValue={theme} onValueChange={(v) => handleThemeChange(v as any)} className="flex items-center gap-2">
                                <RadioGroupItem value="light" id="theme-light" className="peer sr-only" /><Label htmlFor="theme-light" className="px-3 py-1.5 border rounded-md cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground">Light</Label>
                                <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" /><Label htmlFor="theme-dark" className="px-3 py-1.5 border rounded-md cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground">Dark</Label>
                                <RadioGroupItem value="system" id="theme-system" className="peer sr-only" /><Label htmlFor="theme-system" className="px-3 py-1.5 border rounded-md cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground">System</Label>
                            </RadioGroup>
                        </SettingsItem>
                         <div className="py-3 space-y-3">
                            <Label className="font-semibold">Text Size</Label>
                            <p style={{ fontSize: `${textSize[0]}px` }} className="p-2 bg-muted rounded-md text-center transition-all">The quick brown fox jumps over the lazy dog.</p>
                            <Slider value={textSize} onValueChange={setTextSize} max={24} min={12} step={1} />
                        </div>
                        <SettingsItem><Label className="font-semibold">Dynamic Backgrounds</Label><Switch checked={dynamicBackgrounds} onCheckedChange={setDynamicBackgrounds} /></SettingsItem>
                    </CardContent>
                </Card>

                 {/* Privacy & Data Section */}
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3 text-lg"><Shield className="text-primary"/> Privacy & Data</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                         <SettingsItem><Label>Read Receipts</Label><Switch checked={readReceipts} onCheckedChange={setReadReceipts}/></SettingsItem>
                         <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" className="w-full justify-between h-auto p-3"><div className="flex items-center gap-2"><Trash2/> Clear Chat History</div><ChevronRight /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear all messages?</AlertDialogTitle><AlertDialogDescription>This action is irreversible and will delete your entire chat history for you and your partner.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => toast({title: "Chat History Cleared", description: "This is a mock action."})}>Clear History</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                         <SettingsItem><Label>Export Conversation</Label><Button variant="ghost" size="icon"><FileText className="h-4 w-4 mr-2" /> <ChevronRight /></Button></SettingsItem>
                         
                         <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" className="w-full justify-between text-destructive hover:text-destructive hover:bg-destructive/10 h-auto p-3"><div className="flex items-center gap-2"><Trash2/> Delete Account</div><ChevronRight /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete your account, messages, and all data. To confirm, type "DELETE" below.</AlertDialogDescription></AlertDialogHeader>
                                <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="DELETE" />
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => setIsReAuthModalOpen(true)} disabled={deleteConfirmText !== 'DELETE'}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>

                 {/* AI & Extras Section */}
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3 text-lg"><BrainCircuit className="text-primary"/> AI & Extras</CardTitle></CardHeader>
                    <CardContent className="divide-y">
                        <SettingsItem><Label>AI Mood Suggestions</Label><Switch checked={aiSuggestions} onCheckedChange={setAiSuggestions}/></SettingsItem>
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
