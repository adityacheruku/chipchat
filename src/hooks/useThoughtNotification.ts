
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ToastType } from '@/hooks/use-toast';

interface UseThoughtNotificationProps {
  duration: number;
  toast: ToastType;
}

interface UseThoughtNotificationReturn {
  activeTargetId: string | null;
  initiateThoughtNotification: (targetUserId: string, targetUserName: string, senderName: string) => void;
}

export function useThoughtNotification({ duration, toast }: UseThoughtNotificationProps): UseThoughtNotificationReturn {
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearCurrentTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const initiateThoughtNotification = useCallback((targetUserId: string, targetUserName: string, senderName: string) => {
    clearCurrentTimeout();
    setActiveTargetId(targetUserId);

    toast({
      title: "Sent!",
      description: `You let ${targetUserName} know you're thinking of them.`,
      duration: 3000,
    });

    timeoutRef.current = setTimeout(() => {
      setActiveTargetId(currentId => (currentId === targetUserId ? null : currentId));
      timeoutRef.current = null;
    }, duration);
  }, [duration, toast, clearCurrentTimeout]);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      clearCurrentTimeout();
    };
  }, [clearCurrentTimeout]);

  return {
    activeTargetId,
    initiateThoughtNotification,
  };
}
