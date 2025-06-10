"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Message as MessageType, Mood } from '@/types';
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
    const storedUsername = localStorage.getItem('chirpChatUser');
    if (!storedUsername) {
      router.push('/');
      return;
    }

    let user = allUsers.find(u => u.name.toLowerCase() === storedUsername.toLowerCase());
    if (!user) {
      user = {
        id: `user_${Date.now()}`,
        name: storedUsername,
        avatar: `https://placehold.co/100x100.png?text=${storedUsername.charAt(0).toUpperCase()}`,
        mood: 'Neutral',
      };
      setAllUsers(prevUsers => [...prevUsers, user!]); // Add new user to the list
    }
    
    setCurrentUser(user);

    // For simplicity, 'otherUser' is the first mock user different from currentUser
    // or the second if currentUser is the first.
    let assignedOtherUser = allUsers.find(u => u.id !== user!.id);
    if (!assignedOtherUser && allUsers.length > 1) { // Handle if only one user was in mockUsers and it was current
        assignedOtherUser = allUsers.find(u => u.id === user!.id) === allUsers[0] ? allUsers[1] : allUsers[0];
    } else if (!assignedOtherUser) { // No other users at all, create a default one or handle appropriately
        // For now, if no other user, this might be an issue. Let's assume mockUsers has at least one other.
        // This scenario should be rare if mockUsers has multiple entries.
        // If only one user exists (the current user), then otherUser will be null.
        // For this phase, let's assume we always find an otherUser if mockUsers.length > 0
        if (mockUsers.length > 0) {
          assignedOtherUser = mockUsers[0].id !== user!.id ? mockUsers[0] : (mockUsers[1] || mockUsers[0]);
        } else {
          // Fallback: create a dummy other user if mockUsers is empty
          assignedOtherUser = { id: 'other_dummy', name: 'Virtual Friend', avatar: 'https://placehold.co/100x100.png?text=V', mood: 'Neutral' };
          setAllUsers(prev => [...prev, assignedOtherUser!]);
        }
    }
    setOtherUser(assignedOtherUser);
    
    setMessages(mockMessages); // Load initial messages
    setIsLoading(false);
  }, [router, allUsers]); // Add allUsers to dependency array to react to new user creation

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
