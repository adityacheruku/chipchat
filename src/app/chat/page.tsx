
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType, Mood, SupportedEmoji } from '@/types';
import { mockUsers, mockMessages } from '@/lib/mock-data';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import UserProfileModal from '@/components/chat/UserProfileModal';
import { useToast, toast as globalToast } from '@/hooks/use-toast'; 
import { useThoughtNotification } from '@/hooks/useThoughtNotification';
import { THINKING_OF_YOU_DURATION } from '@/config/app-config';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const router = useRouter();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageType[]>(mockMessages); 
  const [allUsers, setAllUsers] = useState<User[]>(mockUsers);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicBgClass, setDynamicBgClass] = useState('bg-mood-default-chat-area');


  const { 
    activeTargetId: activeThoughtNotificationFor, 
    initiateThoughtNotification 
  } = useThoughtNotification({ 
    duration: THINKING_OF_YOU_DURATION, 
    toast: globalToast 
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
          "data-ai-hint": `letter ${activeUsername.charAt(0).toUpperCase()}`,
        };
      }
    }
    // Ensure isOnline status is set for the current session
    userToSet = { ...userToSet, isOnline: true, lastSeen: Date.now() };
    localStorage.setItem(userProfileKey, JSON.stringify(userToSet)); 
    
    setCurrentUser(userToSet);

    setAllUsers(prevUsers => {
        let users = [...prevUsers];
        const currentUserExists = users.some(u => u.id === userToSet!.id);
        if (currentUserExists) {
            users = users.map(u => u.id === userToSet!.id ? userToSet! : u);
        } else {
            users.push(userToSet!);
        }
        return users.filter((user, index, self) => index === self.findIndex((t) => t.id === user.id)); // Deduplicate
    });
        
    setIsLoading(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); 


  useEffect(() => {
    // This effect ensures otherUser is correctly set and updated from allUsers
    if (currentUser && allUsers.length > 0) {
      const potentialOtherUsers = allUsers.filter(u => u.id !== currentUser.id);
      let newOtherUser = potentialOtherUsers.length > 0 ? potentialOtherUsers[0] : null;

      if (!newOtherUser) {
        const fallbackOther: User = { 
            id: 'other_dummy_user', 
            name: 'Virtual Friend', 
            avatar: 'https://placehold.co/100x100.png?text=V', 
            mood: 'Neutral', 
            isOnline: true,
            lastSeen: Date.now(),
            "data-ai-hint": "person letter V" 
        };
        if (!allUsers.find(u => u.id === fallbackOther.id)) {
             setAllUsers(prev => [...prev, fallbackOther].filter((user, index, self) => index === self.findIndex((t) => t.id === user.id))); // Deduplicate
        }
        newOtherUser = fallbackOther;
      }
      
      // Only update otherUser if it's different or its properties have changed
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
  };

  const handleToggleReaction = useCallback((messageId: string, emoji: SupportedEmoji) => {
    if (!currentUser) return;
    setMessages(prevMessages => 
      prevMessages.map(msg => {
        if (msg.id === messageId) {
          const updatedReactions = { ...(msg.reactions || {}) };
          const existingReactors = updatedReactions[emoji] || [];
          
          if (existingReactors.includes(currentUser.id)) {
            // User already reacted, remove reaction
            updatedReactions[emoji] = existingReactors.filter(uid => uid !== currentUser.id);
            if (updatedReactions[emoji]?.length === 0) {
              delete updatedReactions[emoji]; 
            }
          } else {
            // User has not reacted, add reaction
            updatedReactions[emoji] = [...existingReactors, currentUser.id];
          }
          return { ...msg, reactions: updatedReactions };
        }
        return msg;
      })
    );
  }, [currentUser]);

  const handleSaveProfile = (updatedUser: User) => {
    const newCurrentUser = {...updatedUser, isOnline: true, lastSeen: Date.now()};
    setCurrentUser(newCurrentUser);
    setAllUsers(prevUsers => 
        prevUsers.map(u => u.id === newCurrentUser.id ? newCurrentUser : u)
                 .filter((user, index, self) => index === self.findIndex((t) => t.id === user.id)) // Deduplicate
    );
    
    const originalLoginUsername = localStorage.getItem('chirpChatActiveUsername');
    if (originalLoginUsername) {
        localStorage.setItem(`chirpChatUserProfile_${originalLoginUsername}`, JSON.stringify(newCurrentUser));
    }
  };

  const handleSendThought = useCallback((targetUserId: string) => {
    if (!currentUser || !otherUser) return;
    initiateThoughtNotification(targetUserId, otherUser.name, currentUser.name);
  }, [currentUser, otherUser, initiateThoughtNotification]);

  const getDynamicBackgroundClass = useCallback((mood1?: Mood, mood2?: Mood): string => {
    if (!mood1 || !mood2) return 'bg-mood-default-chat-area';
    
    const sortedMoods = [mood1, mood2].sort().join('-');

    if (mood1 === 'Happy' && mood2 === 'Happy') return 'bg-mood-happy-happy';
    if (mood1 === 'Excited' && mood2 === 'Excited') return 'bg-mood-excited-excited';
    if ( (mood1 === 'Chilling' || mood1 === 'Neutral' || mood1 === 'Thoughtful') &&
         (mood2 === 'Chilling' || mood2 === 'Neutral' || mood2 === 'Thoughtful') ) {
      if (sortedMoods === 'Chilling-Chilling' || sortedMoods === 'Neutral-Neutral' || sortedMoods === 'Thoughtful-Thoughtful' ||
          sortedMoods === 'Chilling-Neutral' || sortedMoods === 'Chilling-Thoughtful' || sortedMoods === 'Neutral-Thoughtful') {
        return 'bg-mood-calm-calm';
      }
    }
    if (mood1 === 'Sad' && mood2 === 'Sad') return 'bg-mood-sad-sad';
    
    if ((mood1 === 'Happy' && mood2 === 'Sad') || (mood1 === 'Sad' && mood2 === 'Happy')) return 'bg-mood-thoughtful-thoughtful'; 

    return 'bg-mood-default-chat-area'; 
  }, []);

  useEffect(() => {
    if (currentUser?.mood && otherUser?.mood) {
      setDynamicBgClass(getDynamicBackgroundClass(currentUser.mood, otherUser.mood));
    } else {
      setDynamicBgClass('bg-mood-default-chat-area');
    }
  }, [currentUser?.mood, otherUser?.mood, getDynamicBackgroundClass]);


  if (isLoading || !currentUser || !otherUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-foreground">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-screen p-2 sm:p-4 transition-colors duration-500", dynamicBgClass === 'bg-mood-default-chat-area' ? 'bg-background' : dynamicBgClass)}>
      <div className="w-full max-w-2xl h-[95vh] sm:h-[90vh] md:h-[85vh] flex flex-col bg-card shadow-2xl rounded-lg overflow-hidden">
        <ChatHeader
          currentUser={currentUser}
          otherUser={otherUser}
          onProfileClick={() => setIsProfileModalOpen(true)}
          onSendThinkingOfYou={handleSendThought}
          isTargetUserBeingThoughtOf={activeThoughtNotificationFor === otherUser.id}
        />
        <MessageArea 
          messages={messages} 
          currentUser={currentUser} 
          users={allUsers}
          onToggleReaction={handleToggleReaction} 
        />
        <InputBar onSendMessage={handleSendMessage} />
      </div>
      {isProfileModalOpen && currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={currentUser}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
