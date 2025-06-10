
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType } from '@/types';
import { mockUsers, mockMessages } from '@/lib/mock-data';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import UserProfileModal from '@/components/chat/UserProfileModal';
import { useToast, toast as globalToast } from '@/hooks/use-toast'; // Renamed to avoid conflict
import { useThoughtNotification } from '@/hooks/useThoughtNotification';
import { THINKING_OF_YOU_DURATION } from '@/config/app-config';

export default function ChatPage() {
  const router = useRouter();
  // const { toast } = useToast(); // useToast hook for local context if needed, globalToast for direct calls
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(mockUsers);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { 
    activeTargetId: activeThoughtNotificationFor, 
    initiateThoughtNotification 
  } = useThoughtNotification({ 
    duration: THINKING_OF_YOU_DURATION, 
    toast: globalToast // Pass the global toast function
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
          "data-ai-hint": `letter ${activeUsername.charAt(0).toUpperCase()}`,
        };
      }
      localStorage.setItem(userProfileKey, JSON.stringify(userToSet));
    }
    
    setCurrentUser(userToSet);

    setAllUsers(prevUsers => {
        let users = [...prevUsers];
        const currentUserExists = users.some(u => u.id === userToSet!.id);
        if (currentUserExists) {
            users = users.map(u => u.id === userToSet!.id ? userToSet! : u);
        } else {
            users.push(userToSet!);
        }
        return users;
    });
        
    if (userToSet) { 
        const potentialOtherUsers = allUsers.filter(u => u.id !== userToSet!.id);
        let assignedOtherUser = potentialOtherUsers.length > 0 ? potentialOtherUsers[0] : null;

        if (!assignedOtherUser && mockUsers.length > 0) {
             const mockOtherUsers = mockUsers.filter(u => u.id !== userToSet!.id);
             assignedOtherUser = mockOtherUsers.length > 0 ? mockOtherUsers[0] : mockUsers[0];
        }
        
        if (!assignedOtherUser) { 
            assignedOtherUser = { 
                id: 'other_dummy', 
                name: 'Virtual Friend', 
                avatar: 'https://placehold.co/100x100.png?text=V', 
                mood: 'Neutral', 
                "data-ai-hint": "person letter V" 
            };
            setAllUsers(prev => {
                if (!prev.find(u => u.id === assignedOtherUser!.id)) {
                    return [...prev, assignedOtherUser!];
                }
                return prev;
            });
        }
        setOtherUser(assignedOtherUser);
    }
    
    setMessages(mockMessages);
    setIsLoading(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);


  useEffect(() => {
    if (currentUser && allUsers.length > 0) {
        const potentialOtherUsers = allUsers.filter(u => u.id !== currentUser.id);
        let newOtherUser = potentialOtherUsers.length > 0 ? potentialOtherUsers[0] : null;

        if (!newOtherUser) { 
            const mockOtherUsers = mockUsers.filter(u => u.id !== currentUser.id);
            newOtherUser = mockOtherUsers.length > 0 ? mockOtherUsers[0] : (mockUsers.length > 0 ? mockUsers[0] : null);
        }
         if (!newOtherUser && !allUsers.find(u => u.id === 'other_dummy')) {
            newOtherUser = { 
                id: 'other_dummy', 
                name: 'Virtual Friend', 
                avatar: 'https://placehold.co/100x100.png?text=V', 
                mood: 'Neutral', 
                "data-ai-hint": "person letter V" 
            };
             setAllUsers(prev => { 
                if (!prev.find(u => u.id === newOtherUser!.id)) {
                    return [...prev, newOtherUser!];
                }
                return prev;
            });
        } else if (!newOtherUser && allUsers.find(u => u.id === 'other_dummy')) {
           newOtherUser = allUsers.find(u => u.id === 'other_dummy')!;
        }


        if (newOtherUser && newOtherUser.id !== otherUser?.id) {
            setOtherUser(newOtherUser);
        } else if (newOtherUser && newOtherUser.id === otherUser?.id) {
            const otherUserFromAllUsers = allUsers.find(u => u.id === newOtherUser.id);
            if (otherUserFromAllUsers && JSON.stringify(otherUserFromAllUsers) !== JSON.stringify(otherUser)) {
                setOtherUser(otherUserFromAllUsers);
            }
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
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
  };

  const handleSaveProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    setAllUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
    
    const originalLoginUsername = localStorage.getItem('chirpChatActiveUsername');
    if (originalLoginUsername) {
        // Use the original login username to key the profile, even if the display name changes
        localStorage.setItem(`chirpChatUserProfile_${originalLoginUsername}`, JSON.stringify(updatedUser));
    }
  };

  const handleSendThought = useCallback((targetUserId: string) => {
    if (!currentUser || !otherUser) return;
    initiateThoughtNotification(targetUserId, otherUser.name, currentUser.name);
  }, [currentUser, otherUser, initiateThoughtNotification]);


  if (isLoading || !currentUser || !otherUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-foreground">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-2 sm:p-4">
      <div className="w-full max-w-2xl h-[95vh] sm:h-[90vh] md:h-[85vh] flex flex-col bg-card shadow-2xl rounded-lg overflow-hidden">
        <ChatHeader
          currentUser={currentUser}
          otherUser={otherUser}
          onProfileClick={() => setIsProfileModalOpen(true)}
          onSendThinkingOfYou={handleSendThought}
          isTargetUserBeingThoughtOf={activeThoughtNotificationFor === otherUser.id}
        />
        <MessageArea messages={messages} currentUser={currentUser} users={allUsers} />
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
