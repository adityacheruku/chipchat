
'use client';

import { useState, useCallback } from 'react';
import { SmilePlus, Smile, Frown, Zap, Brain } from 'lucide-react';
import { useLongPress } from '@/hooks/useLongPress';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Mood } from '@/types';

const QUICK_MOODS: { mood: Mood; icon: React.ElementType }[] = [
  { mood: 'Happy', icon: Smile },
  { mood: 'Sad', icon: Frown },
  { mood: 'Excited', icon: Zap },
  { mood: 'Thoughtful', icon: Brain },
];

export default function FloatingMoodButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { fetchAndUpdateUser } = useAuth();
  const { toast } = useToast();

  const handleSelectMood = useCallback(async (mood: Mood) => {
    setIsOpen(false);
    try {
      await api.updateUserProfile({ mood });
      await fetchAndUpdateUser();
      toast({ title: `Mood set to ${mood}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not set mood.' });
    }
  }, [fetchAndUpdateUser, toast]);

  const longPressEvents = useLongPress(() => {
    setIsOpen(true);
  }, { threshold: 400 });

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 animate-in fade-in-0"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6">
        <div className="relative">
          <button
            {...longPressEvents}
            onClick={() => setIsOpen(v => !v)}
            className="w-14 h-14 rounded-full bg-card/80 backdrop-blur-sm border shadow-lg flex items-center justify-center text-foreground transition-transform active:scale-90"
            aria-label="Open mood selector"
          >
            <SmilePlus size={24} />
          </button>
          
          {QUICK_MOODS.map((item, index) => {
            const angle = -Math.PI / 2 - (index * (Math.PI / 3.5)); // Position them in an arc
            const radius = 80; // distance from center
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);

            return (
              <button
                key={item.mood}
                onClick={() => handleSelectMood(item.mood)}
                className={cn(
                  "absolute w-12 h-12 rounded-full bg-card border shadow-md flex items-center justify-center transition-all duration-300 ease-in-out",
                  "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground hover:bg-primary hover:text-primary-foreground"
                )}
                style={{
                  transform: isOpen 
                    ? `translate(-50%, -50%) translate(${x}px, ${y}px) scale(1)` 
                    : 'translate(-50%, -50%) scale(0)',
                  opacity: isOpen ? 1 : 0,
                  transitionDelay: isOpen ? `${index * 40}ms` : '0ms'
                }}
                aria-label={`Set mood to ${item.mood}`}
              >
                <item.icon size={20} />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
