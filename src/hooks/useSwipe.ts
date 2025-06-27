
"use client";
import { useRef, useState, useCallback, useEffect } from 'react';

const SWIPE_THRESHOLD = 60; // pixels
const MAX_SWIPE = 80; // pixels

interface UseSwipeProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export const useSwipe = ({ onSwipeLeft, onSwipeRight }: UseSwipeProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [translateX, setTranslateX] = useState(0);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Only main button
        setStartX(e.clientX);
        setIsDragging(true);
        if(ref.current) {
            ref.current.style.transition = 'none';
        }
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const currentX = e.clientX;
        let diff = currentX - startX;

        // Prevent swiping in the wrong direction for each user
        if (onSwipeRight && diff < 0) diff = 0; // Only allow right swipe
        if (onSwipeLeft && diff > 0) diff = 0; // Only allow left swipe

        const newTranslateX = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
        setTranslateX(newTranslateX);
    }, [isDragging, startX, onSwipeLeft, onSwipeRight]);

    const handlePointerUpOrLeave = useCallback(() => {
        if (!isDragging) return;

        if (ref.current) {
            ref.current.style.transition = 'transform 0.2s ease-out';
        }

        if (translateX > SWIPE_THRESHOLD && onSwipeRight) {
            onSwipeRight();
        } else if (translateX < -SWIPE_THRESHOLD && onSwipeLeft) {
            onSwipeLeft();
        }
        
        // Reset state after action or if swipe wasn't enough
        setIsDragging(false);
        setTranslateX(0);

    }, [isDragging, translateX, onSwipeLeft, onSwipeRight]);
    
    // Cleanup event listeners
    useEffect(() => {
        const element = ref.current;
        if (element && isDragging) {
            const handleGlobalPointerUp = () => handlePointerUpOrLeave();
            window.addEventListener('pointerup', handleGlobalPointerUp);
            return () => {
                window.removeEventListener('pointerup', handleGlobalPointerUp);
            };
        }
    }, [isDragging, handlePointerUpOrLeave]);

    return {
        ref,
        translateX,
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUpOrLeave,
            onPointerLeave: handlePointerUpOrLeave,
        },
    };
};
