
"use client";

import type { RefObject } from 'react';
import { useEffect } from 'react';

/**
 * Custom hook to automatically scroll a scrollable element to its bottom.
 * It only scrolls down if the user is already near the bottom.
 * @param viewportRef Ref to the scrollable viewport element (e.g., ScrollArea's viewport).
 * @param dependencies Array of dependencies that trigger the scroll effect.
 */
export function useAutoScroll<T extends HTMLElement>(
  viewportRef: RefObject<T>,
  dependencies: unknown[] = []
): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      const isScrolledToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
      if (isScrolledToBottom) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

    