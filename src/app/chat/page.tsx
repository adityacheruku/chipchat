
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType } from '@/types';
import { mockUsers, mockMessages } from '@/lib/mock-data';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import UserProfileModal from '@/components/chat/UserProfileModal';
import { useToast } from '@/hooks/use-toast';

const THINKING_OF_YOU_DURATION = 30 * 1000; // 30 seconds for testing, original 10 * 60 * 1000 for 10 mins

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(mockUsers);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [activeThoughtNotificationFor, setActiveThoughtNotificationFor] = useState<string | null>(null);
  const thoughtTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

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
    
    // This effect runs when allUsers is updated, which happens after currentUser is set.
    // We need to select otherUser *after* allUsers is guaranteed to contain the currentUser.
    // To do this safely, let's move otherUser selection logic to another effect or ensure it runs after allUsers update.
    // For now, assuming allUsers will contain currentUser for the first render after login.
    // A more robust way would be to derive otherUser inside the render or use a separate effect dependent on `allUsers`.
    
    // Initial setup of otherUser
    if (userToSet) { // Ensure currentUser is set before determining otherUser
        const potentialOtherUsers = allUsers.filter(u => u.id !== userToSet!.id);
        let assignedOtherUser = potentialOtherUsers.length > 0 ? potentialOtherUsers[0] : null;

        if (!assignedOtherUser && mockUsers.length > 0) {
             const mockOtherUsers = mockUsers.filter(u => u.id !== userToSet!.id);
             assignedOtherUser = mockOtherUsers.length > 0 ? mockOtherUsers[0] : mockUsers[0]; // Fallback to first mock if current is the only one different
        }
        
        if (!assignedOtherUser) { // If still no other user (e.g. only one user in system)
            assignedOtherUser = { 
                id: 'other_dummy', 
                name: 'Virtual Friend', 
                avatar: 'https://placehold.co/100x100.png?text=V', 
                mood: 'Neutral', 
                "data-ai-hint": "person letter V" 
            };
            // Add this dummy user to allUsers if not already present, so it can be found by ID
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

    // Cleanup timeouts on unmount
    return () => {
      Object.values(thoughtTimeoutsRef.current).forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // Only router as dependency for initial load logic. AllUsers updates handled separately if needed.


  // Effect to update otherUser when allUsers changes (e.g. profile update) or currentUser changes
  useEffect(() => {
    if (currentUser && allUsers.length > 0) {
        const potentialOtherUsers = allUsers.filter(u => u.id !== currentUser.id);
        let newOtherUser = potentialOtherUsers.length > 0 ? potentialOtherUsers[0] : null;

        if (!newOtherUser) { // Fallback logic similar to above
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
             setAllUsers(prev => { // Ensure this new dummy is added if needed
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
            // If it's the same user, check if their details (avatar, mood) changed
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
        localStorage.setItem(`chirpChatUserProfile_${originalLoginUsername}`, JSON.stringify(updatedUser));
    }

    // toast is now called from UserProfileModal after onSave
  };

  const handleSendThinkingOfYou = useCallback((targetUserId: string) => {
    if (!currentUser) return;

    setActiveThoughtNotificationFor(targetUserId);
    toast({
      title: "Sent!",
      description: `You let ${otherUser?.name || 'them'} know you're thinking of them.`,
      duration: 3000,
    });

    if (thoughtTimeoutsRef.current[targetUserId]) {
      clearTimeout(thoughtTimeoutsRef.current[targetUserId]);
    }

    thoughtTimeoutsRef.current[targetUserId] = setTimeout(() => {
      setActiveThoughtNotificationFor(currentId => (currentId === targetUserId ? null : currentId));
      delete thoughtTimeoutsRef.current[targetUserId];
    }, THINKING_OF_YOU_DURATION);
  }, [currentUser, otherUser?.name, toast]);


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
          onSendThinkingOfYou={handleSendThinkingOfYou}
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
