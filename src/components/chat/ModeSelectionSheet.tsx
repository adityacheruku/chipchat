
"use client";

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MessageMode } from '@/types';
import { MessageCircle, ShieldAlert, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeSelectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: MessageMode) => void;
  currentMode: MessageMode;
}

const modeDetails = {
  normal: {
    icon: MessageCircle,
    title: "Normal Mode",
    description: "Your standard chat experience. Messages are saved to your history.",
  },
  fight: {
    icon: ShieldAlert,
    title: "Fight Mode",
    description: "A space for arguments. These messages are saved but visually distinct.",
  },
  incognito: {
    icon: EyeOff,
    title: "Incognito Mode",
    description: "Ephemeral messages that disappear after 30 seconds and are not saved.",
  },
};

export default function ModeSelectionSheet({
  isOpen,
  onClose,
  onSelectMode,
  currentMode,
}: ModeSelectionSheetProps) {
  const [progress, setProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    let progressTimer: NodeJS.Timeout;
    let contentTimer: NodeJS.Timeout;
    
    if (isOpen) {
      setProgress(0);
      setShowContent(false);
      
      // Start the progress bar animation shortly after the sheet opens
      progressTimer = setTimeout(() => {
        setProgress(100);
      }, 100);
      
      // Show content after the loader "completes"
      contentTimer = setTimeout(() => {
        setShowContent(true);
      }, 1500); // This duration simulates the "hold"
    }

    return () => {
      clearTimeout(progressTimer);
      clearTimeout(contentTimer);
    };
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-lg">
        <SheetHeader>
          <SheetTitle>Select Chat Mode</SheetTitle>
          <SheetDescription>
            Choose the type of conversation you want to have.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          {!showContent ? (
            <div className="flex flex-col items-center justify-center h-48">
              <p className="text-sm text-muted-foreground mb-2">Preparing modes...</p>
              <Progress value={progress} className="w-full transition-all duration-1000 ease-linear" />
            </div>
          ) : (
            <div className="grid gap-4 animate-in fade-in-50 duration-500">
              {Object.entries(modeDetails).map(([mode, details]) => {
                const isSelected = mode === currentMode;
                return (
                  <Button
                    key={mode}
                    variant={isSelected ? "default" : "outline"}
                    className="h-auto p-4 w-full justify-start text-left"
                    onClick={() => onSelectMode(mode as MessageMode)}
                  >
                    <details.icon className={cn("mr-4 h-6 w-6 flex-shrink-0", mode === 'fight' && 'text-destructive', mode === 'incognito' && 'text-muted-foreground')} />
                    <div className="flex flex-col">
                      <span className="font-semibold">{details.title}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {details.description}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
