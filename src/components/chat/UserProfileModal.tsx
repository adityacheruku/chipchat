
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import type { FormEvent, ChangeEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Loader2, Bell, BellOff, AlertTriangle, LogOut } from 'lucide-react';
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
  const { logout } = useAuth();
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
      setAvatarUploadProgress(0);
    }
  }

  // ⚡️ Memoized with useCallback to prevent re-renders when passed to form
  const handleSave = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const profileUpdates: Partial<Pick<User, 'display_name' | 'mood' | 'phone' | 'email'>> = {};
      if (user && displayName !== user.display_name) profileUpdates.display_name = displayName;
      if (user && mood !== user.mood) profileUpdates.mood = mood;
      if (user && phone !== (user.phone || '')) profileUpdates.phone = phone;

      const onProgress = (progress: number) => setAvatarUploadProgress(progress);

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
  }, [user, displayName, mood, phone, onSave, selectedAvatarFile, notificationSettings, localSettings, updateNotificationSettings, onClose]);

  const handleSettingsChange = (key: keyof NotificationSettings, value: any) => {
    setLocalSettings(prev => ({...prev, [key]: value}));
  };

  const renderNotificationButton = () => {
    if (!isPushApiSupported) return <p className="text-xs text-muted-foreground">Push not supported by browser.</p>;
    if (permissionStatus === 'denied') return <p className="text-xs text-destructive">Notifications blocked.</p>;
    if (isSubscribed) {
      return <Button variant="outline" size="sm" onClick={unsubscribeFromPush} disabled={isSubscribing}>
                {isSubscribing ? <Loader2 className="animate-spin h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />} Disable
             </Button>;
    }
    return <Button variant="default" size="sm" onClick={subscribeToPush} className="bg-primary hover:bg-primary/90" disabled={isSubscribing}>
            {isSubscribing ? <Loader2 className="animate-spin h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />} Enable
           </Button>;
  }
  
  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card rounded-lg shadow-xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-headline text-primary text-2xl">Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mt-4 px-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
            <div className="p-6">
              <TabsContent value="profile" className="m-0 space-y-6">
                <div className="flex items-center justify-center">
                  <label htmlFor="avatar-upload-modal" className="relative cursor-pointer group">
                    <Image
                      src={avatarPreview || user.avatar_url || "https://placehold.co/100x100.png"}
                      alt={displayName || "User avatar"}
                      width={80}
                      height={80}
                      className="rounded-full object-cover transition-opacity group-hover:opacity-70"
                      data-ai-hint={avatarPreview ? undefined : user["data-ai-hint"] || "person portrait"}
                      key={avatarPreview || user.avatar_url} 
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-bold">Change</span>
                    </div>
                  </label>
                  <Input id="avatar-upload-modal" type="file" onChange={internalHandleAvatarChange} className="hidden" accept="image/*" disabled={isSaving} />
                </div>
                {isSaving && avatarUploadProgress !== null && (
                  <Progress value={avatarUploadProgress} className="w-full h-2" />
                )}
                <div className="space-y-2">
                  <Label htmlFor="displayNameModal">Name</Label>
                  <Input id="displayNameModal" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-input" disabled={isSaving} autoComplete="name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneModal">Phone</Label>
                  <Input id="phoneModal" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-input" placeholder="Optional" disabled={isSaving} autoComplete="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="moodModal">Current Mood</Label>
                  <Select value={mood} onValueChange={(value) => setMood(value as Mood)} disabled={isSaving}>
                    <SelectTrigger className="bg-input"><SelectValue placeholder="Select your mood" /></SelectTrigger>
                    <SelectContent>
                      {ALL_MOODS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="notifications" className="m-0 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-foreground">Push Alerts</Label>
                  {renderNotificationButton()}
                </div>
                {isSubscribed && (
                  isSettingsLoading ? (
                    <div className="space-y-3 pt-2">
                      {[...Array(3)].map((_, i) => <div key={i} className="flex justify-between items-center"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-11" /></div>)}
                    </div>
                  ) : localSettings && (
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between"><Label htmlFor="messages-notif" className="font-normal cursor-pointer text-muted-foreground">New Messages</Label><Switch id="messages-notif" checked={localSettings.messages ?? true} onCheckedChange={(c) => handleSettingsChange('messages', c)} disabled={isSaving || isSubscribing} /></div>
                        <div className="flex items-center justify-between"><Label htmlFor="mood-notif" className="font-normal cursor-pointer text-muted-foreground">Mood Changes</Label><Switch id="mood-notif" checked={localSettings.mood_updates ?? true} onCheckedChange={(c) => handleSettingsChange('mood_updates', c)} disabled={isSaving || isSubscribing} /></div>
                        <div className="flex items-center justify-between"><Label htmlFor="pings-notif" className="font-normal cursor-pointer text-muted-foreground">"Thinking of You" Pings</Label><Switch id="pings-notif" checked={localSettings.thinking_of_you ?? true} onCheckedChange={(c) => handleSettingsChange('thinking_of_you', c)} disabled={isSaving || isSubscribing} /></div>
                    </div>
                  )
                )}
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="p-6 pt-0 sm:justify-between border-t mt-6">
            <Button type="button" variant="destructive" onClick={logout} className="w-full sm:w-auto" disabled={isSaving}>
              <LogOut className="mr-2 h-4 w-4" /> Log Out
            </Button>
            <div className="flex gap-2 mt-2 sm:mt-0">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin mr-2" /> : "Save"}
                </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
