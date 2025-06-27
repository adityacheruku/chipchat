
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/services/api';
import type { UserInToken, AuthResponse, CompleteRegistrationRequest } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: UserInToken | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password_plaintext: string) => Promise<void>;
  // 🔒 Security: Renamed `register` to `completeRegistration` to reflect the new multi-step flow.
  completeRegistration: (userData: CompleteRegistrationRequest) => Promise<void>;
  logout: () => void;
  fetchAndUpdateUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<UserInToken | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const isAuthenticated = !!token && !!currentUser;

  // ⚡️ Memoized with useCallback to prevent re-renders in consumers
  const handleAuthSuccess = useCallback((data: AuthResponse) => {
    localStorage.setItem('chirpChatToken', data.access_token);
    api.setAuthToken(data.access_token);
    setCurrentUser(data.user);
    setToken(data.access_token);
    // ⚡️ The routing logic is now handled by the central useEffect hook
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setToken(null);
    api.setAuthToken(null);
    localStorage.removeItem('chirpChatToken');
    if (pathname !== '/') {
        router.push('/');
    }
    toast({ title: 'Logged Out', description: "You've been successfully logged out." });
  }, [router, toast, pathname]);
  
  // ⚡️ This effect now exclusively handles loading the initial state from localStorage.
  useEffect(() => {
    const storedToken = localStorage.getItem('chirpChatToken');
    if (storedToken) {
      const loadUserFromToken = async (tokenToLoad: string) => {
        try {
          api.setAuthToken(tokenToLoad);
          const userProfile = await api.getCurrentUserProfile();
          setCurrentUser(userProfile);
          setToken(tokenToLoad);
        } catch (error) {
          console.error("Failed to load user from token", error);
          logout(); // This clears invalid tokens
        } finally {
          setIsLoading(false);
        }
      };
      loadUserFromToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [logout]);
  
  const login = useCallback(async (phone: string, password_plaintext: string) => { 
    setIsLoading(true);
    try {
      const data: AuthResponse = await api.login(phone, password_plaintext); 
      handleAuthSuccess(data);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message || 'Please check your credentials.' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthSuccess, toast]);

  // 🔒 Security: This function now handles the final step of the new OTP flow.
  const completeRegistration = useCallback(async (userData: CompleteRegistrationRequest) => {
    setIsLoading(true);
    try {
      const data: AuthResponse = await api.completeRegistration(userData);
      handleAuthSuccess(data);
       toast({ title: 'Registration Successful!', description: 'Welcome to ChirpChat.' });
    } catch (error: any)
    {
      toast({ variant: 'destructive', title: 'Registration Failed', description: error.message || 'Please try again.' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthSuccess, toast]);

  const fetchAndUpdateUser = useCallback(async () => {
    if (!token) return;
    try {
      const userProfile = await api.getCurrentUserProfile();
      setCurrentUser(userProfile);
    } catch (error) {
      console.error("Failed to refresh user profile", error);
      logout();
    }
  }, [token, logout]);

  // ⚡️ This central useEffect now handles all routing logic based on auth state.
  // This prevents race conditions and ensures a single source of truth for redirects.
  useEffect(() => {
    if (isLoading) return; // Don't do anything while initial token/user is loading

    const isAuthPage = pathname === '/';
    const isOnboardingPage = pathname === '/onboarding/find-partner';
    
    if (isAuthenticated && currentUser) {
      // User is logged in
      if (currentUser.partner_id) {
        // User has a partner, should be on the chat page
        if (pathname !== '/chat') {
          router.push('/chat');
        }
      } else {
        // User has no partner, should be on the find-partner page
        if (!isOnboardingPage) {
          router.push('/onboarding/find-partner');
        }
      }
    } else {
      // User is not logged in, should be on the auth page
      if (!isAuthPage) {
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, currentUser, pathname, router]);

  return (
    <AuthContext.Provider value={{ currentUser, token, isLoading, login, completeRegistration, logout, fetchAndUpdateUser, isAuthenticated }}>
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
