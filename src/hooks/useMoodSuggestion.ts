
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { suggestMood, type SuggestMoodInput, type SuggestMoodOutput } from '@/ai/flows/suggestMoodFlow';
import type { Mood } from '@/types';
import { ALL_MOODS } from '@/types';
import { Button } from '@/components/ui/button'; 
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
import { MoodSuggestionToast } from '@/components/toasts/MoodSuggestionToast';

const DEBOUNCE_DELAY = 1500;
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
  const [dontSuggestAgain, setDontSuggestAgain] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(DONT_SUGGEST_AGAIN_KEY) === 'true';
    }
    return false;
  });
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
      const response = await fetch('/api/genkit/flow/suggestMoodFlow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText, currentMood: currentUserMood }),
      });
      if (!response.ok) throw new Error('AI suggestion API call failed');
      const result: SuggestMoodOutput = await response.json();

      const fullAIRasoning = result.reasoning || null;
      const toastReasoningSnippet = fullAIRasoning ? (fullAIRasoning.length > 60 ? fullAIRasoning.substring(0, 60) + "..." : fullAIRasoning) : null;

      if (result.suggestedMood && result.suggestedMood !== currentUserMood && ALL_MOODS.includes(result.suggestedMood as Mood)) {
        const newMood = result.suggestedMood as Mood;
        
        const primaryToastAction = (
          <ToastAction
            aria-label={`Set mood to ${newMood}`}
            onClick={() => {
              onMoodChange(newMood);
              toast({ title: "Mood Updated!", description: `Your mood is now ${newMood}.`, duration: 3000 });
            }}
          >
            Set to {newMood}
          </ToastAction>
        );

        const descriptionElement = (
          <MoodSuggestionToast
            newMood={newMood}
            toastReasoningSnippet={toastReasoningSnippet}
            fullReasoning={fullAIRasoning}
            checkboxId={dontSuggestCheckboxId}
            isDontSuggestAgainChecked={dontSuggestAgain}
            onCheckboxChange={handleSetDontSuggestAgain}
            onShowDetailsClick={() => {
              setReasoningText(fullAIRasoning || "No detailed reasoning provided.");
              setShowReasoningDialog(true);
            }}
          />
        );

        toast({
          title: "Mood Suggestion",
          description: descriptionElement,
          duration: 15000,
          action: primaryToastAction,
        });

      } else if (result.reasoning && !result.suggestedMood) {
        // console.log("AI Reasoning (no suggestion):", result.reasoning);
      }
    } catch (error) {
      console.error("Error suggesting mood:", error);
      const retryAction = (
        <ToastAction
          aria-label="Retry mood suggestion"
          onClick={() => triggerSuggestion(currentMessageTextRef.current)}
        >
          Retry
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
  }, [currentUserMood, onMoodChange, toast, dontSuggestAgain, currentMessageTextRef, dontSuggestCheckboxId, handleSetDontSuggestAgain, setIsLoading, setReasoningText, setShowReasoningDialog]);


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
  }, [triggerSuggestion, dontSuggestAgain, setIsLoading]); 

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const ReasoningDialogComponent = () => (
    <AlertDialog open={showReasoningDialog} onOpenChange={setShowReasoningDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>AI Mood Suggestion Reasoning</AlertDialogTitle>
          <AlertDialogDescription className="max-h-[300px] overflow-y-auto whitespace-pre-wrap">
            {reasoningText || "No detailed reasoning provided."}
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
    ReasoningDialog: ReasoningDialogComponent,
  };
}
