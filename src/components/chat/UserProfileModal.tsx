
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
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Loader2, Bell, BellOff } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Switch } from '@/components/ui/switch';

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
  
  // State for notification toggles (UI only for now)
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [moodNotifications, setMoodNotifications] = useState(true);
  const [pingNotifications, setPingNotifications] = useState(true);

  const { toast } = useToast();
  
  const {
    isSubscribed,
    permissionStatus,
    subscribeToPush,
    unsubscribeFromPush,
    isPushApiSupported,
    isSubscribing
  } = usePushNotifications();

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setMood(user.mood);
      setPhone(user.phone || '');
      setSelectedAvatarFile(null);
    }
  }, [user, isOpen]);

  if (!user) return null;

  const internalHandleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    onAvatarFileChange(e, user.avatar_url);
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

      // Note: Notification settings are not saved to the backend in this version.
      await onSave(profileUpdates, selectedAvatarFile || undefined);
      onClose();
    } catch (error: any) {
      console.error("Error saving profile from modal:", error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderNotificationButton = () => {
    if (!isPushApiSupported) {
      return <p className="col-span-3 text-sm text-muted-foreground">Push notifications are not supported on this browser.</p>;
    }
    if (permissionStatus === 'denied') {
      return <p className="col-span-3 text-sm text-destructive">You have blocked notifications. Please enable them in your browser settings.</p>;
    }
    if (isSubscribed) {
      return (
        <Button variant="outline" onClick={unsubscribeFromPush} className="col-span-3" disabled={isSubscribing}>
          {isSubscribing ? <Loader2 className="animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}
          Disable Notifications
        </Button>
      );
    }
    return (
      <Button variant="outline" onClick={subscribeToPush} className="col-span-3" disabled={isSubscribing}>
        {isSubscribing ? <Loader2 className="animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
        Enable Notifications
      </Button>
    );
  }

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
            
            <Separator />

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-foreground">
                Push Alerts
              </Label>
              {renderNotificationButton()}
            </div>

            {isSubscribed && (
              <div className="col-span-4 grid gap-4 rounded-lg border bg-card p-4 shadow-inner">
                <p className="text-sm font-medium text-muted-foreground -mt-1 mb-1">Notify me about...</p>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="messages-notif" className="font-normal cursor-pointer">
                    New Messages
                  </Label>
                  <Switch
                    id="messages-notif"
                    checked={messageNotifications}
                    onCheckedChange={setMessageNotifications}
                    disabled={isSaving || isSubscribing}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="mood-notif" className="font-normal cursor-pointer">
                    Mood Changes
                  </Label>
                  <Switch
                    id="mood-notif"
                    checked={moodNotifications}
                    onCheckedChange={setMoodNotifications}
                    disabled={isSaving || isSubscribing}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="pings-notif" className="font-normal cursor-pointer">
                    "Thinking of You" Pings
                  </Label>
                  <Switch
                    id="pings-notif"
                    checked={pingNotifications}
                    onCheckedChange={setPingNotifications}
                    disabled={isSaving || isSubscribing}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Note: Granular controls are for UI demonstration and are not yet saved.
                </p>
              </div>
            )}

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
