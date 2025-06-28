
"use client";

import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, LogOut, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export default function UserProfileModal({ 
  isOpen, 
  onClose, 
  user
}: UserProfileModalProps) {
  const { logout, isLoading } = useAuth();
  const router = useRouter();

  const handleNavigateToSettings = () => {
    router.push('/settings');
    onClose();
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs bg-card rounded-lg shadow-xl p-0">
        <DialogHeader className="p-6 pb-2 text-center">
            <div className="flex items-center justify-center">
                <Image
                    src={user.avatar_url || "https://placehold.co/100x100.png"}
                    alt={user.display_name || "User avatar"}
                    width={80}
                    height={80}
                    className="rounded-full object-cover"
                    data-ai-hint={user["data-ai-hint"] || "person portrait"}
                />
            </div>
          <DialogTitle className="font-headline text-foreground text-2xl mt-4">{user.display_name}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{user.phone || 'No phone number'}</DialogDescription>
        </DialogHeader>
        <div className="p-4 flex flex-col gap-2">
            <Button variant="default" className="w-full" onClick={handleNavigateToSettings}>
                <Settings className="mr-2 h-4 w-4"/>
                Profile & Settings
            </Button>
             <Button type="button" variant="ghost" onClick={logout} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : <LogOut className="mr-2 h-4 w-4" />}
                 Log Out
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
