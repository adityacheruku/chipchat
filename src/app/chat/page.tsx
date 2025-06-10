
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType, Mood, SupportedEmoji, MessageClipType, AppEvent } from '@/types';
import { mockUsers, mockMessages } from '@/lib/mock-data'; 
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import UserProfileModal from '@/components/chat/UserProfileModal';
import FullScreenAvatarModal from '@/components/chat/FullScreenAvatarModal';
import { useToast } from '@/hooks/use-toast'; 
import { useThoughtNotification } from '@/hooks/useThoughtNotification';
import { useAvatar } from '@/hooks/useAvatar';
import { useMoodSuggestion } from '@/hooks/useMoodSuggestion.tsx';
import { THINKING_OF_YOU_DURATION, MAX_AVATAR_SIZE_KB, ENABLE_AI_MOOD_SUGGESTION } from '@/config/app-config';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/ErrorBoundary';
import { formatDistanceToNowStrict } from 'date-fns';


export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageType[]>(mockMessages); 
  const [allUsers, setAllUsers] = useState<User[]>(mockUsers);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicBgClass, setDynamicBgClass] = useState('bg-mood-default-chat-area');
  const [appEvents, setAppEvents] = useState<AppEvent[]>([]);

  const [isFullScreenAvatarOpen, setIsFullScreenAvatarOpen] = useState(false);
  const [fullScreenUserData, setFullScreenUserData] = useState<User | null>(null);

  const lastReactionToggleTimes = useRef<Record<string, number>>({}); 
  const lastMessageTextRef = useRef<string>("");

  const addAppEvent = useCallback((type: AppEvent['type'], description: string, userId?: string, userName?: string) => {
    setAppEvents(prevEvents => {
      const newEvent: AppEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        type,
        description,
        userId,
        userName,
      };
      return [newEvent, ...prevEvents].slice(0, 50);
    });
  }, []);


  const { 
    activeTargetId: activeThoughtNotificationFor, 
    initiateThoughtNotification 
  } = useThoughtNotification({ 
    duration: THINKING_OF_YOU_DURATION, 
    toast: toast 
  });

  const {
    avatarPreview,
    handleFileChange: handleAvatarFileChange,
    setAvatarPreview,
  } = useAvatar({ maxSizeKB: MAX_AVATAR_SIZE_KB, toast });


  const handleMoodChangeForAISuggestion = useCallback((newMood: Mood) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, mood: newMood };
      handleSaveProfile(updatedUser, false);
      addAppEvent('moodChange', `${currentUser.name} updated mood to ${newMood} via AI suggestion.`, currentUser.id, currentUser.name);
    }
  }, [currentUser, addAppEvent]);

  const { 
    isLoadingAISuggestion, 
    suggestMood: aiSuggestMood,
    ReasoningDialog 
  } = useMoodSuggestion({
    currentUserMood: currentUser?.mood || 'Neutral',
    onMoodChange: handleMoodChangeForAISuggestion,
    currentMessageTextRef: lastMessageTextRef,
  });

  useEffect(() => {
    const activeUsername = localStorage.getItem('chirpChatActiveUsername');
    if (!activeUsername) {
      router.push('/');
      return;
    }

    let userToSet: User | null = null;
    const userProfileKey = `chirpChatUserProfile_${activeUsername}`;
    const storedProfileJson = localStorage.getItem(userProfileKey);

    if (storedProfileJson) {
      try {
        userToSet = JSON.parse(storedProfileJson) as User;
      } catch (error) {
        console.error("Failed to parse stored user profile:", error);
        localStorage.removeItem(userProfileKey); 
      }
    }

    if (!userToSet) {
      const foundInMock = mockUsers.find(u => u.name.toLowerCase() === activeUsername.toLowerCase());
      if (foundInMock) {
        userToSet = { ...foundInMock }; 
      } else {
        userToSet = {
          id: `user_${Date.now()}`,
          name: activeUsername,
          avatar: `https://placehold.co/100x100.png?text=${activeUsername.charAt(0).toUpperCase()}`,
          mood: 'Neutral',
          isOnline: true,
          lastSeen: Date.now(),
          phone: undefined, 
          "data-ai-hint": `letter ${activeUsername.charAt(0).toUpperCase()}`,
        };
      }
    }
    
    userToSet = { ...userToSet, isOnline: true, lastSeen: Date.now() };
    localStorage.setItem(userProfileKey, JSON.stringify(userToSet)); 
    
    setCurrentUser(userToSet);
    setAvatarPreview(userToSet.avatar); 

    setAllUsers(prevUsers => {
        let users = [...prevUsers];
        const currentUserExists = users.some(u => u.id === userToSet!.id);
        if (currentUserExists) {
            users = users.map(u => u.id === userToSet!.id ? userToSet! : u);
        } else {
            users.push(userToSet!);
        }
        return users.filter((user, index, self) => index === self.findIndex((t) => t.id === user.id));
    });
        
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, setAvatarPreview]); 


  useEffect(() => {
    if (currentUser && allUsers.length > 0) {
      const potentialOtherUsers = allUsers.filter(u => u.id !== currentUser.id);
      let newOtherUser = potentialOtherUsers.length > 0 ? potentialOtherUsers[0] : null;

      if (!newOtherUser && allUsers.length === 1 && allUsers[0].id === currentUser.id) { 
        const fallbackOther: User = { 
            id: 'other_dummy_user', 
            name: 'Virtual Friend', 
            avatar: 'https://placehold.co/100x100.png?text=V', 
            mood: 'Neutral', 
            isOnline: true, 
            lastSeen: Date.now(),
            phone: '+15550001111',
            "data-ai-hint": "person letter V" 
        };
        if (!allUsers.find(u => u.id === fallbackOther.id)) {
             setAllUsers(prev => [...prev, fallbackOther].filter((user, index, self) => index === self.findIndex((t) => t.id === user.id)));
        }
        newOtherUser = fallbackOther;
      } else if (!newOtherUser) { 
         const fallbackOther: User = { 
            id: 'other_dummy_user_2', 
            name: 'Support Bot', 
            avatar: 'https://placehold.co/100x100.png?text=S', 
            mood: 'Helpful' as Mood, 
            isOnline: true, 
            lastSeen: Date.now(),
            phone: '+15552223333',
            "data-ai-hint": "letter S" 
        };
         if (!allUsers.find(u => u.id === fallbackOther.id)) {
             setAllUsers(prev => [...prev, fallbackOther].filter((user, index, self) => index === self.findIndex((t) => t.id === user.id)));
        }
        newOtherUser = fallbackOther;
      }
      
      if (!otherUser || newOtherUser.id !== otherUser.id || JSON.stringify(newOtherUser) !== JSON.stringify(otherUser)) {
        setOtherUser(newOtherUser);
      }
    }
  }, [currentUser, allUsers, otherUser]);


  const handleSendMessage = (text: string) => {
    if (!currentUser) return;
    const newMessage: MessageType = {
      id: `msg_${Date.now()}`,
      userId: currentUser.id,
      text,
      timestamp: Date.now(),
      reactions: {},
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    addAppEvent('messageSent', `${currentUser.name} sent a message: "${text.substring(0,30)}..."`, currentUser.id, currentUser.name);

    if (ENABLE_AI_MOOD_SUGGESTION && currentUser.mood) {
      lastMessageTextRef.current = text;
      aiSuggestMood(text);
    }
  };

  const handleSendMoodClip = (clipType: MessageClipType) => {
    if (!currentUser) return;
    const hasPermission = Math.random() > 0.2; 
    if (!hasPermission) {
        toast({
            variant: 'destructive',
            title: 'Permissions Required',
            description: `ChirpChat needs access to your ${clipType === 'audio' ? 'microphone' : 'camera and microphone'} to send mood clips. Please grant permission in your browser settings.`,
            duration: 7000,
        });
        return;
    }

    const placeholderText = clipType === 'audio' ? `${currentUser.name} sent an audio mood clip.` : `${currentUser.name} sent a video mood clip.`;
    const newMessage: MessageType = {
      id: `clip_${Date.now()}`,
      userId: currentUser.id,
      timestamp: Date.now(),
      clipType: clipType,
      clipPlaceholderText: placeholderText,
      reactions: {},
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    addAppEvent('moodClipSent', `${currentUser.name} sent a ${clipType} mood clip.`, currentUser.id, currentUser.name);
    toast({
      title: "Mood Clip Sent (Mock)",
      description: `Your ${clipType} mood clip placeholder has been added to the chat.`,
    });
  };


  const handleToggleReaction = useCallback((messageId: string, emoji: SupportedEmoji) => {
    if (!currentUser) return;

    const RATE_LIMIT_MS = 1000; 
    const key = `${messageId}_${emoji}`;
    const now = Date.now();

    if (lastReactionToggleTimes.current[key] && (now - lastReactionToggleTimes.current[key] < RATE_LIMIT_MS)) {
      toast({
        title: "Woah there!",
        description: "You're reacting a bit too quickly.",
        duration: 2000,
      });
      return;
    }
    lastReactionToggleTimes.current[key] = now;

    let reactionAdded = false;
    let reactedMessageText = "";

    setMessages(prevMessages => 
      prevMessages.map(msg => {
        if (msg.id === messageId) {
          reactedMessageText = msg.text?.substring(0, 20) || "a clip";
          const updatedReactions = { ...(msg.reactions || {}) };
          const existingReactors = updatedReactions[emoji] || [];
          
          if (existingReactors.includes(currentUser.id)) {
            updatedReactions[emoji] = existingReactors.filter(uid => uid !== currentUser.id);
            if (updatedReactions[emoji]?.length === 0) {
              delete updatedReactions[emoji]; 
            }
          } else {
            updatedReactions[emoji] = [...existingReactors, currentUser.id];
            reactionAdded = true;
          }
          return { ...msg, reactions: updatedReactions };
        }
        return msg;
      })
    );

    if (reactionAdded) {
        addAppEvent('reactionAdded', `${currentUser.name} reacted with ${emoji} to "${reactedMessageText}..."`, currentUser.id, currentUser.name);
    }
  }, [currentUser, toast, addAppEvent]);

  const handleSaveProfile = (updatedUser: User, triggerEvent: boolean = true) => {
    if (!currentUser) return;
    const oldMood = currentUser.mood;
    const newCurrentUser = {...updatedUser, isOnline: true, lastSeen: Date.now()};
    
    setCurrentUser(newCurrentUser);
    setAllUsers(prevUsers => 
        prevUsers.map(u => u.id === newCurrentUser.id ? newCurrentUser : u)
                 .filter((user, index, self) => index === self.findIndex((t) => t.id === user.id)) 
    );
    
    const originalLoginUsername = localStorage.getItem('chirpChatActiveUsername');
    if (originalLoginUsername) {
        localStorage.setItem(`chirpChatUserProfile_${originalLoginUsername}`, JSON.stringify(newCurrentUser));
    }
    if (triggerEvent && oldMood !== newCurrentUser.mood) {
        addAppEvent('moodChange', `${newCurrentUser.name} updated mood to ${newCurrentUser.mood}.`, newCurrentUser.id, newCurrentUser.name);
    }
  };

  const handleSendThought = useCallback((targetUserId: string) => {
    if (!currentUser || !otherUser) return;
    initiateThoughtNotification(targetUserId, otherUser.name, currentUser.name);
    addAppEvent('thoughtPingSent', `${currentUser.name} sent a 'thinking of you' to ${otherUser.name}.`, currentUser.id, currentUser.name);
  }, [currentUser, otherUser, initiateThoughtNotification, addAppEvent]);

  const getDynamicBackgroundClass = useCallback((mood1?: Mood, mood2?: Mood): string => {
    if (!mood1 || !mood2) return 'bg-mood-default-chat-area';
    
    if (mood1 === 'Happy' && mood2 === 'Happy') return 'bg-mood-happy-happy';
    if (mood1 === 'Excited' && mood2 === 'Excited') return 'bg-mood-excited-excited';
    if ( (mood1 === 'Chilling' || mood1 === 'Neutral' || mood1 === 'Thoughtful' || mood1 === 'Content') &&
         (mood2 === 'Chilling' || mood2 === 'Neutral' || mood2 === 'Thoughtful' || mood2 === 'Content') ) {
        const calmMoods = ['Chilling', 'Neutral', 'Thoughtful', 'Content'];
        if (calmMoods.includes(mood1) && calmMoods.includes(mood2)) {
           return 'bg-mood-calm-calm';
        }
    }
    if (mood1 === 'Sad' && mood2 === 'Sad') return 'bg-mood-sad-sad';
    if (mood1 === 'Angry' && mood2 === 'Angry') return 'bg-mood-angry-angry';
    if (mood1 === 'Anxious' && mood2 === 'Anxious') return 'bg-mood-anxious-anxious';
    
    if ((mood1 === 'Happy' && (mood2 === 'Sad' || mood2 === 'Angry')) || ((mood1 === 'Sad' || mood1 === 'Angry') && mood2 === 'Happy') ||
        (mood1 === 'Excited' && (mood2 === 'Sad' || mood2 === 'Chilling' || mood2 === 'Angry')) ||
        ((mood1 === 'Sad' || mood1 === 'Chilling' || mood1 === 'Angry') && mood2 === 'Excited') ) {
      return 'bg-mood-thoughtful-thoughtful'; 
    }

    return 'bg-mood-default-chat-area'; 
  }, []);

  useEffect(() => {
    if (currentUser?.mood && otherUser?.mood) {
      setDynamicBgClass(getDynamicBackgroundClass(currentUser.mood, otherUser.mood));
    } else {
      setDynamicBgClass('bg-mood-default-chat-area');
    }
  }, [currentUser?.mood, otherUser?.mood, getDynamicBackgroundClass]);

  const handleOtherUserAvatarClick = useCallback(() => {
    if (otherUser) {
      setFullScreenUserData(otherUser);
      setIsFullScreenAvatarOpen(true);
    }
  }, [otherUser]);


  if (isLoading || !currentUser || !otherUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-foreground">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-screen p-0 sm:p-0 transition-colors duration-500 relative", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
        <div className={cn("flex flex-col items-center justify-center w-full h-full p-2 sm:p-4", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
          <ErrorBoundary fallbackMessage="The chat couldn't be displayed. Try resetting or refreshing the page.">
            <div className="w-full max-w-2xl h-[95vh] sm:h-[90vh] md:h-[85vh] flex flex-col bg-card shadow-2xl rounded-lg overflow-hidden">
              <ChatHeader
                currentUser={currentUser}
                otherUser={otherUser}
                onProfileClick={() => setIsProfileModalOpen(true)}
                onSendThinkingOfYou={handleSendThought}
                isTargetUserBeingThoughtOf={activeThoughtNotificationFor === otherUser.id}
                onOtherUserAvatarClick={handleOtherUserAvatarClick}
                onToggleSidebar={() => { /* Sidebar removed */ }} 
              />
              <MessageArea 
                messages={messages} 
                currentUser={currentUser} 
                users={allUsers}
                onToggleReaction={handleToggleReaction} 
              />
              <InputBar 
                onSendMessage={handleSendMessage} 
                onSendMoodClip={handleSendMoodClip}
                isSending={isLoadingAISuggestion}
              />
            </div>
          </ErrorBoundary>
        </div>
      {isProfileModalOpen && currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={currentUser}
          onSave={handleSaveProfile}
          avatarPreview={avatarPreview}
          onAvatarFileChange={handleAvatarFileChange}
        />
      )}
      {fullScreenUserData && (
        <FullScreenAvatarModal
          isOpen={isFullScreenAvatarOpen}
          onClose={() => setIsFullScreenAvatarOpen(false)}
          user={fullScreenUserData}
        />
      )}
      <ReasoningDialog />
    </div>
  );
}
