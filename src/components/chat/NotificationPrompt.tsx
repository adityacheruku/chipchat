
"use client";

import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationPromptProps {
  isOpen: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  partnerName?: string | null;
}

export default function NotificationPrompt({
  isOpen,
  onEnable,
  onDismiss,
  partnerName,
}: NotificationPromptProps) {
  if (!isOpen) {
    return null;
  }

  const message = partnerName
    ? `Don't miss messages from ${partnerName}.`
    : "Stay updated with your conversations.";

  return (
    <div
      className={cn(
        "absolute top-20 left-1/2 -translate-x-1/2 w-[95%] max-w-lg z-20 p-4 rounded-lg shadow-lg bg-card border border-border",
        "flex items-center justify-between gap-4",
        "animate-in slide-in-from-top-4 fade-in duration-300"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-full">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-card-foreground">Enable Notifications</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onEnable} size="sm">Enable</Button>
        <Button onClick={onDismiss} size="icon" variant="ghost" className="h-8 w-8 rounded-full">
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}
