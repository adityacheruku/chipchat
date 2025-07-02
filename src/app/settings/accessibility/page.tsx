
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';
import SettingsHeader from '@/components/settings/SettingsHeader';
import FullPageLoader from '@/components/common/FullPageLoader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const SettingsRow = ({ children, onClick, disabled = false }: { children: React.ReactNode, onClick?: () => void, disabled?: boolean }) => {
    const interactionClass = disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50';
    return (
        <div
            onClick={!disabled ? onClick : undefined}
            className={`flex items-center justify-between p-4 -mx-4 rounded-lg transition-colors ${interactionClass} ${!disabled && onClick ? 'cursor-pointer' : ''}`}
        >
            {children}
        </div>
    );
};

export default function AccessibilitySettingsPage() {
    const { currentUser, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    // State for the feature itself
    const [assistiveTouchEnabled, setAssistiveTouchEnabled] = useState(false);
    
    // State for the dialogs
    const [isExplanationDialogOpen, setIsExplanationDialogOpen] = useState(false);
    const [isPermissionDeniedDialogOpen, setIsPermissionDeniedDialogOpen] = useState(false);

    if (isAuthLoading || !currentUser) {
        return <FullPageLoader />;
    }

    // A placeholder for detail page navigation
    const navigateToDetail = () => {
        // This will be implemented in a future step.
        // For now, it could show a toast or do nothing.
    };

    // Mock PermissionManager to follow the user's pseudocode
    const PermissionManager = {
        hasPermission: () => assistiveTouchEnabled,

        requestOverlayPermission: async () => {
            setIsExplanationDialogOpen(true);
        },

        handlePermissionRequest: async () => {
            setIsExplanationDialogOpen(false);
            
            // --- SIMULATION ---
            // In a real Capacitor app, you would call:
            // const result = await Capacitor.requestSystemAlertWindow();
            // For now, we'll simulate a "granted" result.
            const result = { granted: true }; 

            if (result.granted) {
                toast({ title: "Permission Granted!", description: "AssistiveTouch has been enabled." });
                setAssistiveTouchEnabled(true);
            } else {
                // If permission was denied, show the help dialog.
                setIsPermissionDeniedDialogOpen(true);
                setAssistiveTouchEnabled(false);
            }
        }
    };
    
    const handleToggleChange = (checked: boolean) => {
        if (checked) {
            // If user is trying to enable it, start the permission flow.
            PermissionManager.requestOverlayPermission();
        } else {
            // If user is disabling it, just update the state.
            setAssistiveTouchEnabled(false);
        }
    };

    return (
        <div className="min-h-screen bg-muted/40 pb-16">
            <SettingsHeader title="Accessibility" />
            <main className="max-w-3xl mx-auto space-y-6 p-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Touch</CardTitle>
                        <CardDescription>Customize how you interact with the screen.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 divide-y">
                       <div className="px-4">
                            <SettingsRow onClick={navigateToDetail}>
                                <Label htmlFor="assistive-touch-toggle" className="font-medium pr-4 cursor-pointer">
                                    AssistiveTouch
                                    <p className="text-sm text-muted-foreground font-normal">Use a floating button to quickly access app features from anywhere.</p>
                                </Label>
                                <div className="flex items-center gap-2">
                                     <Switch
                                        id="assistive-touch-toggle"
                                        checked={assistiveTouchEnabled}
                                        onCheckedChange={handleToggleChange}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </SettingsRow>
                       </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Visual</CardTitle>
                        <CardDescription>Features coming soon.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Adjustments for text size, contrast, and motion will be available here.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Audio</CardTitle>
                        <CardDescription>Features coming soon.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <p className="text-sm text-muted-foreground">Settings for mono audio and sound recognition will be available here.</p>
                    </CardContent>
                </Card>
            </main>
            
            {/* Permission Explanation Dialog */}
            <AlertDialog open={isExplanationDialogOpen} onOpenChange={setIsExplanationDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Enable AssistiveTouch</AlertDialogTitle>
                        <AlertDialogDescription>
                            This allows a floating button to appear over other apps so you can quickly share moods with your partner. To do this, ChirpChat needs permission to draw over other apps.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={PermissionManager.handlePermissionRequest}>
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Permission Denied Help Dialog */}
            <AlertDialog open={isPermissionDeniedDialogOpen} onOpenChange={setIsPermissionDeniedDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Permission Denied</AlertDialogTitle>
                        <AlertDialogDescription>
                            To enable AssistiveTouch, you need to grant the "Draw over other apps" permission manually. Go to your device's Settings &gt; Apps &gt; ChirpChat &gt; Advanced to enable it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setIsPermissionDeniedDialogOpen(false)}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
