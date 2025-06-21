
"use client";

import React from 'react';
import type { Message, User, SupportedEmoji } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCircle2 } from 'lucide-react';

interface ReactionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reactions: Message['reactions'];
  allUsers: Record<string, User>;
}

export default function ReactionSummaryModal({
  isOpen,
  onClose,
  reactions,
  allUsers,
}: ReactionSummaryModalProps) {
  if (!isOpen || !reactions || Object.keys(reactions).length === 0) {
    return null;
  }

  const reactionEntries = Object.entries(reactions) as [SupportedEmoji, string[]][];
  const defaultTab = reactionEntries[0]?.[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card rounded-lg shadow-xl p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="font-headline text-primary">Reactions</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-muted">
              {reactionEntries.map(([emoji, userIds]) => (
                <TabsTrigger key={emoji} value={emoji} className="text-xl">
                  {emoji} <span className="text-sm font-normal ml-1">({userIds.length})</span>
                </TabsTrigger>
              ))}
            </TabsList>
            
            <ScrollArea className="h-64 mt-4">
              {reactionEntries.map(([emoji, userIds]) => (
                <TabsContent key={emoji} value={emoji} className="mt-0">
                  <div className="space-y-4">
                    {userIds.map(userId => {
                      const user = allUsers[userId];
                      return (
                        <div key={userId} className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarImage src={user?.avatar_url || undefined} alt={user?.display_name} />
                            <AvatarFallback>
                              {user ? user.display_name.charAt(0).toUpperCase() : <UserCircle2 />}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-sm font-medium text-foreground">
                            {user?.display_name || 'Unknown User'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
