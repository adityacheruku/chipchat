
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 2;
const DOUBLE_TAP_TIMEOUT = 300;

export const useZoomAndPan = () => {
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const imageRef = useRef<HTMLImageElement>(null);
    const lastTapTime = useRef(0);
    const initialPinchDistance = useRef(0);
    const lastPointerPosition = useRef({ x: 0, y: 0 });
    const isPanning = useRef(false);
    const isPinching = useRef(false);
    const pointers = useRef<PointerEvent[]>([]);

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const getPointerDistance = (p1: PointerEvent, p2: PointerEvent) => {
        return Math.sqrt(Math.pow(p1.clientX - p2.clientX, 2) + Math.pow(p1.clientY - p2.clientY, 2));
    };

    const getPointerMidpoint = (p1: PointerEvent, p2: PointerEvent) => {
        return {
            x: (p1.clientX + p2.clientX) / 2,
            y: (p1.clientY + p2.clientY) / 2,
        };
    };

    const clampOffset = useCallback((newOffset: {x: number, y: number}, currentScale: number) => {
        if (!imageRef.current) return newOffset;
        const { clientWidth, clientHeight } = imageRef.current.parentElement!;
        const { naturalWidth, naturalHeight } = imageRef.current;

        const imageAspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = clientWidth / clientHeight;

        let imageDisplayWidth = clientWidth;
        let imageDisplayHeight = clientHeight;

        if (imageAspectRatio > containerAspectRatio) {
            imageDisplayHeight = clientWidth / imageAspectRatio;
        } else {
            imageDisplayWidth = clientHeight * imageAspectRatio;
        }

        const maxOffsetX = Math.max(0, (imageDisplayWidth * currentScale - clientWidth) / 2);
        const maxOffsetY = Math.max(0, (imageDisplayHeight * currentScale - clientHeight) / 2);

        return {
            x: clamp(newOffset.x, -maxOffsetX, maxOffsetX),
            y: clamp(newOffset.y, -maxOffsetY, maxOffsetY),
        };
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        pointers.current.push(e.nativeEvent);
        pointers.current = pointers.current.filter(p => p.pointerId !== e.pointerId || p.timeStamp === e.timeStamp);
        
        if (pointers.current.length === 1) {
            // Check for double tap
            const now = Date.now();
            if (now - lastTapTime.current < DOUBLE_TAP_TIMEOUT) {
                if (scale > 1) {
                    setScale(1);
                    setOffset({ x: 0, y: 0 });
                } else {
                    const newScale = MAX_SCALE;
                    setScale(newScale);

                    if (imageRef.current) {
                        const rect = imageRef.current.parentElement!.getBoundingClientRect();
                        const newOffsetX = (rect.width / 2 - e.clientX + rect.left) * (newScale - 1);
                        const newOffsetY = (rect.height / 2 - e.clientY + rect.top) * (newScale - 1);
                        setOffset(clampOffset({x: newOffsetX, y: newOffsetY}, newScale));
                    }
                }
                lastTapTime.current = 0; // reset tap timer
            } else {
                lastTapTime.current = now;
            }
            
            isPanning.current = true;
            lastPointerPosition.current = { x: e.clientX, y: e.clientY };
        } else if (pointers.current.length === 2) {
            isPinching.current = true;
            isPanning.current = false;
            initialPinchDistance.current = getPointerDistance(pointers.current[0], pointers.current[1]);
        }
    }, [scale, clampOffset]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (isPanning.current && scale > 1 && pointers.current.length === 1) {
            const deltaX = e.clientX - lastPointerPosition.current.x;
            const deltaY = e.clientY - lastPointerPosition.current.y;
            lastPointerPosition.current = { x: e.clientX, y: e.clientY };
            setOffset(prev => clampOffset({ x: prev.x + deltaX, y: prev.y + deltaY }, scale));
        } else if (isPinching.current && pointers.current.length === 2) {
             const pointer1 = pointers.current.find(p => p.pointerId === e.pointerId);
             if (pointer1) {
                // Update the pointer position in the array
                const index = pointers.current.indexOf(pointer1);
                pointers.current[index] = e.nativeEvent;
             }
             const newDist = getPointerDistance(pointers.current[0], pointers.current[1]);
             const scaleFactor = newDist / initialPinchDistance.current;
             setScale(prevScale => {
                const newScale = clamp(prevScale * scaleFactor, MIN_SCALE, MAX_SCALE);
                setOffset(prevOffset => clampOffset(prevOffset, newScale));
                return newScale;
             });
        }
    }, [scale, clampOffset]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        pointers.current = pointers.current.filter(p => p.pointerId !== e.pointerId);
        if (pointers.current.length < 2) isPinching.current = false;
        if (pointers.current.length < 1) isPanning.current = false;
    }, []);

    const onWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const scaleDelta = e.deltaY * -0.01;
        setScale(prevScale => {
            const newScale = clamp(prevScale + scaleDelta, MIN_SCALE, MAX_SCALE);
             setOffset(prevOffset => clampOffset(prevOffset, newScale));
            return newScale;
        });
    }, [clampOffset]);

    useEffect(() => {
        if (scale === 1) {
            setOffset({ x: 0, y: 0 });
        }
    }, [scale]);

    return {
        imageRef,
        containerHandlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onWheel
        },
        style: {
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            touchAction: 'none'
        }
    };
};
