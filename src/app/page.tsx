
"use client";

import { useState, type FormEvent, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone, User as UserIcon, Lock, Mail } from 'lucide-react';
import type { UserCreate as BackendUserCreate } from '@/chirpchat-backend/app/auth/schemas';
import { Checkbox } from '@/components/ui/checkbox';

// Component for the logo
const Logo = () => (
    <svg 
        className="w-32 h-auto text-foreground mx-auto" 
        viewBox="0 0 200 80" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ChirpChat Logo"
        data-ai-hint="signature logo"
    >
        <path d="M10 70 Q 20 20, 40 50 T 70 60 Q 80 20, 100 50 T 130 60 Q 140 30, 160 50 T 190 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <path d="M75 30 Q 90 5, 105 30 T 135 25" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M170 30 A 15 15, 0, 1, 1, 170 60 A 15 15, 0, 1, 1, 170 30" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
);

// Component for the password strength indicator
const PasswordStrengthIndicator = ({ strength }: { strength: number }) => {
    const levels = [
        { color: 'bg-red-500' },
        { color: 'bg-red-500' },
        { color: 'bg-yellow-500' },
        { color: 'bg-green-500' },
        { color: 'bg-green-500' },
    ];
    return (
        <div className="flex gap-2 mt-1">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-1 flex-1 rounded-full bg-muted">
                    {strength > index && (
                        <div className={`h-1 rounded-full ${levels[index].color}`} />
                    )}
                </div>
            ))}
        </div>
    );
};


export default function AuthPage() {
  const { login, register, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  
  // Login State
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regOptionalEmail, setRegOptionalEmail] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const checkPasswordStrength = useCallback((password: string) => {
    let strength = 0;
    if (password.length > 7) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    setPasswordStrength(strength > 5 ? 5 : strength);
  }, []);

  const handleRegisterPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setRegPassword(newPassword);
    checkPasswordStrength(newPassword);
  };

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
    if (!agreeToTerms) {
        toast({ variant: 'destructive', title: 'Terms and Conditions', description: 'You must agree to the terms to sign up.' });
        return;
    }
    setIsSubmitting(true);
    if (!regPhone.trim() || !regPassword.trim() || !regDisplayName.trim()) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Phone, password, and display name are required.' });
      setIsSubmitting(false);
      return;
    }
    if (regPassword.length < 8) {
       toast({ variant: 'destructive', title: 'Password Too Short', description: 'Password must be at least 8 characters.' });
       setIsSubmitting(false);
       return;
    }
    
    const registerData: BackendUserCreate = {
      phone: regPhone,
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
  }, [register, regPhone, regPassword, regDisplayName, regOptionalEmail, agreeToTerms, toast]);

  const loading = isAuthLoading || isSubmitting;

  const BrandSection = () => (
    <div className="max-w-md">
      <Logo />
      <h1 className="text-2xl font-bold mt-8 text-foreground">"One soulmate, infinite moods"</h1>
      <p className="text-muted-foreground mt-2">speak your heart in a single tap.</p>
    </div>
  );

  const RegisterForm = () => (
     <form onSubmit={handleRegisterSubmit} className="space-y-4 w-full">
        <div className="space-y-1">
            <Label htmlFor="regPhone">Phone Number</Label>
            <div className="relative">
                <Input id="regPhone" type="tel" placeholder="e.g., +1 234 567 8900" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} required className="pl-4 pr-10" disabled={loading} autoComplete="tel" />
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
        </div>
         <div className="space-y-1">
            <Label htmlFor="displayName">Display Name</Label>
             <div className="relative">
                <Input id="displayName" type="text" placeholder="Choose a unique name" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} required className="pl-4 pr-10" disabled={loading} autoComplete="name" />
                <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
        </div>
        <div className="space-y-1">
            <Label htmlFor="regPassword">Password</Label>
            <div className="relative">
                <Input id="regPassword" type="password" placeholder="Create a strong password" value={regPassword} onChange={handleRegisterPasswordChange} required className="pl-4 pr-10" disabled={loading} minLength={8} autoComplete="new-password" />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
             <PasswordStrengthIndicator strength={passwordStrength} />
             <p className="text-xs text-muted-foreground">Enter a password</p>
        </div>
         <div className="space-y-1">
            <Label htmlFor="regOptionalEmail">Email (Optional)</Label>
            <div className="relative">
                <Input id="regOptionalEmail" type="email" placeholder="your@example.com" value={regOptionalEmail} onChange={(e) => setRegOptionalEmail(e.target.value)} className="pl-4 pr-10" disabled={loading} autoComplete="email" />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
        </div>
        <div className="flex items-center space-x-2">
            <Checkbox id="terms" checked={agreeToTerms} onCheckedChange={(checked) => setAgreeToTerms(Boolean(checked))} />
            <label htmlFor="terms" className="text-sm text-muted-foreground font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                I agree to the <a href="#" className="underline text-primary hover:text-primary/80">Terms of Service</a> and <a href="#" className="underline text-primary hover:text-primary/80">Privacy Policy</a>.
            </label>
        </div>
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base rounded-lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Sign Up'}
        </Button>
    </form>
  );

  const LoginForm = () => (
    <form onSubmit={handleLoginSubmit} className="space-y-6 w-full">
      <div className="space-y-1">
          <Label htmlFor="loginPhone">Phone Number</Label>
          <div className="relative">
              <Input id="loginPhone" type="tel" placeholder="e.g., +1 234 567 8900" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required className="pl-4 pr-10" disabled={loading} autoComplete="tel" />
               <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
      </div>
      <div className="space-y-1">
          <Label htmlFor="loginPassword">Password</Label>
          <div className="relative">
              <Input id="loginPassword" type="password" placeholder="Enter your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="pl-4 pr-10" disabled={loading} autoComplete="current-password" />
               <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
      </div>
       <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base rounded-lg" disabled={loading}>
           {loading ? <Loader2 className="animate-spin" /> : 'Log In'}
      </Button>
    </form>
  );

  return (
    <main className="flex min-h-screen bg-background">
      <div className="hidden md:flex md:w-1/2 bg-slate-50 dark:bg-zinc-900 items-center justify-center p-12 text-center">
        <BrandSection />
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="md:hidden text-center mb-8">
            <BrandSection />
          </div>

          {authMode === 'register' ? (
            <>
              <RegisterForm />
              <p className="text-center text-sm mt-6">
                Already have an account?{' '}
                <button type="button" onClick={() => setAuthMode('login')} className="font-semibold text-primary hover:underline focus:outline-none">
                  Log In
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-center mb-6 text-foreground">Log In</h2>
              <LoginForm />
              <p className="text-center text-sm mt-6">
                Don't have an account?{' '}
                <button type="button" onClick={() => setAuthMode('register')} className="font-semibold text-primary hover:underline focus:outline-none">
                  Sign Up
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
