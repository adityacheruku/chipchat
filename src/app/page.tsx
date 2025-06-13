
"use client";

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { UserCreate as BackendUserCreate } from '@/chirpchat-backend/app/auth/schemas';

type AuthMode = 'login' | 'register';

const countryCodes = [
  { value: '+1', label: 'US (+1)' },
  { value: '+44', label: 'UK (+44)' },
  { value: '+91', label: 'India (+91)' },
  { value: '+61', label: 'Australia (+61)' },
  { value: '+49', label: 'Germany (+49)' },
  { value: '+81', label: 'Japan (+81)' },
  { value: '+33', label: 'France (+33)' },
  { value: '+86', label: 'China (+86)' },
  { value: '+55', label: 'Brazil (+55)' },
  { value: '+27', label: 'South Africa (+27)' },
  // For a production app, this list should be much more comprehensive
  // or use a dedicated library for country code input.
];

export default function AuthPage() {
  const { login, register, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  
  // For Login
  const [loginPhone, setLoginPhone] = useState('');

  // For Register
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCodes[0].value); // Default to first in list
  const [nationalPhone, setNationalPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [optionalEmail, setOptionalEmail] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (authMode === 'login') {
      if (!loginPhone.trim() || !password.trim()) {
        toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please enter both phone number and password.' });
        setIsSubmitting(false);
        return;
      }
      try {
        // For login, we assume the user enters the full E.164 phone number directly.
        // Or, if login also needs country code selection, its UI would need similar updates.
        // For now, login expects full E.164 number.
        await login(loginPhone, password);
      } catch (error: any) {
        console.error("AuthPage - Login error:", error.message, error.name, error.cause);
      } finally {
        setIsSubmitting(false);
      }
    } else { // Register mode
      if (!nationalPhone.trim() || !password.trim() || !displayName.trim()) {
        toast({ variant: 'destructive', title: 'Missing Fields', description: 'Phone, password, and display name are required.' });
        setIsSubmitting(false);
        return;
      }
      if (password.length < 8) {
         toast({ variant: 'destructive', title: 'Password Too Short', description: 'Password must be at least 8 characters.' });
         setIsSubmitting(false);
         return;
      }
      
      const fullPhoneNumber = `${selectedCountryCode}${nationalPhone.replace(/\D/g, '')}`; // Combine and strip non-digits from national part

      // Validate if the combined number looks like a plausible E.164 start (simple check)
      if (!/^\+\d{8,15}$/.test(fullPhoneNumber)) {
        toast({ variant: 'destructive', title: 'Invalid Phone Number', description: 'Please enter a valid phone number after selecting your country code.' });
        setIsSubmitting(false);
        return;
      }

      const registerData: BackendUserCreate = {
        phone: fullPhoneNumber,
        password,
        display_name: displayName,
        ...(optionalEmail.trim() && { email: optionalEmail.trim() })
      };
      try {
        await register(registerData);
      } catch (error: any) {
        console.error("AuthPage - Registration error:", error.message, error.name, error.cause);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(prevMode => prevMode === 'login' ? 'register' : 'login');
    setLoginPhone('');
    setSelectedCountryCode(countryCodes[0].value);
    setNationalPhone('');
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

            {authMode === 'login' && (
              <div className="space-y-2">
                <Label htmlFor="loginPhone">Phone Number (e.g., +12223334444)</Label>
                <Input
                  id="loginPhone"
                  type="tel"
                  placeholder="Enter your full phone number"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  required
                  className="bg-card focus-visible:ring-ring"
                  disabled={loading}
                />
              </div>
            )}

            {authMode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="nationalPhone">Phone Number</Label>
                <div className="flex space-x-2">
                  <Select value={selectedCountryCode} onValueChange={setSelectedCountryCode} disabled={loading}>
                    <SelectTrigger className="w-[120px] bg-card focus-visible:ring-ring">
                      <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {countryCodes.map(cc => (
                        <SelectItem key={cc.value} value={cc.value}>{cc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="nationalPhone"
                    type="tel"
                    placeholder="Your national number"
                    value={nationalPhone}
                    onChange={(e) => setNationalPhone(e.target.value)}
                    required
                    className="flex-1 bg-card focus-visible:ring-ring"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
            
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
                minLength={authMode === 'register' ? 8 : undefined}
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
