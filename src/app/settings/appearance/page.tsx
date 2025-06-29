
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import SettingsHeader from '@/components/settings/SettingsHeader';
import FullPageLoader from '@/components/common/FullPageLoader';

const SettingsItem = ({ children }: { children: React.ReactNode }) => {
    return <div className="flex items-center justify-between py-4">{children}</div>;
};

export default function AppearanceSettingsPage() {
    const { currentUser, isLoading: isAuthLoading } = useAuth();
    
    const [theme, setTheme] = useState('system');
    const [textSize, setTextSize] = useState([16]);
    const [dynamicBackgrounds, setDynamicBackgrounds] = useState(true);

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

    if (isAuthLoading || !currentUser) {
        return <FullPageLoader />;
    }

    return (
        <div className="min-h-screen bg-muted/40 pb-16">
            <SettingsHeader title="Appearance" />
            <main className="max-w-3xl mx-auto space-y-6 p-4">
                 <Card>
                    <CardContent className="divide-y p-4">
                        <SettingsItem>
                            <Label className="font-semibold">Theme</Label>
                            <RadioGroup value={theme} onValueChange={(v) => handleThemeChange(v as any)} className="flex items-center gap-2">
                                <RadioGroupItem value="light" id="theme-light" className="peer sr-only" /><Label htmlFor="theme-light" className="px-3 py-1.5 border rounded-md cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground">Light</Label>
                                <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" /><Label htmlFor="theme-dark" className="px-3 py-1.5 border rounded-md cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground">Dark</Label>
                                <RadioGroupItem value="system" id="theme-system" className="peer sr-only" /><Label htmlFor="theme-system" className="px-3 py-1.5 border rounded-md cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground">System</Label>
                            </RadioGroup>
                        </SettingsItem>
                         <div className="py-4 space-y-4">
                            <Label className="font-semibold">Text Size</Label>
                            <p style={{ fontSize: `${textSize[0]}px` }} className="p-3 bg-muted rounded-md text-center transition-all">The quick brown fox jumps over the lazy dog.</p>
                            <Slider value={textSize} onValueChange={setTextSize} max={24} min={12} step={1} />
                        </div>
                        <SettingsItem>
                            <Label className="font-semibold">Dynamic Backgrounds</Label>
                            <Switch checked={dynamicBackgrounds} onCheckedChange={setDynamicBackgrounds} />
                        </SettingsItem>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
