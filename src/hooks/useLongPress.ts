
"use client";

import { useCallback, useRef } from 'react';

interface LongPressOptions {
  threshold?: number;
}

export const useLongPress = (
  callback: (event: React.MouseEvent | React.TouchEvent) => void,
  { threshold = 300 }: LongPressOptions = {}
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Prevent context menu on long touch
      if (event.nativeEvent.type === 'touchstart') {
          event.nativeEvent.preventDefault();
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
    isLongPressing: () => isLongPressTriggered.current,
  };
};
