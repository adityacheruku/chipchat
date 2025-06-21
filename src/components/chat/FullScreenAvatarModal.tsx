
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import Image from 'next/image';
import { X, Phone as PhoneIcon, Dot } from 'lucide-react';
import { Button, buttonVariants } from "@/components/ui/button";
import type { User } from '@/types';
import MoodIndicator from './MoodIndicator';
import { cn } from '@/lib/utils';
import { differenceInDays, formatDistanceToNowStrict, parseISO } from 'date-fns';

interface FullScreenAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export default function FullScreenAvatarModal({
  isOpen,
  onClose,
  user,
}: FullScreenAvatarModalProps) {
  if (!isOpen) {
    return null;
  }

  let presenceStatusText = "Offline";
  if (user.is_online) {
    presenceStatusText = "Online";
  } else if (user.last_seen) {
    try {
      const lastSeenDate = parseISO(user.last_seen);
      if (differenceInDays(new Date(), lastSeenDate) > 7) {
        presenceStatusText = "Last seen a while ago";
      } else {
        presenceStatusText = `Last seen ${formatDistanceToNowStrict(lastSeenDate, { addSuffix: true })}`;
      }
    } catch (e) {
      console.warn("Could not parse last_seen date for user:", user.last_seen);
      presenceStatusText = "Last seen: unknown";
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 bg-card border-none shadow-2xl rounded-lg overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <DialogTitle className="text-xl font-semibold text-card-foreground">{user.display_name}'s Profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center p-6 space-y-6">
          <Image
            src={user.avatar_url || "https://placehold.co/100x100.png?text=U"}
            alt={`${user.display_name}'s avatar`}
            width={160}
            height={160}
            className="rounded-full object-cover aspect-square shadow-lg border-4 border-background"
            data-ai-hint={user['data-ai-hint'] || "person portrait large"}
            priority
          />
          
          <div className="text-center space-y-3 w-full">
            <h2 className="text-2xl font-bold text-foreground">{user.display_name}</h2>
            
            <div className="flex items-center justify-center space-x-2 text-muted-foreground">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  user.is_online ? "bg-green-500" : "bg-gray-400"
                )}
                aria-hidden="true"
              />
              <span>{user.is_online ? 'Online' : presenceStatusText}</span>
            </div>

            <div className="flex justify-center">
                <MoodIndicator mood={user.mood} size={20} />
            </div>

            {user.phone && (
              <div className="pt-4 border-t border-border w-full max-w-xs mx-auto">
                <p className="text-sm text-muted-foreground mb-1">Phone</p>
                <p className="text-lg text-foreground mb-2">{user.phone}</p>
                <a
                  href={`tel:${user.phone.replace(/\s|-/g, "")}`}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  )}
                  aria-label={`Call ${user.display_name}`}
                >
                  <PhoneIcon size={16} className="mr-2" />
                  Call
                </a>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
