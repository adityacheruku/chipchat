
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType } from '@/types';
import { mockUsers, mockMessages } from '@/lib/mock-data';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageArea from '@/components/chat/MessageArea';
import InputBar from '@/components/chat/InputBar';
import UserProfileModal from '@/components/chat/UserProfileModal';
import { useToast } from '@/hooks/use-toast';

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(mockUsers);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        localStorage.removeItem(userProfileKey); // Clear corrupted data
      }
    }

    if (!userToSet) {
      let foundInMock = mockUsers.find(u => u.name.toLowerCase() === activeUsername.toLowerCase());
      if (foundInMock) {
        userToSet = { ...foundInMock }; // Use a copy
      } else {
        // Create a new default user if not in mock and no stored profile
        userToSet = {
          id: `user_${Date.now()}`,
          name: activeUsername,
          avatar: `https://placehold.co/100x100.png?text=${activeUsername.charAt(0).toUpperCase()}`,
          mood: 'Neutral',
        };
      }
      // Persist this newly determined/created user profile
      localStorage.setItem(userProfileKey, JSON.stringify(userToSet));
    }
    
    setCurrentUser(userToSet);

    // Ensure allUsers state contains the currentUser if they are new
    if (userToSet && !allUsers.find(u => u.id === userToSet!.id)) {
        setAllUsers(prevUsers => {
            // Avoid duplicates if already added by another logic path
            if (prevUsers.find(u => u.id === userToSet!.id)) return prevUsers;
            return [...prevUsers, userToSet!];
        });
    } else if (userToSet && allUsers.find(u => u.id === userToSet!.id)) {
        // If user exists, ensure it's updated from localStorage potentially
        setAllUsers(prevUsers => prevUsers.map(u => u.id === userToSet!.id ? userToSet! : u));
    }


    // Determine otherUser. This logic remains largely the same but uses the updated allUsers.
    // For simplicity, 'otherUser' is the first mock user different from currentUser
    // or the second if currentUser is the first.
    let assignedOtherUser = allUsers.find(u => u.id !== userToSet!.id);
     if (!assignedOtherUser && mockUsers.length > 0) { // Fallback if allUsers only had currentUser
        assignedOtherUser = mockUsers[0].id !== userToSet!.id ? mockUsers[0] : (mockUsers[1] || mockUsers[0]);
    } else if (!assignedOtherUser) {
        assignedOtherUser = { id: 'other_dummy', name: 'Virtual Friend', avatar: 'https://placehold.co/100x100.png?text=V', mood: 'Neutral', "data-ai-hint": "person letter V" };
        setAllUsers(prev => [...prev, assignedOtherUser!]);
    }
    setOtherUser(assignedOtherUser);
    
    setMessages(mockMessages); // Load initial messages
    setIsLoading(false);
  }, [router, allUsers]); // Rerun if allUsers changes, e.g. when a new user is added dynamically.

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
    
    // Persist the updated profile to localStorage, using the original login username as key part
    const activeUsername = localStorage.getItem('chirpChatActiveUsername');
    if (activeUsername) { // activeUsername should always exist here
      const userProfileKey = `chirpChatUserProfile_${updatedUser.name}`; // Use updated name for key or original? For now use current name.
      // If name can be changed, need robust keying. Let's assume name change in modal implies key change.
      // For simplicity for now: if updatedUser.name is the new key.
      // Or, better: always use the *original* activeUsername for the key.
      const originalLoginUsername = localStorage.getItem('chirpChatActiveUsername');
      if (originalLoginUsername) {
          localStorage.setItem(`chirpChatUserProfile_${originalLoginUsername}`, JSON.stringify(updatedUser));
      }
    }

    toast({
      title: "Profile Updated",
      description: "Your profile information has been saved.",
    });
  };

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
        />
        <MessageArea messages={messages} currentUser={currentUser} users={allUsers} />
        <InputBar onSendMessage={handleSendMessage} />
      </div>
      {isProfileModalOpen && (
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
