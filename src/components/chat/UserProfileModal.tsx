
import type { User, Mood, NotificationSettings } from '@/types';
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
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Loader2, Bell, BellOff, AlertTriangle } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (updatedProfileData: Partial<Pick<User, 'display_name' | 'mood' | 'phone'>>, newAvatarFile?: File, onProgress?: (progress: number) => void) => Promise<void>;
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
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number | null>(null);
  
  const {
    isSubscribed,
    permissionStatus,
    subscribeToPush,
    unsubscribeFromPush,
    isPushApiSupported,
    isSubscribing,
    notificationSettings,
    updateNotificationSettings
  } = usePushNotifications();

  // Local state for notification settings toggles
  const [localSettings, setLocalSettings] = useState<Partial<NotificationSettings>>({});
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);

  const { toast } = useToast();
  
  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.display_name);
      setMood(user.mood);
      setPhone(user.phone || '');
      setSelectedAvatarFile(null);
      setAvatarUploadProgress(null);
    }
  }, [user, isOpen]);
  
  useEffect(() => {
    if (isOpen && notificationSettings) {
        setLocalSettings(notificationSettings);
        setIsSettingsLoading(false);
    } else if (isOpen && isSubscribed) {
        setIsSettingsLoading(true);
    } else {
        setIsSettingsLoading(false);
    }
  }, [isOpen, notificationSettings, isSubscribed]);


  const internalHandleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    onAvatarFileChange(e, user?.avatar_url);
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAvatarFile(file);
      setAvatarUploadProgress(0); // Reset progress on new file selection
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const profileUpdates: Partial<Pick<User, 'display_name' | 'mood' | 'phone' | 'email'>> = {};
      if (user && displayName !== user.display_name) profileUpdates.display_name = displayName;
      if (user && mood !== user.mood) profileUpdates.mood = mood;
      if (user && phone !== (user.phone || '')) profileUpdates.phone = phone;

      const onProgress = (progress: number) => {
        setAvatarUploadProgress(progress);
      };

      await onSave(profileUpdates, selectedAvatarFile || undefined, onProgress);

      if (notificationSettings && JSON.stringify(localSettings) !== JSON.stringify(notificationSettings)) {
          await updateNotificationSettings(localSettings);
      }

      onClose();
    } catch (error: any) {
      console.error("Error saving profile from modal:", error.message);
    } finally {
      setIsSaving(false);
      setAvatarUploadProgress(null);
    }
  };

  const handleSettingsChange = (key: keyof NotificationSettings, value: any) => {
    setLocalSettings(prev => ({...prev, [key]: value}));
  };

  const renderNotificationButton = () => {
    if (!isPushApiSupported) {
      return (
        <div className="flex items-center text-sm text-muted-foreground gap-2">
            <AlertTriangle className="text-amber-500 h-4 w-4" />
            <p>Push not supported by browser.</p>
        </div>
      );
    }
    if (permissionStatus === 'denied') {
      return (
        <div className="flex items-center text-sm text-destructive gap-2">
             <BellOff className="h-4 w-4" />
            <p>Notifications blocked by browser.</p>
        </div>
      );
    }
    if (isSubscribed) {
      return (
        <Button variant="outline" size="sm" onClick={unsubscribeFromPush} disabled={isSubscribing}>
          {isSubscribing ? <Loader2 className="animate-spin h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
          Disable
        </Button>
      );
    }
    return (
      <Button variant="default" size="sm" onClick={subscribeToPush} className="bg-primary hover:bg-primary/90" disabled={isSubscribing}>
        {isSubscribing ? <Loader2 className="animate-spin h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
        Enable
      </Button>
    );
  }
  
  if (!user) return null;

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
            {isSaving && avatarUploadProgress !== null && (
              <div className="grid grid-cols-4 items-center gap-4">
                  <div className="col-start-2 col-span-3">
                      <Progress value={avatarUploadProgress} className="w-full h-2" />
                      <p className="text-xs text-muted-foreground mt-1 text-right">{avatarUploadProgress}%</p>
                  </div>
              </div>
            )}
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

            <div className="space-y-4 rounded-lg border bg-card p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-foreground">
                  Push Alerts
                </Label>
                {renderNotificationButton()}
              </div>
              {isSubscribed && (
                isSettingsLoading ? (
                  <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-11" /></div>
                      <div className="flex justify-between items-center"><Skeleton className="h-4 w-28" /><Skeleton className="h-6 w-11" /></div>
                      <div className="flex justify-between items-center"><Skeleton className="h-4 w-32" /><Skeleton className="h-6 w-11" /></div>
                  </div>
                ) : localSettings && (
                  <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="messages-notif" className="font-normal cursor-pointer text-muted-foreground">
                            New Messages
                        </Label>
                        <Switch id="messages-notif" checked={localSettings.messages ?? true} onCheckedChange={(c) => handleSettingsChange('messages', c)} disabled={isSaving || isSubscribing} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="mood-notif" className="font-normal cursor-pointer text-muted-foreground">
                            Mood Changes
                        </Label>
                        <Switch id="mood-notif" checked={localSettings.mood_updates ?? true} onCheckedChange={(c) => handleSettingsChange('mood_updates', c)} disabled={isSaving || isSubscribing} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pings-notif" className="font-normal cursor-pointer text-muted-foreground">
                            "Thinking of You" Pings
                        </Label>
                        <Switch id="pings-notif" checked={localSettings.thinking_of_you ?? true} onCheckedChange={(c) => handleSettingsChange('thinking_of_you', c)} disabled={isSaving || isSubscribing} />
                      </div>
                  </div>
                )
              )}
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
