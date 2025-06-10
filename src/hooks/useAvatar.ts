
"use client";

import type { ChangeEvent } from 'react';
import { useState, useCallback } from 'react';
import type { ToastType } from '@/hooks/use-toast'; // Assuming use-toast exports its toast function type

interface UseAvatarProps {
  maxSizeKB: number;
  toast: ToastType; // Function to show toasts
}

interface UseAvatarReturn {
  avatarPreview: string | null;
  avatarError: string | null;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>, currentAvatarUrl?: string) => void;
  setAvatarPreview: (url: string | null) => void;
  clearAvatarError: () => void;
}

export function useAvatar({ maxSizeKB, toast }: UseAvatarProps): UseAvatarReturn {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const clearAvatarError = useCallback(() => {
    setAvatarError(null);
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>, currentAvatarUrl?: string) => {
    clearAvatarError();
    const file = event.target.files?.[0];

    if (file) {
      if (file.size > maxSizeKB * 1024) {
        const errorMsg = `File is too large. Max size is ${maxSizeKB}KB.`;
        setAvatarError(errorMsg);
        toast({
          variant: 'destructive',
          title: 'Upload Error',
          description: errorMsg,
        });
        setAvatarPreview(currentAvatarUrl || null); // Reset to current or null
        if (event.target) { // Reset file input
            event.target.value = "";
        }
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.onerror = () => {
        const errorMsg = 'Failed to read image file.';
        setAvatarError(errorMsg);
        toast({
          variant: 'destructive',
          title: 'Upload Error',
          description: errorMsg,
        });
        setAvatarPreview(currentAvatarUrl || null); // Reset to current or null
         if (event.target) { // Reset file input
            event.target.value = "";
        }
      };
      reader.readAsDataURL(file);
    }
  }, [maxSizeKB, toast, clearAvatarError]);

  return {
    avatarPreview,
    avatarError,
    handleFileChange,
    setAvatarPreview,
    clearAvatarError,
  };
}
