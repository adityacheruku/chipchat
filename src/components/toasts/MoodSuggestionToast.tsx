
"use client";

import React from 'react';
import type { Mood } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface MoodSuggestionToastProps {
  newMood: Mood;
  toastReasoningSnippet: string | null;
  fullReasoning: string | null;
  checkboxId: string;
  isDontSuggestAgainChecked: boolean;
  onCheckboxChange: (checked: boolean) => void;
  onShowDetailsClick: () => void;
}

export function MoodSuggestionToast({
  newMood,
  toastReasoningSnippet,
  // fullReasoning is used by onShowDetailsClick passed from parent
  checkboxId,
  isDontSuggestAgainChecked,
  onCheckboxChange,
  onShowDetailsClick,
}: MoodSuggestionToastProps) {
  return (
    <div className="space-y-2">
      <p>AI thinks your message sounds {newMood}. Update mood?</p>
      {toastReasoningSnippet && (
        <p className="text-xs text-muted-foreground">
          Reasoning: {toastReasoningSnippet}
        </p>
      )}
      <Button
        variant="link"
        size="sm"
        className="p-0 h-auto text-xs mt-1 text-primary hover:text-primary/90" // Changed to text-primary
        onClick={onShowDetailsClick}
      >
        Show Details
      </Button>
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
