"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { NotificationSettings } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import SettingsHeader from '@/components/settings/SettingsHeader';

const SettingsItem = ({ children }: { children: React.ReactNode }) => {
    return <div className="flex items-center justify-between py-4">{children}</div>;
};

export default function NotificationSettingsPage() {
    const { currentUser, isLoading: isAuthLoading } = useAuth();
    const { isSubscribed, notificationSettings, updateNotificationSettings, isSubscribing, permissionStatus, subscribeToPush, unsubscribeFromPush } = usePushNotifications();
    const [localNotificationSettings, setLocalNotificationSettings] = useState<Partial<NotificationSettings>>({});

    useEffect(() => {
        if (notificationSettings) {
            setLocalNotificationSettings(notificationSettings);
        }
    }, [notificationSettings]);

    const handleSettingChange = (key: keyof NotificationSettings, value: boolean) => {
        const newSettings = { ...localNotificationSettings, [key]: value };
        setLocalNotificationSettings(newSettings);
        updateNotificationSettings({ [key]: value });
    };

     if (isAuthLoading || !currentUser) {
        return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    const masterNotificationsEnabled = isSubscribed && permissionStatus === 'granted';

    return (
        <div className="min-h-screen bg-muted/40 pb-16">
            <SettingsHeader title="Notifications" />
            <main className="max-w-3xl mx-auto space-y-6 p-4">
                <Card>
                    <CardContent className="divide-y p-4">
                        <SettingsItem>
                            <Label htmlFor="master-toggle" className="font-semibold pr-4">Enable Push Notifications</Label>
                            <Switch id="master-toggle" checked={masterNotificationsEnabled} onCheckedChange={masterNotificationsEnabled ? unsubscribeFromPush : subscribeToPush} disabled={isSubscribing || (permissionStatus === 'denied' && !masterNotificationsEnabled)} />
                        </SettingsItem>
                        <div className={`space-y-1 pt-4 transition-opacity ${!masterNotificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <p className="text-sm text-muted-foreground pb-2">Notify me about...</p>
                            <SettingsItem>
                                <Label htmlFor="messages-toggle">New Messages</Label>
                                <Switch id="messages-toggle" checked={localNotificationSettings.messages ?? true} onCheckedChange={(c) => handleSettingChange('messages', c)} />
                            </SettingsItem>
                            <SettingsItem>
                                <Label htmlFor="reactions-toggle">Message Reactions</Label>
                                <Switch id="reactions-toggle" checked={localNotificationSettings.mood_updates ?? true} onCheckedChange={(c) => handleSettingChange('mood_updates', c)} />
                            </SettingsItem>
                            <SettingsItem>
                                <Label htmlFor="pings-toggle">"Thinking of You" Pings</Label>
                                <Switch id="pings-toggle" checked={localNotificationSettings.thinking_of_you ?? true} onCheckedChange={(c) => handleSettingChange('thinking_of_you', c)} />
                            </SettingsItem>
                            <Separator />
                            <SettingsItem>
                                <Label htmlFor="quiet-hours-toggle" className="font-semibold">Quiet Hours</Label>
                                <Switch id="quiet-hours-toggle" disabled />
                            </SettingsItem>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
