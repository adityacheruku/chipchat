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
    onSetMood(selectedMood);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onContinueWithCurrent(); }}>
      <DialogContent className="sm:max-w-md bg-card rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">How are you feeling?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Let {selectedMood === currentMood ? "your chat partner" : "them"} know your current vibe or pick a new one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Currently feeling: <span className="font-semibold text-accent">{currentMood}</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ALL_MOODS.map((moodOption) => (
                <Button
                  key={moodOption}
                  type="button"
                  variant={selectedMood === moodOption ? 'default' : 'outline'}
                  className={cn(
                    "w-full justify-center",
                    selectedMood === moodOption ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-foreground hover:bg-muted active:bg-muted/80'
                  )}
                  onClick={() => setSelectedMood(moodOption)}
                >
                  {moodOption}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button type="button" variant="ghost" onClick={onContinueWithCurrent} className="text-muted-foreground hover:text-foreground">
              Continue as {currentMood}
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Set Mood to {selectedMood}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
