
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { suggestMood, type SuggestMoodInput, type SuggestMoodOutput } from '@/ai/flows/suggestMoodFlow';
import type { Mood } from '@/types';
import { ALL_MOODS } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToastAction } from "@/components/ui/toast";
import React from 'react'; // Ensure React is imported for JSX and useId

const DEBOUNCE_DELAY = 1500; // 1.5 seconds
const DONT_SUGGEST_AGAIN_KEY = 'chirpChat_dontSuggestMoodAgain';

interface UseMoodSuggestionProps {
  currentUserMood: Mood;
  onMoodChange: (newMood: Mood) => void;
  currentMessageTextRef: React.MutableRefObject<string>;
}

export function useMoodSuggestion({ currentUserMood, onMoodChange, currentMessageTextRef }: UseMoodSuggestionProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [reasoningText, setReasoningText] = useState('');
  const [dontSuggestAgain, setDontSuggestAgain] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dontSuggestCheckboxId = React.useId();

  useEffect(() => {
    const storedPreference = localStorage.getItem(DONT_SUGGEST_AGAIN_KEY);
    if (storedPreference === 'true') {
      setDontSuggestAgain(true);
    }
  }, []);

  const handleSetDontSuggestAgain = useCallback((checked: boolean) => {
    setDontSuggestAgain(checked);
    localStorage.setItem(DONT_SUGGEST_AGAIN_KEY, String(checked));
    toast({
      title: "Preference Saved",
      description: checked ? "AI mood suggestions are now off." : "AI mood suggestions are now on.",
      duration: 3000,
    });
  }, [toast]);

  const triggerSuggestion = useCallback(async (messageText: string) => {
    if (dontSuggestAgain) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    currentMessageTextRef.current = messageText;

    try {
      const result: SuggestMoodOutput = await suggestMood({ messageText, currentMood: currentUserMood });

      if (result.suggestedMood && result.suggestedMood !== currentUserMood && ALL_MOODS.includes(result.suggestedMood as Mood)) {
        const newMood = result.suggestedMood as Mood;
        const currentReasoning = result.reasoning || "No specific reasoning provided.";

        const toastDescriptionContent = (
          <React.Fragment>
            <div className="space-y-2">
              <p>AI thinks your message sounds {newMood}. Update mood?</p>
              {currentReasoning && currentReasoning !== "No specific reasoning provided." && (
                <p className="text-xs text-muted-foreground">
                  Reasoning: {currentReasoning.length > 60 ? currentReasoning.substring(0, 60) + "..." : currentReasoning}
                </p>
              )}
              {result.reasoning && currentReasoning !== "No specific reasoning provided." && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto text-xs mt-1 text-accent-foreground hover:text-accent-foreground/80"
                  onClick={() => {
                    setReasoningText(currentReasoning);
                    setShowReasoningDialog(true);
                  }}
                >
                  Show Details
                </Button>
              )}
              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id={dontSuggestCheckboxId}
                  checked={dontSuggestAgain}
                  onCheckedChange={(checked) => handleSetDontSuggestAgain(Boolean(checked))}
                  aria-label="Don't suggest mood changes again"
                />
                <Label htmlFor={dontSuggestCheckboxId} className="text-xs">Don't suggest again</Label>
              </div>
            </div>
          </React.Fragment>
        );

        const primaryToastAction = (
          <ToastAction
            altText={`Set mood to ${newMood}`}
            asChild
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onMoodChange(newMood);
                toast({ title: "Mood Updated!", description: `Your mood is now ${newMood}.`, duration: 3000 });
              }}
            >
              Set to {newMood}
            </Button>
          </ToastAction>
        );

        toast({
          title: "Mood Suggestion",
          description: toastDescriptionContent,
          duration: 15000, // Increased duration for user to interact
          action: primaryToastAction,
        });

      } else if (result.reasoning && !result.suggestedMood) {
        // AI provided reasoning but no suggestion
        // console.log("AI Reasoning (no suggestion):", result.reasoning);
      }
    } catch (error) {
      console.error("Error suggesting mood:", error);
      const retryAction = (
        <ToastAction altText="Retry mood suggestion" asChild>
          <Button variant="outline" size="sm" onClick={() => triggerSuggestion(currentMessageTextRef.current)}>
            Retry
          </Button>
        </ToastAction>
      );
      toast({
        variant: "destructive",
        title: "Mood AI Error",
        description: "Could not analyze message sentiment.",
        action: retryAction,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserMood, onMoodChange, toast, dontSuggestAgain, currentMessageTextRef, dontSuggestCheckboxId, handleSetDontSuggestAgain]);


  const debouncedSuggestMood = useCallback((messageText: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (dontSuggestAgain) {
       setIsLoading(false);
       return;
    }

    setIsLoading(true);
    debounceTimeoutRef.current = setTimeout(() => {
      triggerSuggestion(messageText);
    }, DEBOUNCE_DELAY);
  }, [triggerSuggestion, dontSuggestAgain]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const ReasoningDialog = () => (
    <AlertDialog open={showReasoningDialog} onOpenChange={setShowReasoningDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>AI Mood Suggestion Reasoning</AlertDialogTitle>
          <AlertDialogDescription className="max-h-[300px] overflow-y-auto whitespace-pre-wrap">
            {reasoningText}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setShowReasoningDialog(false)}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    isLoadingAISuggestion: isLoading,
    suggestMood: debouncedSuggestMood,
    ReasoningDialog,
  };
}
