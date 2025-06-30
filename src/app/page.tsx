
"use client";

import React, { useState, type FormEvent, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Phone, User as UserIcon, Lock, Mail, MessageSquareText } from 'lucide-react';
import type { CompleteRegistrationRequest } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import FullPageLoader from '@/components/common/FullPageLoader';
import SplashScreen from '@/components/common/SplashScreen';
import Spinner from '@/components/common/Spinner';

const BrandSection = () => (
    <div className="max-w-md">
      <Image src="/icon/icon-512.png" alt="Kuchlu App Logo" width={400} height={300} className="rounded-lg object-cover shadow-lg" data-ai-hint="app logo" priority/>
      <h1 className="text-2xl font-bold mt-8 text-foreground">"One soulmate, infinite moods"</h1>
      <p className="text-muted-foreground mt-2">speak your heart in a single tap.</p>
    </div>
);

const PasswordStrengthIndicator = ({ strength }: { strength: number }) => {
    const levels = [{ color: 'bg-red-500' }, { color: 'bg-red-500' }, { color: 'bg-yellow-500' }, { color: 'bg-green-500' }, { color: 'bg-green-500' }];
    return (
        <div className="flex gap-2 mt-1">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-1 flex-1 rounded-full bg-muted">
                    {strength > index && <div className={`h-1 rounded-full ${levels[index].color}`} />}
                </div>
            ))}
        </div>
    );
};

const RegisterPhoneStep = ({ handleSendOtp, regPhone, setRegPhone, loading }: any) => (
    <form onSubmit={handleSendOtp} className="space-y-4 w-full">
        <CardHeader className="p-0 mb-6"><CardTitle>Create your account</CardTitle><CardDescription>Enter your phone number to begin.</CardDescription></CardHeader>
       <div className="space-y-1">
           <Label htmlFor="regPhone">Phone Number</Label>
           <div className="relative"><Input id="regPhone" type="tel" placeholder="+12223334444" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} required className="pl-4 pr-10 bg-input" disabled={loading} autoComplete="tel" /><Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div>
       </div>
       <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base rounded-lg" disabled={loading}>{loading ? <Spinner /> : 'Continue'}</Button>
   </form>
);

const RegisterOtpStep = ({ handleVerifyOtp, regOtp, setRegOtp, loading, regPhone, setRegisterStep }: any) => (
    <form onSubmit={handleVerifyOtp} className="space-y-4 w-full">
        <CardHeader className="p-0 mb-6"><CardTitle>Verify your phone</CardTitle><CardDescription>We sent a 6-digit code to {regPhone}.</CardDescription></CardHeader>
       <div className="space-y-1">
           <Label htmlFor="regOtp">Verification Code</Label>
           <div className="relative"><Input id="regOtp" type="text" placeholder="######" value={regOtp} onChange={(e) => setRegOtp(e.target.value)} required className="pl-4 pr-10 tracking-[1em] text-center bg-input" disabled={loading} maxLength={6} autoComplete="one-time-code" /><MessageSquareText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div>
       </div>
       <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base rounded-lg" disabled={loading}>{loading ? <Spinner /> : 'Verify'}</Button>
       <div className="text-center"><Button type="button" variant="link" onClick={() => setRegisterStep('phone')} disabled={loading}>Use a different number</Button></div>
   </form>
);

const RegisterDetailsStep = ({ handleCompleteRegistration, regDisplayName, setRegDisplayName, regPassword, setRegPassword, checkPasswordStrength, passwordStrength, regOptionalEmail, setRegOptionalEmail, agreeToTerms, setAgreeToTerms, loading }: any) => (
    <form onSubmit={handleCompleteRegistration} className="space-y-4 w-full">
       <CardHeader className="p-0 mb-6"><CardTitle>Just a few more details</CardTitle><CardDescription>Your phone number is verified!</CardDescription></CardHeader>
       <div className="space-y-1">
           <Label htmlFor="displayName">Display Name</Label>
           <div className="relative"><Input id="displayName" type="text" placeholder="Choose a unique name" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} required className="pl-4 pr-10 bg-input" disabled={loading} autoComplete="name" /><UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div>
       </div>
       <div className="space-y-1">
           <Label htmlFor="regPassword">Password</Label>
           <div className="relative"><Input id="regPassword" type="password" placeholder="Create a strong password" value={regPassword} onChange={(e) => {setRegPassword(e.target.value); checkPasswordStrength(e.target.value);}} required className="pl-4 pr-10 bg-input" disabled={loading} minLength={8} autoComplete="new-password" /><Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div>
           <PasswordStrengthIndicator strength={passwordStrength} />
       </div>
       <div className="space-y-1">
           <Label htmlFor="regOptionalEmail">Email (Optional)</Label>
           <div className="relative"><Input id="regOptionalEmail" type="email" placeholder="your@example.com" value={regOptionalEmail} onChange={(e) => setRegOptionalEmail(e.target.value)} className="pl-4 pr-10 bg-input" disabled={loading} autoComplete="email" /><Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div>
       </div>
       <div className="flex items-center space-x-2"><Checkbox id="terms" checked={agreeToTerms} onCheckedChange={(c) => setAgreeToTerms(Boolean(c))} /><label htmlFor="terms" className="text-sm text-muted-foreground font-normal">I agree to the <a href="#" className="underline text-primary hover:text-primary/80">Terms</a> and <a href="#" className="underline text-primary hover:text-primary/80">Privacy Policy</a>.</label></div>
       <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base rounded-lg" disabled={loading || !agreeToTerms}>{loading ? <Spinner /> : 'Create Account'}</Button>
   </form>
);

const LoginForm = ({ handleLoginSubmit, loginPhone, setLoginPhone, loginPassword, setLoginPassword, loading }: any) => (
   <form onSubmit={handleLoginSubmit} className="space-y-6 w-full">
     <div className="space-y-1"><Label htmlFor="loginPhone">Phone Number</Label><div className="relative"><Input id="loginPhone" type="tel" placeholder="+12223334444" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required className="pl-4 pr-10 bg-input" disabled={loading} autoComplete="tel" /><Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div></div>
     <div className="space-y-1"><Label htmlFor="loginPassword">Password</Label><div className="relative"><Input id="loginPassword" type="password" placeholder="Enter your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="pl-4 pr-10 bg-input" disabled={loading} autoComplete="current-password" /><Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /></div></div>
     <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base rounded-lg" disabled={loading}>{loading ? <Spinner /> : 'Log In'}</Button>
   </form>
);

export default function AuthPage() {
  const { login, completeRegistration, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [registerStep, setRegisterStep] = useState<'phone' | 'otp' | 'details'>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regOptionalEmail, setRegOptionalEmail] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [registrationToken, setRegistrationToken] = useState('');
  const [isSplashing, setIsSplashing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashing(false);
    }, 4000); // Corresponds to the longest animation duration
    return () => clearTimeout(timer);
  }, []);

  const loading = isAuthLoading || isSubmitting;
  
  const checkPasswordStrength = useCallback((p: string) => { let s=0; if(p.length>7)s++; if(p.match(/[a-z]/))s++; if(p.match(/[A-Z]/))s++; if(p.match(/[0-9]/))s++; if(p.match(/[^a-zA-Z0-9]/))s++; setPasswordStrength(s > 5 ? 5 : s); }, []);
  const handleLoginSubmit = useCallback(async (e: FormEvent) => { e.preventDefault(); setIsSubmitting(true); try { await login(loginPhone, loginPassword); } catch (error: any) { console.error("Login error:", error.message); } finally { setIsSubmitting(false); }}, [login, loginPhone, loginPassword]);
  const handleSendOtp = async (e: FormEvent) => { e.preventDefault(); setIsSubmitting(true); try { await api.sendOtp(regPhone); toast({ title: "OTP Sent" }); setRegisterStep('otp'); } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message }); } finally { setIsSubmitting(false); }};
  const handleVerifyOtp = async (e: FormEvent) => { e.preventDefault(); setIsSubmitting(true); try { const res = await api.verifyOtp(regPhone, regOtp); setRegistrationToken(res.registration_token); toast({ title: "Phone Verified!" }); setRegisterStep('details'); } catch (error: any) { toast({ variant: 'destructive', title: 'Invalid OTP', description: error.message }); } finally { setIsSubmitting(false); }};
  const handleCompleteRegistration = useCallback(async (e: FormEvent) => { e.preventDefault(); setIsSubmitting(true); const data: CompleteRegistrationRequest = { registration_token: registrationToken, password: regPassword, display_name: regDisplayName, ...(regOptionalEmail.trim() && { email: regOptionalEmail.trim() }) }; try { await completeRegistration(data); } catch (error: any) { console.error("Registration error:", error.message); } finally { setIsSubmitting(false); }}, [completeRegistration, registrationToken, regPassword, regDisplayName, regOptionalEmail]);

  if (isSplashing) {
    return <SplashScreen />;
  }
  
  if (isAuthLoading) {
    return <FullPageLoader />
  }

  return (
    <main className="flex min-h-screen bg-background">
      <div className="hidden md:flex md:w-1/2 bg-slate-50 dark:bg-zinc-900 items-center justify-center p-12 text-center"><BrandSection /></div>
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm mx-auto">
          <div className="md:hidden text-center mb-8"><BrandSection /></div>
          {authMode === 'register' ? (
            <>
              {registerStep === 'phone' && <RegisterPhoneStep {...{handleSendOtp, regPhone, setRegPhone, loading}} />}
              {registerStep === 'otp' && <RegisterOtpStep {...{handleVerifyOtp, regOtp, setRegOtp, loading, regPhone, setRegisterStep}} />}
              {registerStep === 'details' && <RegisterDetailsStep {...{handleCompleteRegistration, regDisplayName, setRegDisplayName, regPassword, setRegPassword, checkPasswordStrength, passwordStrength, regOptionalEmail, setRegOptionalEmail, agreeToTerms, setAgreeToTerms, loading}} />}
              <p className="text-center text-sm mt-6">Already have an account? <button onClick={() => setAuthMode('login')} className="font-semibold text-primary hover:underline">Log In</button></p>
            </>
          ) : (
            <>
              <CardHeader className="p-0 mb-6"><CardTitle>Welcome Back</CardTitle></CardHeader>
              <LoginForm {...{handleLoginSubmit, loginPhone, setLoginPhone, loginPassword, setLoginPassword, loading}} />
              <p className="text-center text-sm mt-6">Don't have an account? <button onClick={() => { setAuthMode('register'); setRegisterStep('phone'); }} className="font-semibold text-primary hover:underline">Sign Up</button></p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
