
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from "@/components/ui/toast";
import type { SuggestMoodOutput } from '@/ai/flows/suggestMoodFlow';
import type { Mood } from '@/types';
import { ALL_MOODS } from '@/types';
import {
  AlertDialog,
  AlertDialogAction as AlertDialogConfirmAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    if (typeof window !== 'undefined') {
        const storedPreference = localStorage.getItem(DONT_SUGGEST_AGAIN_KEY);
        if (storedPreference === 'true') {
          setDontSuggestAgain(true);
        }
    }
  }, []);

  const handleSetDontSuggestAgain = useCallback((checked: boolean) => {
    setDontSuggestAgain(checked);
    if (typeof window !== 'undefined') {
        localStorage.setItem(DONT_SUGGEST_AGAIN_KEY, String(checked));
    }
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
    let result: SuggestMoodOutput | null = null;
    let fullAIRasoning: string | null = null;
    let toastReasoningSnippet: string | null = null;
    let newMood: Mood | undefined = undefined;

    try {
      const response = await fetch('/api/genkit/flow/suggestMoodFlow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageText, currentMood: currentUserMood }),
      });

      if (!response.ok) {
        let errorBody = 'AI suggestion API call failed';
        try {
            errorBody = await response.text();
        } catch (e) {
            // ignore
        }
        throw new Error(errorBody);
      }
      
      result = await response.json();

      fullAIRasoning = result.reasoning || null;
      toastReasoningSnippet = fullAIRasoning ? (fullAIRasoning.length > 60 ? fullAIRasoning.substring(0, 60) + "..." : fullAIRasoning) : null;
      newMood = result.suggestedMood as Mood | undefined;

      if (newMood && newMood !== currentUserMood && ALL_MOODS.includes(newMood)) {
        const currentNewMood = newMood; 

        const primaryToastAction = (
          <ToastAction
            onClick={() => {
              onMoodChange(currentNewMood);
              toast({ title: "Mood Updated!", description: `Your mood is now ${currentNewMood}.`, duration: 3000 });
            }}
          >
            Set to {currentNewMood}
          </ToastAction>
        );
        
        toast({
          title: "Mood Suggestion",
          description: (
            <MoodSuggestionToast
              newMood={currentNewMood}
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
          ),
          duration: 15000,
          action: primaryToastAction,
        });

      } else if (result?.reasoning && !result?.suggestedMood) {
        // console.log("AI Reasoning (no suggestion):", result.reasoning);
      }
    } catch (error) {
      console.error("Error suggesting mood:", error);
      const retryAction = (
        <ToastAction
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
          <AlertDialogConfirmAction onClick={() => setShowReasoningDialog(false)}>Got it</AlertDialogConfirmAction>
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
