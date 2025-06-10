
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
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

const DEBOUNCE_DELAY = 1500;
const DONT_SUGGEST_AGAIN_KEY = 'chirpChat_dontSuggestMoodAgain';

interface UseMoodSuggestionProps {
  currentUserMood: Mood;
  onMoodChange: (newMood: Mood) => void;
  currentMessageTextRef: React.MutableRefObject<string>;
}

interface ToastDescriptionComponentProps {
  newMood: Mood;
  toastReasoningSnippet: string | null;
  fullReasoning: string | null;
  checkboxId: string;
  isDontSuggestAgainChecked: boolean;
  onCheckboxChange: (checked: boolean) => void;
  onShowDetailsClick: () => void;
}

// Changed component definition style
function ToastDescriptionComponent(props: ToastDescriptionComponentProps) {
  const {
    newMood,
    toastReasoningSnippet,
    fullReasoning,
    checkboxId,
    isDontSuggestAgainChecked,
    onCheckboxChange,
    onShowDetailsClick,
  } = props;

  return (
    <div className="space-y-2">
      <p>AI thinks your message sounds {newMood}. Update mood?</p>
      {toastReasoningSnippet && (
        <p className="text-xs text-muted-foreground">
          Reasoning: {toastReasoningSnippet}
        </p>
      )}
      {fullReasoning && (
        <Button
          variant="link"
          size="sm"
          className="p-0 h-auto text-xs mt-1 text-accent-foreground hover:text-accent-foreground/80"
          onClick={onShowDetailsClick}
        >
          Show Details
        </Button>
      )}
      <div className="flex items-center space-x-2 mt-2">
        <Checkbox
          id={checkboxId}
          checked={isDontSuggestAgainChecked}
          onCheckedChange={(checkedState) => onCheckboxChange(Boolean(checkedState))}
          aria-label="Don't suggest mood changes again"
        />
        <Label htmlFor={checkboxId} className="text-xs">Don't suggest again</Label>
      </div>
    </div>
  );
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
    if (localStorage.getItem(DONT_SUGGEST_AGAIN_KEY) === 'true') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    currentMessageTextRef.current = messageText;

    try {
      const result: SuggestMoodOutput = await suggestMood({ messageText, currentMood: currentUserMood });

      if (result.suggestedMood && result.suggestedMood !== currentUserMood && ALL_MOODS.includes(result.suggestedMood as Mood)) {
        const newMood = result.suggestedMood as Mood;
        const fullAIRasoning = result.reasoning || null;
        const toastReasoningSnippet = fullAIRasoning ? (fullAIRasoning.length > 60 ? fullAIRasoning.substring(0, 60) + "..." : fullAIRasoning) : null;
        
        const descriptionElement = (
          <ToastDescriptionComponent
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
        
        const primaryToastAction = (
          <ToastAction altText={`Set mood to ${newMood}`} asChild>
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
  }, [currentUserMood, onMoodChange, toast, dontSuggestAgain, currentMessageTextRef, dontSuggestCheckboxId, handleSetDontSuggestAgain, setReasoningText, setShowReasoningDialog, setIsLoading]);


  const debouncedSuggestMood = useCallback((messageText: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (localStorage.getItem(DONT_SUGGEST_AGAIN_KEY) === 'true') {
       setIsLoading(false); 
       return;
    }

    setIsLoading(true); 
    debounceTimeoutRef.current = setTimeout(() => {
      triggerSuggestion(messageText);
    }, DEBOUNCE_DELAY);
  }, [triggerSuggestion, setIsLoading]); 

  useEffect(() => {
    // Load preference on mount
    const storedPreference = localStorage.getItem(DONT_SUGGEST_AGAIN_KEY);
    setDontSuggestAgain(storedPreference === 'true');

    // Cleanup timeout on unmount
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
