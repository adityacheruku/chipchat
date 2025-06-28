
"use client";

import { useCallback, useRef } from 'react';

interface LongPressOptions {
  threshold?: number;
}

export const useLongPress = (
  callback: (event: React.MouseEvent | React.TouchEvent) => void,
  { threshold = 400 }: LongPressOptions = {}
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Prevent context menu on long touch on mobile
      if ('touches' in event.nativeEvent) {
          event.preventDefault();
      }
      isLongPressTriggered.current = false;
      timeoutRef.current = setTimeout(() => {
        callback(event);
        isLongPressTriggered.current = true;
      }, threshold);
    },
    [callback, threshold]
  );

  const clear = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
    onContextMenu: (e: React.MouseEvent) => {
      if (isLongPressTriggered.current) {
        e.preventDefault();
      }
    },
    isLongPressing: () => isLongPressTriggered.current,
  };
};

    