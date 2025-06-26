
"use client";

import { useState, type FormEvent, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { UserCreate as BackendUserCreate } from '@/chirpchat-backend/app/auth/schemas';

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
];

export default function AuthPage() {
  const { login, register, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Login State
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regCountryCode, setRegCountryCode] = useState(countryCodes[0].value);
  const [regNationalPhone, setRegNationalPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regOptionalEmail, setRegOptionalEmail] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!loginPhone.trim() || !loginPassword.trim()) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please enter both phone number and password.' });
      setIsSubmitting(false);
      return;
    }
    try {
      await login(loginPhone, loginPassword);
    } catch (error: any) {
      console.error("AuthPage - Login error:", error.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [login, loginPhone, loginPassword, toast]);

  const handleRegisterSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!regNationalPhone.trim() || !regPassword.trim() || !regDisplayName.trim()) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Phone, password, and display name are required.' });
      setIsSubmitting(false);
      return;
    }
    if (regPassword.length < 8) {
       toast({ variant: 'destructive', title: 'Password Too Short', description: 'Password must be at least 8 characters.' });
       setIsSubmitting(false);
       return;
    }
    
    const fullPhoneNumber = `${regCountryCode}${regNationalPhone.replace(/\D/g, '')}`;

    const registerData: BackendUserCreate = {
      phone: fullPhoneNumber,
      password: regPassword,
      display_name: regDisplayName,
      ...(regOptionalEmail.trim() && { email: regOptionalEmail.trim() })
    };

    try {
      await register(registerData);
    } catch (error: any) {
      console.error("AuthPage - Registration error:", error.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [register, regCountryCode, regNationalPhone, regPassword, regDisplayName, regOptionalEmail, toast]);

  const loading = isAuthLoading || isSubmitting;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary">ChirpChat</CardTitle>
          <CardDescription className="text-muted-foreground">
            A private space, just for the two of you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" value={authMode} onValueChange={(value) => setAuthMode(value as 'login' | 'register')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="loginPhone">Phone Number</Label>
                  <Input
                    id="loginPhone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    required
                    className="bg-input focus-visible:ring-ring"
                    disabled={loading}
                    // ⚡️ Added autoComplete for better accessibility and user experience
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginPassword">Password</Label>
                  <Input
                    id="loginPassword"
                    type="password"
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="bg-input focus-visible:ring-ring"
                    disabled={loading}
                    // ⚡️ Added autoComplete for better accessibility and password manager integration
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mr-2" /> : 'Login'}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegisterSubmit} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="How you'll appear in chat"
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    required
                    className="bg-input focus-visible:ring-ring"
                    disabled={loading}
                    // ⚡️ Added autoComplete for better accessibility and user experience
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regNationalPhone">Phone Number</Label>
                  <div className="flex space-x-2">
                    <Select value={regCountryCode} onValueChange={setRegCountryCode} disabled={loading}>
                      <SelectTrigger className="w-[120px] bg-input focus-visible:ring-ring">
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent>
                        {countryCodes.map(cc => (
                          <SelectItem key={cc.value} value={cc.value}>{cc.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="regNationalPhone"
                      type="tel"
                      placeholder="Your number"
                      value={regNationalPhone}
                      onChange={(e) => setRegNationalPhone(e.target.value)}
                      required
                      className="flex-1 bg-input focus-visible:ring-ring"
                      disabled={loading}
                      // ⚡️ Added autoComplete for better accessibility and user experience
                      autoComplete="tel-national"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regPassword">Password</Label>
                  <Input
                    id="regPassword"
                    type="password"
                    placeholder="8+ characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    className="bg-input focus-visible:ring-ring"
                    disabled={loading}
                    minLength={8}
                    // ⚡️ Added autoComplete for better accessibility and password manager integration
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regOptionalEmail">Email (Optional)</Label>
                  <Input
                    id="regOptionalEmail"
                    type="email"
                    placeholder="For account recovery"
                    value={regOptionalEmail}
                    onChange={(e) => setRegOptionalEmail(e.target.value)}
                    className="bg-input focus-visible:ring-ring"
                    disabled={loading}
                    // ⚡️ Added autoComplete for better accessibility and user experience
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mr-2" /> : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
