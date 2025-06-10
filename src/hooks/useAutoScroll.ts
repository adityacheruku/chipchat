
"use client";

import type { RefObject } from 'react';
import { useEffect } from 'react';

/**
 * Custom hook to automatically scroll a scrollable element to its bottom.
 * @param viewportRef Ref to the scrollable viewport element (e.g., ScrollArea's viewport).
 * @param dependencies Array of dependencies that trigger the scroll effect.
 */
export function useAutoScroll<T extends HTMLElement>(
  viewportRef: RefObject<T>,
  dependencies: unknown[] = []
): void {
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies); // Dependencies array ensures this runs when messages change
}
