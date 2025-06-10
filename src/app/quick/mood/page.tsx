// src/app/quick/mood/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import type { Mood } from '@/types';
import { ALL_MOODS } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function QuickMoodPage() {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<Mood | undefined>(undefined);

  useEffect(() => {
    console.log("Action: Set My Mood triggered via PWA shortcut.");
  }, []);

  const handleSetMood = () => {
    if (selectedMood) {
      console.log(`Mood selected: ${selectedMood}. Implement actual mood setting logic.`);
      // Placeholder: Update mood in localStorage or via API
      // For demonstration, we'll just log and then allow redirect.
      alert(`Mood set to: ${selectedMood} (Placeholder)`);
      router.push('/chat');
    } else {
      alert("Please select a mood first.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Smile className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline text-primary">Set Your Mood</CardTitle>
          <CardDescription className="text-muted-foreground">
            How are you feeling right now?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p>This page was accessed via a PWA shortcut.</p>
          
          <Select value={selectedMood} onValueChange={(value) => setSelectedMood(value as Mood)}>
            <SelectTrigger className="w-full bg-card focus:ring-primary">
              <SelectValue placeholder="Select your mood" />
            </SelectTrigger>
            <SelectContent>
              {ALL_MOODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleSetMood} className="w-full" disabled={!selectedMood}>
            Set Mood & Go to Chat
          </Button>
          <Button onClick={() => router.push('/chat')} className="w-full" variant="outline">
            Cancel
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
