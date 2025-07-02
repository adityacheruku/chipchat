
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
    const [assistiveTouch, setAssistiveTouch] = useState(false);

    if (isAuthLoading || !currentUser) {
        return <FullPageLoader />;
    }

    // A placeholder for detail page navigation
    const navigateToDetail = () => {
        // This will be implemented in a future step.
        // For now, it could show a toast or do nothing.
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
                                    <p className="text-sm text-muted-foreground font-normal">Use a single tap for complex gestures.</p>
                                </Label>
                                <div className="flex items-center gap-2">
                                     <Switch
                                        id="assistive-touch-toggle"
                                        checked={assistiveTouch}
                                        onCheckedChange={setAssistiveTouch}
                                        onClick={(e) => e.stopPropagation()} // Prevent row click when toggling
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
        </div>
    );
}
