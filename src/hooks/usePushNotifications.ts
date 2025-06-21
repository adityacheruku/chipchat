
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import type { NotificationSettings } from '@/types';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PUSH_SUBSCRIPTION_KEY = 'chirpChatPushSubscription';

// Helper function to convert base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isPushApiSupported, setIsPushApiSupported] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsPushApiSupported(true);
      setPermissionStatus(Notification.permission);
      
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          setIsSubscribed(!!subscription);
          if (subscription) {
            localStorage.setItem(PUSH_SUBSCRIPTION_KEY, JSON.stringify(subscription));
          } else {
            localStorage.removeItem(PUSH_SUBSCRIPTION_KEY);
          }
        });
      });
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!isPushApiSupported || !VAPID_PUBLIC_KEY) {
      toast({
        variant: 'destructive',
        title: 'Unsupported',
        description: 'Push notifications are not supported by your browser or are not configured.',
      });
      return;
    }

    setIsSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        setIsSubscribed(true);
        setIsSubscribing(false);
        toast({ title: 'Already Subscribed', description: 'You are already receiving notifications.' });
        return;
      }
      
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      await api.sendPushSubscriptionToServer(subscription.toJSON());
      localStorage.setItem(PUSH_SUBSCRIPTION_KEY, JSON.stringify(subscription));
      setIsSubscribed(true);
      toast({ title: 'Notifications Enabled', description: 'You will now receive push notifications.' });

    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setPermissionStatus('denied');
          toast({ variant: 'destructive', title: 'Permission Denied', description: 'Please enable notifications in your browser settings.' });
      } else {
          toast({ variant: 'destructive', title: 'Subscription Failed', description: 'Could not subscribe to notifications. Please try again.' });
      }
    } finally {
      setIsSubscribing(false);
    }
  }, [isPushApiSupported, toast]);

  const unsubscribeFromPush = useCallback(async () => {
    if (!isPushApiSupported) return;

    setIsSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await api.removePushSubscriptionFromServer(subscription.endpoint);
        const unsubscribedSuccessfully = await subscription.unsubscribe();
        if (unsubscribedSuccessfully) {
          localStorage.removeItem(PUSH_SUBSCRIPTION_KEY);
          setIsSubscribed(false);
          toast({ title: 'Notifications Disabled', description: 'You will no longer receive push notifications.' });
        } else {
             throw new Error('Failed to unsubscribe.');
        }
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      toast({ variant: 'destructive', title: 'Unsubscribe Failed', description: 'Could not disable notifications. Please try again.' });
    } finally {
      setIsSubscribing(false);
    }
  }, [isPushApiSupported, toast]);

  const fetchSettings = useCallback(async () => {
    if(!isSubscribed) return;
    try {
      const fetchedSettings = await api.getNotificationSettings();
      setSettings(fetchedSettings);
    } catch(err) {
      console.error("Failed to fetch notification settings:", err);
      toast({variant: 'destructive', title: 'Settings Error', description: 'Could not load your notification settings.'});
    }
  }, [isSubscribed, toast]);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    try {
      const updatedSettings = await api.updateNotificationSettings(newSettings);
      setSettings(updatedSettings);
      toast({title: 'Settings Saved', description: 'Your notification preferences have been updated.'});
    } catch(err) {
       console.error("Failed to update notification settings:", err);
      toast({variant: 'destructive', title: 'Save Error', description: 'Could not save your notification settings.'});
    }
  }, [toast]);

  useEffect(() => {
    if (isSubscribed) {
      fetchSettings();
    } else {
      setSettings(null);
    }
  }, [isSubscribed, fetchSettings]);

  return {
    isSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    permissionStatus,
    isPushApiSupported,
    isSubscribing,
    notificationSettings: settings,
    updateNotificationSettings: updateSettings,
  };
}
