
"use client";

import { useCallback, useRef, PointerEvent } from 'react';

interface LongPressOptions {
  threshold?: number;
  onStart?: (event: PointerEvent<HTMLElement>) => void;
  onFinish?: (event: PointerEvent<HTMLElement>) => void;
  onCancel?: (event: PointerEvent<HTMLElement>) => void;
}

export const useLongPress = (
  callback: (event: PointerEvent<HTMLElement>) => void,
  options: LongPressOptions = {}
) => {
  const { threshold = 500, onStart, onFinish, onCancel } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isLongPressingRef = useRef(false);

  const start = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      isLongPressingRef.current = false;
      onStart?.(event);
      timeoutRef.current = setTimeout(() => {
        isLongPressingRef.current = true;
        callback(event);
      }, threshold);
    },
    [callback, threshold, onStart]
  );

  const cancel = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        onCancel?.(event);
      }
    },
    [onCancel]
  );
  
  const finish = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        onFinish?.(event);
      }
    },
    [onFinish]
  );

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => start(e),
    onPointerUp: (e: PointerEvent<HTMLElement>) => finish(e),
    onPointerMove: (e: PointerEvent<HTMLElement>) => cancel(e),
    isLongPressing: () => isLongPressingRef.current,
  };
};
