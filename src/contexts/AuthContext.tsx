
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

  const handleAuthSuccess = useCallback((data: AuthResponse) => {
    localStorage.setItem('kuchluToken', data.access_token);
    api.setAuthToken(data.access_token);
    setCurrentUser(data.user);
    setToken(data.access_token);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setToken(null);
    api.setAuthToken(null);
    localStorage.removeItem('kuchluToken');
    if (pathname !== '/') {
        router.push('/');
    }
    toast({ title: 'Logged Out', description: "You've been successfully logged out." });
  }, [router, toast, pathname]);
  
  useEffect(() => {
    const storedToken = localStorage.getItem('kuchluToken');
    if (storedToken) {
      const loadUserFromToken = async (tokenToLoad: string) => {
        try {
          api.setAuthToken(tokenToLoad);
          const userProfile = await api.getCurrentUserProfile();
          setCurrentUser(userProfile);
          setToken(tokenToLoad);
        } catch (error) {
          console.error("Failed to load user from token", error);
          logout(); 
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

  const completeRegistration = useCallback(async (userData: CompleteRegistrationRequest) => {
    setIsLoading(true);
    try {
      const data: AuthResponse = await api.completeRegistration(userData);
      handleAuthSuccess(data);
       toast({ title: 'Registration Successful!', description: 'Welcome to Kuchlu.' });
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

  useEffect(() => {
    if (isLoading) return; 

    const isAuthPage = pathname === '/';
    const isOnboardingPage = pathname.startsWith('/onboarding');
    const isProtectedPage = !isAuthPage && !isOnboardingPage;

    if (isAuthenticated && currentUser) {
      // --- User is AUTHENTICATED ---
      if (currentUser.partner_id) {
        // User has a partner. They should be sent to /chat if they land on auth or onboarding pages.
        if (isAuthPage || isOnboardingPage) {
          router.push('/chat');
        }
        // Otherwise, they are free to navigate between /chat, /settings, etc. No redirect needed here.
      } else {
        // User has NO partner. They should be on an onboarding page.
        if (!isOnboardingPage) {
          router.push('/onboarding/find-partner');
        }
      }
    } else {
      // --- User is NOT AUTHENTICATED ---
      // If they are trying to access a protected page, redirect them to the login page.
      if (isProtectedPage) {
        router.push('/');
      }
      // Otherwise, they are on a public page (like '/') and can stay there.
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
