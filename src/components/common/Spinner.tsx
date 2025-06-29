
"use client";
import { memo } from 'react';
import { cn } from '@/lib/utils';

const Spinner = ({ className }: { className?: string }) => (
  <>
    <style jsx>{`
      .loader {
        position: relative;
        width: 24px;
        height: 24px;
        margin: auto; /* Center it inside the button */
      }
      .loader div {
        position: absolute;
        border: 2px solid transparent;
        border-top-color: hsl(var(--primary));
        border-radius: 50%;
        animation: spin 1.5s linear infinite;
      }
      .loader div:nth-child(1) {
        width: 24px;
        height: 24px;
        animation-duration: 1.5s;
      }
      .loader div:nth-child(2) {
        width: 18px;
        height: 18px;
        top: 3px;
        left: 3px;
        animation-duration: 1s;
        border-top-color: hsl(var(--primary) / 0.8);
      }
      .loader div:nth-child(3) {
        width: 12px;
        height: 12px;
        top: 6px;
        left: 6px;
        animation-duration: 0.7s;
        border-top-color: hsl(var(--primary) / 0.6);
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
    <div className={cn('loader', className)}>
      <div></div>
      <div></div>
      <div></div>
    </div>
  </>
);

export default memo(Spinner);
