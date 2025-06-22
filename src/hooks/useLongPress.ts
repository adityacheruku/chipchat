
"use client";

import { useCallback, useRef } from 'react';

interface LongPressOptions {
  threshold?: number;
  onStart?: (event: React.MouseEvent | React.TouchEvent) => void;
  onFinish?: (event: React.MouseEvent | React.TouchEvent) => void;
  onCancel?: (event: React.MouseEvent | React.TouchEvent) => void;
}

export const useLongPress = (
  callback: (event: React.MouseEvent | React.TouchEvent) => void,
  { threshold = 400, onStart, onFinish, onCancel }: LongPressOptions = {}
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventRef = useRef<React.MouseEvent | React.TouchEvent | null>(null);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Prevent the browser's default context menu on long press
      if ('preventDefault' in event) {
        event.preventDefault();
      }
      eventRef.current = event;
      onStart?.(event);
      timeoutRef.current = setTimeout(() => {
        callback(eventRef.current!);
        onFinish?.(eventRef.current!);
      }, threshold);
    },
    [callback, threshold, onStart, onFinish]
  );

  const clear = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        onCancel?.(event);
      }
    },
    [onCancel]
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
  };
};
