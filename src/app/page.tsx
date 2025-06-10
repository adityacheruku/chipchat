
"use client";

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
// Assuming UserCreate from backend will now use phone
import type { UserCreate as BackendUserCreate } from '@/chirpchat-backend/app/auth/schemas'; 

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const { login, register, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [phone, setPhone] = useState(''); // Changed from email to phone
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(''); // For registration
  const [optionalEmail, setOptionalEmail] = useState(''); // Optional email for registration
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (authMode === 'login') {
      if (!phone.trim() || !password.trim()) {
        toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please enter both phone number and password.' });
        setIsSubmitting(false);
        return;
      }
      try {
        await login(phone, password);
        // Navigation is handled by AuthContext
      } catch (error) {
        // Error toast is handled by AuthContext or api service
        console.error("Login submission error:", error);
      } finally {
        setIsSubmitting(false);
      }
    } else { // Register mode
      if (!phone.trim() || !password.trim() || !displayName.trim()) {
        toast({ variant: 'destructive', title: 'Missing Fields', description: 'Phone, password, and display name are required.' });
        setIsSubmitting(false);
        return;
      }
      if (password.length < 8) {
         toast({ variant: 'destructive', title: 'Password Too Short', description: 'Password must be at least 8 characters.' });
         setIsSubmitting(false);
         return;
      }
      // Construct userData according to backend's UserCreate schema (which now expects phone)
      const registerData: BackendUserCreate = { 
        phone, 
        password, 
        display_name: displayName,
        ...(optionalEmail.trim() && { email: optionalEmail.trim() }) // Add email if provided
      };
      try {
        await register(registerData);
        // Navigation is handled by AuthContext
      } catch (error) {
        console.error("Registration submission error:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(prevMode => prevMode === 'login' ? 'register' : 'login');
    setPhone('');
    setPassword('');
    setDisplayName('');
    setOptionalEmail('');
  };

  const loading = isAuthLoading || isSubmitting;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary">ChirpChat</CardTitle>
          <CardDescription className="text-muted-foreground">
            {authMode === 'login' ? 'Welcome back! Please log in.' : 'Create your account to join.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {authMode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required={authMode === 'register'}
                  className="bg-card focus-visible:ring-ring"
                  disabled={loading}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel" // Changed type to tel for phone numbers
                placeholder="Enter your phone number (e.g., +12223334444)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="bg-card focus-visible:ring-ring"
                disabled={loading}
              />
            </div>
            {authMode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="optionalEmail">Email (Optional)</Label>
                <Input
                  id="optionalEmail"
                  type="email"
                  placeholder="your.email@example.com"
                  value={optionalEmail}
                  onChange={(e) => setOptionalEmail(e.target.value)}
                  className="bg-card focus-visible:ring-ring"
                  disabled={loading}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-card focus-visible:ring-ring"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground transition-colors duration-200 focus-visible:ring-ring" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" /> : (authMode === 'login' ? 'Login' : 'Register')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" onClick={toggleAuthMode} disabled={loading}>
            {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
