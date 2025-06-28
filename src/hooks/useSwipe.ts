
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

    const isSwiping = useCallback(() => {
        return translateX !== 0;
    }, [translateX]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // Only trigger for primary button or touch
        if (e.pointerType === 'mouse' && e.button !== 0) return;
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
        const newTranslateX = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
        setTranslateX(newTranslateX);
    }, [isDragging, startX]);

    const handlePointerUp = useCallback(() => {
        if (!isDragging) return;

        if (ref.current) {
            ref.current.style.transition = 'transform 0.3s ease-out';
        }

        if (translateX > SWIPE_THRESHOLD && onSwipeRight) {
            onSwipeRight();
        } else if (translateX < -SWIPE_THRESHOLD && onSwipeLeft) {
            onSwipeLeft();
        }
        
        setIsDragging(false);
        setTranslateX(0);

    }, [isDragging, translateX, onSwipeLeft, onSwipeRight]);
    
    // Cleanup event listeners
    useEffect(() => {
        const handleGlobalPointerUp = () => {
            if (isDragging) {
               handlePointerUp();
            }
        };
        window.addEventListener('pointerup', handleGlobalPointerUp);
        window.addEventListener('pointercancel', handleGlobalPointerUp);
        return () => {
            window.removeEventListener('pointerup', handleGlobalPointerUp);
            window.removeEventListener('pointercancel', handleGlobalPointerUp);
        };
    }, [isDragging, handlePointerUp]);

    return {
        isSwiping,
        translateX,
        events: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
        },
    };
};
