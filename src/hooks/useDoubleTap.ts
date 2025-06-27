
"use client";

import { useCallback, useRef } from 'react';

type DoubleTapCallback = (event: React.TouchEvent | React.MouseEvent) => void;

interface DoubleTapOptions {
    timeout?: number;
}

/**
 * A simple hook to detect a double tap/click on an element.
 * @param callback The function to call on double tap.
 * @param options Configuration options like timeout duration.
 * @returns An object with `onClick` and `onTouchStart` event handlers to spread onto the target element.
 */
export const useDoubleTap = (
  callback: DoubleTapCallback,
  options: DoubleTapOptions = {}
): { onClick: (e: React.MouseEvent) => void; } => {
  const { timeout = 300 } = options;
  const timer = useRef<NodeJS.Timeout | null>(null);
  const count = useRef(0);

  const handler = useCallback((event: React.MouseEvent) => {
    count.current += 1;
    if (count.current === 1) {
      timer.current = setTimeout(() => {
        count.current = 0;
      }, timeout);
    } else if (count.current === 2) {
      if(timer.current) clearTimeout(timer.current);
      count.current = 0;
      callback(event);
    }
  }, [callback, timeout]);

  return { onClick: handler };
};
