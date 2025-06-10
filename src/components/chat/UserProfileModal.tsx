
import type { User, Mood } from '@/types';
import { ALL_MOODS } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import type { FormEvent, ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (updatedProfileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone'>>, newAvatarFile?: File) => Promise<void>;
  avatarPreview: string | null;
  onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>, currentAvatarUrl?: string | null) => void;
}

export default function UserProfileModal({ 
  isOpen, 
  onClose, 
  user, 
  onSave,
  avatarPreview,
  onAvatarFileChange
}: UserProfileModalProps) {
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [mood, setMood] = useState<Mood>(user?.mood || 'Neutral');
  const [phone, setPhone] = useState(user?.phone || '');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();


  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setMood(user.mood);
      setPhone(user.phone || '');
      // Avatar preview is managed by parent via props
      setSelectedAvatarFile(null); // Reset selected file when modal opens or user changes
    }
  }, [user, isOpen]); // Reset form when modal opens or user data changes

  if (!user) return null;

  const internalHandleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    onAvatarFileChange(e, user.avatar_url); // Let parent hook handle preview
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAvatarFile(file);
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const profileUpdates: Partial<Pick<User, 'display_name' | 'mood' | 'phone'>> = {};
      if (displayName !== user.display_name) profileUpdates.display_name = displayName;
      if (mood !== user.mood) profileUpdates.mood = mood;
      if (phone !== (user.phone || '')) profileUpdates.phone = phone;

      await onSave(profileUpdates, selectedAvatarFile || undefined);
      // Toast for success is handled in parent `onSave`
      onClose(); // Close modal on successful save
    } catch (error: any) {
      // Toast for error is handled in parent `onSave`
      console.error("Error saving profile from modal:", error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">Your Profile</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update your display name, picture, and mood.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <div className="grid gap-6 py-4">
            <div className="flex items-center justify-center">
              <Image
                src={avatarPreview || user.avatar_url || "https://placehold.co/100x100.png"}
                alt={displayName || "User avatar"}
                width={80}
                height={80}
                className="rounded-full object-cover"
                data-ai-hint={avatarPreview ? undefined : user["data-ai-hint"] || "person portrait"}
                key={avatarPreview || user.avatar_url} 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="displayNameModal" className="text-right text-foreground">
                Name
              </Label>
              <Input
                id="displayNameModal"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="col-span-3 bg-card focus:ring-primary"
                disabled={isSaving}
              />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phoneModal" className="text-right text-foreground">
                Phone
              </Label>
              <Input
                id="phoneModal"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="col-span-3 bg-card focus:ring-primary"
                placeholder="Optional"
                disabled={isSaving}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="avatar-upload-modal" className="text-right text-foreground">
                Picture
              </Label>
              <Input
                id="avatar-upload-modal"
                type="file"
                onChange={internalHandleAvatarChange}
                className="col-span-3 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                accept="image/*"
                disabled={isSaving}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="moodModal" className="text-right text-foreground">
                Mood
              </Label>
              <Select value={mood} onValueChange={(value) => setMood(value as Mood)} disabled={isSaving}>
                <SelectTrigger className="col-span-3 bg-card focus:ring-primary">
                  <SelectValue placeholder="Select your mood" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_MOODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="hover:bg-muted active:bg-muted/80" disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin mr-2" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
