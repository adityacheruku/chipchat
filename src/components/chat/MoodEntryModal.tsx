
"use client";

import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import type { Mood } from '@/types';
import { ALL_MOODS } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface MoodEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetMood: (mood: Mood) => void;
  currentMood: Mood;
  onContinueWithCurrent: () => void;
}

export default function MoodEntryModal({
  isOpen,
  onClose,
  onSetMood,
  currentMood,
  onContinueWithCurrent,
}: MoodEntryModalProps) {
  const [selectedMood, setSelectedMood] = useState<Mood>(currentMood);

  useEffect(() => {
    if (isOpen) {
      setSelectedMood(currentMood); // Reset to current mood when modal opens
    }
  }, [isOpen, currentMood]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (selectedMood.trim()) { // Ensure custom mood is not just whitespace
        onSetMood(selectedMood);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onContinueWithCurrent(); }}>
      <DialogContent className="sm:max-w-md bg-card rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">How are you feeling?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Pick a mood or write your own. Your current vibe is: <span className="font-semibold text-accent">{currentMood}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4 space-y-4">
             <div>
                <Label htmlFor="custom-mood-input" className="sr-only">Your Mood</Label>
                <Input
                    id="custom-mood-input"
                    placeholder="Or type your own mood here..."
                    value={selectedMood}
                    onChange={(e) => setSelectedMood(e.target.value)}
                    className="bg-card focus:ring-primary text-center text-lg font-semibold"
                />
            </div>
            
            <div>
                 <p className="text-sm text-muted-foreground mb-3 text-center">
                    Quick Picks
                </p>
                <div className="grid grid-cols-3 gap-2">
                {ALL_MOODS.map((moodOption) => (
                    <Button
                    key={moodOption}
                    type="button"
                    variant={'outline'}
                    className={cn(
                        "w-full justify-center text-foreground hover:bg-muted active:bg-muted/80",
                        selectedMood === moodOption && 'bg-primary text-primary-foreground hover:bg-primary/90'
                    )}
                    onClick={() => setSelectedMood(moodOption)}
                    >
                    {moodOption}
                    </Button>
                ))}
                </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button type="button" variant="ghost" onClick={onContinueWithCurrent} className="text-muted-foreground hover:text-foreground">
              Keep it {currentMood}
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!selectedMood.trim()}>
              Set Mood
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
