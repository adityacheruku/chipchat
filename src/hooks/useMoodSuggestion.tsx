
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
const DONT_SUGGEST_AGAIN_KEY = 'kuchlu_dontSuggestMoodAgain';

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
    // This feature is disabled for static export builds as it requires a server.
    // To re-enable, you would need to remove `output: 'export'` from next.config.js
    // and deploy the Next.js app with a Node.js server.
    setIsLoading(false);
    return;
  }, []);

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
