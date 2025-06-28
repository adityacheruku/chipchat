"use client";

import React, { useState, type FormEvent, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone, User as UserIcon, Lock, Mail, MessageSquareText } from 'lucide-react';
import type { CompleteRegistrationRequest } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Component for the logo
const Logo = () => (
    <div className="flex justify-center mb-6">
        <Image
            src="https://placehold.co/256x256.png"
            alt="ChirpChat App Logo"
            width={80}
            height={80}
            className="rounded-2xl object-cover shadow-lg"
            data-ai-hint="app logo"
            priority
        />
    </div>
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


// Moved form components outside of the main component to prevent re-rendering on every keystroke
 const RegisterPhoneStep = ({ handleSendOtp, regPhone, setRegPhone, loading }: any) => (
    <form onSubmit={handleSendOtp} className="space-y-4 w-full">
        <CardHeader className="p-0 mb-6 text-center">
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Enter your phone number to begin.</CardDescription>
        </CardHeader>
       <div className="space-y-1">
           <Label htmlFor="regPhone" className="sr-only">Phone Number</Label>
           <div className="relative">
               <Input id="regPhone" type="tel" placeholder="+12223334444" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} required className="pl-10" disabled={loading} autoComplete="tel" />
               <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           </div>
       </div>
       <Button type="submit" className="w-full" disabled={loading}>
           {loading ? <Loader2 className="animate-spin" /> : 'Continue'}
       </Button>
   </form>
 );

 const RegisterOtpStep = ({ handleVerifyOtp, regOtp, setRegOtp, loading, regPhone, setRegisterStep }: any) => (
    <form onSubmit={handleVerifyOtp} className="space-y-4 w-full">
        <CardHeader className="p-0 mb-6 text-center">
            <CardTitle>Verify your phone</CardTitle>
            <CardDescription>We sent a 6-digit code to {regPhone}.</CardDescription>
        </CardHeader>
       <div className="space-y-1">
           <Label htmlFor="regOtp" className="sr-only">Verification Code</Label>
           <div className="relative">
               <Input id="regOtp" type="text" placeholder="######" value={regOtp} onChange={(e) => setRegOtp(e.target.value)} required className="pl-4 pr-10 tracking-[1em] text-center" disabled={loading} maxLength={6} autoComplete="one-time-code" />
               <MessageSquareText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           </div>
       </div>
       <Button type="submit" className="w-full" disabled={loading}>
           {loading ? <Loader2 className="animate-spin" /> : 'Verify'}
       </Button>
       <div className="text-center">
            <Button type="button" variant="link" onClick={() => setRegisterStep('phone')} disabled={loading}>Use a different number</Button>
       </div>
   </form>
 );

 const RegisterDetailsStep = ({ handleCompleteRegistration, regDisplayName, setRegDisplayName, regPassword, setRegPassword, checkPasswordStrength, passwordStrength, regOptionalEmail, setRegOptionalEmail, agreeToTerms, setAgreeToTerms, loading }: any) => (
    <form onSubmit={handleCompleteRegistration} className="space-y-4 w-full">
       <CardHeader className="p-0 mb-6 text-center">
            <CardTitle>Just a few more details</CardTitle>
            <CardDescription>Your phone number is verified!</CardDescription>
        </CardHeader>
        <div className="space-y-1">
           <Label htmlFor="displayName" className="sr-only">Display Name</Label>
            <div className="relative">
               <Input id="displayName" type="text" placeholder="Choose a unique name" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} required className="pl-10" disabled={loading} autoComplete="name" />
               <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           </div>
       </div>
       <div className="space-y-1">
           <Label htmlFor="regPassword" className="sr-only">Password</Label>
           <div className="relative">
               <Input id="regPassword" type="password" placeholder="Create a strong password" value={regPassword} onChange={(e) => {setRegPassword(e.target.value); checkPasswordStrength(e.target.value);}} required className="pl-10" disabled={loading} minLength={8} autoComplete="new-password" />
               <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           </div>
            <PasswordStrengthIndicator strength={passwordStrength} />
       </div>
        <div className="space-y-1">
           <Label htmlFor="regOptionalEmail" className="sr-only">Email (Optional)</Label>
           <div className="relative">
               <Input id="regOptionalEmail" type="email" placeholder="your@example.com (optional)" value={regOptionalEmail} onChange={(e) => setRegOptionalEmail(e.target.value)} className="pl-10" disabled={loading} autoComplete="email" />
               <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           </div>
       </div>
       <div className="flex items-center space-x-2">
           <Checkbox id="terms" checked={agreeToTerms} onCheckedChange={(checked) => setAgreeToTerms(Boolean(checked))} />
           <label htmlFor="terms" className="text-sm text-muted-foreground font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
               I agree to the <a href="#" className="underline text-primary hover:text-primary/80">Terms of Service</a> and <a href="#" className="underline text-primary hover:text-primary/80">Privacy Policy</a>.
           </label>
       </div>
       <Button type="submit" className="w-full" disabled={loading || !agreeToTerms}>
           {loading ? <Loader2 className="animate-spin" /> : 'Create Account'}
       </Button>
   </form>
 );

 const LoginForm = ({ handleLoginSubmit, loginPhone, setLoginPhone, loginPassword, setLoginPassword, loading }: any) => (
   <form onSubmit={handleLoginSubmit} className="space-y-6 w-full">
     <div className="space-y-1">
         <Label htmlFor="loginPhone" className="sr-only">Phone Number</Label>
         <div className="relative">
             <Input id="loginPhone" type="tel" placeholder="+12223334444" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required className="pl-10" disabled={loading} autoComplete="tel" />
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
         </div>
     </div>
     <div className="space-y-1">
         <Label htmlFor="loginPassword" className="sr-only">Password</Label>
         <div className="relative">
             <Input id="loginPassword" type="password" placeholder="Enter your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="pl-10" disabled={loading} autoComplete="current-password" />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
         </div>
     </div>
      <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : 'Log In'}
     </Button>
   </form>
 );


export default function AuthPage() {
  const { login, completeRegistration, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [registerStep, setRegisterStep] = useState<'phone' | 'otp' | 'details'>('phone');
  
  // Shared state
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Login State
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regPhone, setRegPhone] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regOptionalEmail, setRegOptionalEmail] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [registrationToken, setRegistrationToken] = useState('');

  const loading = isAuthLoading || isSubmitting;

  const checkPasswordStrength = useCallback((password: string) => {
    let strength = 0;
    if (password.length > 7) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    setPasswordStrength(strength > 5 ? 5 : strength);
  }, []);

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

  // Step 1: Handle sending OTP
  const handleSendOtp = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          await api.sendOtp(regPhone);
          toast({ title: "OTP Sent", description: "Check your messages for the verification code." });
          setRegisterStep('otp');
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: error.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  // Step 2: Handle verifying OTP
  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
          const response = await api.verifyOtp(regPhone, regOtp);
          setRegistrationToken(response.registration_token);
          toast({ title: "Phone Verified!", description: "Please complete your profile." });
          setRegisterStep('details');
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Invalid OTP', description: error.message });
      } finally {
          setIsSubmitting(false);
      }
  };

  // Step 3: Handle final registration
  const handleCompleteRegistration = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agreeToTerms) {
        toast({ variant: 'destructive', title: 'Terms and Conditions', description: 'You must agree to the terms to sign up.' });
        return;
    }
    setIsSubmitting(true);
    if (!registrationToken || !regPassword.trim() || !regDisplayName.trim()) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Password and display name are required.' });
      setIsSubmitting(false);
      return;
    }
    if (regPassword.length < 8) {
       toast({ variant: 'destructive', title: 'Password Too Short', description: 'Password must be at least 8 characters.' });
       setIsSubmitting(false);
       return;
    }
    
    const registrationData: CompleteRegistrationRequest = {
      registration_token: registrationToken,
      password: regPassword,
      display_name: regDisplayName,
      ...(regOptionalEmail.trim() && { email: regOptionalEmail.trim() })
    };

    try {
      await completeRegistration(registrationData);
    } catch (error: any) {
      console.error("AuthPage - Registration error:", error.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [completeRegistration, registrationToken, regPassword, regDisplayName, regOptionalEmail, agreeToTerms, toast]);


  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <Logo />
          {authMode === 'register' ? (
            <>
              {registerStep === 'phone' && <RegisterPhoneStep handleSendOtp={handleSendOtp} regPhone={regPhone} setRegPhone={setRegPhone} loading={loading} />}
              {registerStep === 'otp' && <RegisterOtpStep handleVerifyOtp={handleVerifyOtp} regOtp={regOtp} setRegOtp={setRegOtp} loading={loading} regPhone={regPhone} setRegisterStep={setRegisterStep} />}
              {registerStep === 'details' && <RegisterDetailsStep handleCompleteRegistration={handleCompleteRegistration} regDisplayName={regDisplayName} setRegDisplayName={setRegDisplayName} regPassword={regPassword} setRegPassword={setRegPassword} checkPasswordStrength={checkPasswordStrength} passwordStrength={passwordStrength} regOptionalEmail={regOptionalEmail} setRegOptionalEmail={setRegOptionalEmail} agreeToTerms={agreeToTerms} setAgreeToTerms={setAgreeToTerms} loading={loading} />}
              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{' '}
                <button type="button" onClick={() => setAuthMode('login')} className="font-semibold text-primary hover:underline focus:outline-none">
                  Log In
                </button>
              </p>
            </>
          ) : (
            <>
              <CardHeader className="p-0 mb-6 text-center">
                  <CardTitle>Welcome Back</CardTitle>
              </CardHeader>
              <LoginForm handleLoginSubmit={handleLoginSubmit} loginPhone={loginPhone} setLoginPhone={setLoginPhone} loginPassword={loginPassword} setLoginPassword={setLoginPassword} loading={loading} />
              <p className="text-center text-sm text-muted-foreground mt-6">
                Don't have an account?{' '}
                <button type="button" onClick={() => { setAuthMode('register'); setRegisterStep('phone'); }} className="font-semibold text-primary hover:underline focus:outline-none">
                  Sign Up
                </button>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
