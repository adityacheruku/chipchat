
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import type { UserInToken, AuthResponse } from '@/types';
import { useToast } from '@/hooks/use-toast';
import type { UserCreate } from '@/chirpchat-backend/app/auth/schemas';


interface AuthContextType {
  currentUser: UserInToken | null;
  token: string | null;
  isLoading: boolean;
  login: (username_email: string, password_plaintext: string) => Promise<void>;
  register: (userData: UserCreate) => Promise<void>;
  logout: () => void;
  fetchAndUpdateUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<UserInToken | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true to check token on load
  const router = useRouter();
  const { toast } = useToast();

  const loadUserFromToken = useCallback(async (storedToken: string) => {
    setIsLoading(true);
    try {
      // No direct "validate token" endpoint, so we fetch user profile
      // If token is invalid, getCurrentUserProfile will fail
      const userProfile = await api.getCurrentUserProfile(); // Uses token from localStorage via api helper
      setCurrentUser(userProfile);
      setToken(storedToken);
    } catch (error) {
      console.error("Failed to load user from token", error);
      localStorage.removeItem('chirpChatToken');
      localStorage.removeItem('chirpChatUser'); // Clear legacy user if exists
      setToken(null);
      setCurrentUser(null);
      // router.push('/'); // Optionally force redirect
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    const storedToken = localStorage.getItem('chirpChatToken');
    if (storedToken) {
      loadUserFromToken(storedToken);
    } else {
      setIsLoading(false); // No token, not loading
    }
  }, [loadUserFromToken]);

  const login = async (username_email: string, password_plaintext: string) => {
    setIsLoading(true);
    try {
      const data: AuthResponse = await api.login(username_email, password_plaintext);
      localStorage.setItem('chirpChatToken', data.access_token);
      // Storing user might be redundant if fetched on load, but can be useful for immediate UI update
      localStorage.setItem('chirpChatUser', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setToken(data.access_token);
      router.push('/chat');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message || 'Please check your credentials.' });
      throw error; // Re-throw for form to handle
    } finally {
      setIsLoading(false);
    }
  };
  
  const register = async (userData: UserCreate) => {
    setIsLoading(true);
    try {
      const data: AuthResponse = await api.register(userData);
      localStorage.setItem('chirpChatToken', data.access_token);
      localStorage.setItem('chirpChatUser', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setToken(data.access_token);
      router.push('/chat');
       toast({ title: 'Registration Successful!', description: 'Welcome to ChirpChat.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Registration Failed', description: error.message || 'Please try again.' });
      throw error; // Re-throw for form to handle
    } finally {
      setIsLoading(false);
    }
  };


  const logout = useCallback(() => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('chirpChatToken');
    localStorage.removeItem('chirpChatUser');
    localStorage.removeItem('chirpChatActiveUsername'); // Clear legacy item
    // Also clear other app-specific localStorage items if needed
    router.push('/');
    toast({ title: 'Logged Out', description: "You've been successfully logged out." });
  }, [router, toast]);

  const fetchAndUpdateUser = useCallback(async () => {
    if (!token) return;
    try {
      const userProfile = await api.getCurrentUserProfile();
      setCurrentUser(userProfile);
      localStorage.setItem('chirpChatUser', JSON.stringify(userProfile)); // Update stored user
    } catch (error) {
      console.error("Failed to refresh user profile", error);
      // Potentially handle token expiry here by logging out
      logout();
    }
  }, [token, logout]);

  const isAuthenticated = !!token && !!currentUser;


  return (
    <AuthContext.Provider value={{ currentUser, token, isLoading, login, register, logout, fetchAndUpdateUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
