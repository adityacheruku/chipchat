
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/services/api';
import type { UserInToken, AuthResponse } from '@/types';
import { useToast } from '@/hooks/use-toast';
import type { UserCreate as BackendUserCreate } from '@/chirpchat-backend/app/auth/schemas';

interface AuthContextType {
  currentUser: UserInToken | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password_plaintext: string) => Promise<void>;
  register: (userData: BackendUserCreate) => Promise<void>;
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
    localStorage.setItem('chirpChatUser', JSON.stringify(data.user));
    api.setAuthToken(data.access_token);
    setCurrentUser(data.user);
    setToken(data.access_token);
    if (data.user.partner_id) {
      router.push('/chat');
    } else {
      router.push('/onboarding/find-partner');
    }
  }, [router]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setToken(null);
    api.setAuthToken(null);
    localStorage.removeItem('chirpChatToken');
    localStorage.removeItem('chirpChatUser');
    router.push('/');
    toast({ title: 'Logged Out', description: "You've been successfully logged out." });
  }, [router, toast]);
  
  const loadUserFromToken = useCallback(async (storedToken: string) => {
    setIsLoading(true);
    try {
      api.setAuthToken(storedToken);
      const userProfile = await api.getCurrentUserProfile();
      setCurrentUser(userProfile);
      setToken(storedToken);
    } catch (error) {
      console.error("Failed to load user from token", error);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);


  useEffect(() => {
    const storedToken = localStorage.getItem('chirpChatToken');
    if (storedToken) {
      loadUserFromToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [loadUserFromToken]);
  
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

  const register = useCallback(async (userData: BackendUserCreate) => {
    setIsLoading(true);
    try {
      const data: AuthResponse = await api.register(userData);
      handleAuthSuccess(data);
       toast({ title: 'Registration Successful!', description: 'Welcome to ChirpChat.' });
    } catch (error: any) {
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
      localStorage.setItem('chirpChatUser', JSON.stringify(userProfile));
    } catch (error) {
      console.error("Failed to refresh user profile", error);
      logout();
    }
  }, [token, logout]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && currentUser) {
      const isAuthPage = pathname === '/';
      const isOnboardingPage = pathname === '/onboarding/find-partner';

      if (currentUser.partner_id) {
        if (isAuthPage || isOnboardingPage) {
          router.push('/chat');
        }
      } else {
        if (!isOnboardingPage) {
          router.push('/onboarding/find-partner');
        }
      }
    }
  }, [isLoading, isAuthenticated, currentUser, pathname, router]);

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
