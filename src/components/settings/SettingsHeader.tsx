"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface SettingsHeaderProps {
    title: string;
}

export default function SettingsHeader({ title }: SettingsHeaderProps) {
    const router = useRouter();

    return (
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back</span>
                </Button>
            </div>
            <h1 className="text-lg font-semibold text-foreground absolute left-1/2 -translate-x-1/2">
                {title}
            </h1>
        </header>
    );
}
