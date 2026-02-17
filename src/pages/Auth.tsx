import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Music, Mic, Users, Gavel, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import TermsAndConditions from '@/components/TermsAndConditions';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Auth = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const { signIn, signUp, resetPassword, user, roles, activeRole, setActiveRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({ email: '', password: '', confirmPassword: '', fullName: '', role: '' });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(signInData.email, signInData.password);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.welcomeBack'));
    }
    setIsLoading(false);
  };

  const passwordRequirements = {
    minLength: signUpData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(signUpData.password),
    hasLowercase: /[a-z]/.test(signUpData.password),
    hasNumber: /\d/.test(signUpData.password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(signUpData.password),
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) { toast.error(t('auth.meetPasswordReqs')); return; }
    if (signUpData.password !== signUpData.confirmPassword) { toast.error(t('auth.passwordsDontMatch')); return; }
    if (!signUpData.role) { toast.error(t('auth.pleaseSelectRole')); return; }
    if (!termsAccepted) { toast.error(t('auth.pleaseAcceptTerms')); return; }

    setIsLoading(true);
    const { error } = await signUp(signUpData.email, signUpData.password, { full_name: signUpData.fullName, role: signUpData.role });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.accountCreated'));
      setActiveTab('signin');
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) { toast.error(t('auth.enterEmailAddress')); return; }
    setIsResetting(true);
    const { error } = await resetPassword(resetEmail);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.resetEmailSent'));
      setResetDialogOpen(false);
      setResetEmail('');
    }
    setIsResetting(false);
  };

  useEffect(() => {
    if (!user || authLoading) return;
    if (roles && roles.length > 1) {
      if (!roleDialogOpen) { setSelectedRole(activeRole ?? roles[0]); setRoleDialogOpen(true); }
      return;
    }
    if (roles && roles.length === 1) {
      if (activeRole !== roles[0]) setActiveRole(roles[0]);
      navigate('/');
    }
  }, [user, roles, activeRole, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-muted-foreground">{t('auth.loading')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-2xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
              <Music className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth.welcomeTitle')}</CardTitle>
          <CardDescription>{t('auth.joinPlatform')}</CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t('auth.email')}</Label>
                  <Input id="signin-email" type="email" placeholder={t('auth.enterEmail')} value={signInData.email} onChange={(e) => setSignInData({ ...signInData, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t('auth.password')}</Label>
                  <Input id="signin-password" type="password" placeholder={t('auth.enterPassword')} value={signInData.password} onChange={(e) => setSignInData({ ...signInData, password: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('auth.signingIn') : t('auth.signIn')}
                </Button>
                <div className="text-center">
                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="text-sm text-muted-foreground hover:text-primary">{t('auth.forgotPassword')}</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t('auth.resetPassword')}</DialogTitle>
                        <DialogDescription>{t('auth.resetDescription')}</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">{t('auth.email')}</Label>
                          <Input id="reset-email" type="email" placeholder={t('auth.enterEmail')} value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={isResetting}>
                          {isResetting ? t('auth.sending') : t('auth.sendResetLink')}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">{t('auth.fullName')}</Label>
                  <Input id="fullname" type="text" placeholder={t('auth.enterFullName')} value={signUpData.fullName} onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input id="email" type="email" placeholder={t('auth.enterEmail')} value={signUpData.email} onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t('auth.joinAs')}</Label>
                  <Select value={signUpData.role || ""} onValueChange={(value) => setSignUpData({ ...signUpData, role: value })}>
                    <SelectTrigger><SelectValue placeholder={t('auth.selectRole')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singer"><div className="flex items-center gap-2"><Mic className="w-4 h-4" />{t('auth.singer')}</div></SelectItem>
                      <SelectItem value="judge"><div className="flex items-center gap-2"><Gavel className="w-4 h-4" />{t('auth.judger')}</div></SelectItem>
                      <SelectItem value="audience"><div className="flex items-center gap-2"><Users className="w-4 h-4" />{t('auth.audience')}</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input id="password" type="password" placeholder={t('auth.createPassword')} value={signUpData.password} onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })} required />
                  {signUpData.password && (
                    <div className="space-y-2 text-sm">
                      <div className="text-muted-foreground font-medium">{t('auth.passwordRequirements')}</div>
                      <div className="space-y-1">
                        <div className={`flex items-center gap-2 ${passwordRequirements.minLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {passwordRequirements.minLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {t('auth.minLength')}
                        </div>
                        <div className={`flex items-center gap-2 ${passwordRequirements.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {passwordRequirements.hasUppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {t('auth.hasUppercase')}
                        </div>
                        <div className={`flex items-center gap-2 ${passwordRequirements.hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {passwordRequirements.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {t('auth.hasNumber')}
                        </div>
                        <div className={`flex items-center gap-2 ${passwordRequirements.hasSpecialChar ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {passwordRequirements.hasSpecialChar ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {t('auth.hasSpecialChar')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
                  <Input id="confirm-password" type="password" placeholder={t('auth.confirmYourPassword')} value={signUpData.confirmPassword} onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })} required />
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
                    <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked as boolean)} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                        {t('auth.termsAgree')}{' '}
                        <button type="button" onClick={(e) => { e.preventDefault(); setTermsDialogOpen(true); }} className="text-primary hover:underline font-medium">
                          {t('auth.termsAndConditions')}
                        </button>
                      </Label>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || !termsAccepted}>
                  {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('auth.chooseRole')}</DialogTitle>
              <DialogDescription>{t('auth.chooseRoleDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
                {roles?.map((r) => (
                  <div key={r} className="flex items-center gap-3 p-3 rounded-md border">
                    <RadioGroupItem value={r} id={`role-${r}`} />
                    <Label htmlFor={`role-${r}`} className="flex items-center gap-2 cursor-pointer">
                      {r === 'singer' && <Mic className="w-4 h-4" />}
                      {r === 'judge' && <Gavel className="w-4 h-4" />}
                      {r === 'audience' && <Users className="w-4 h-4" />}
                      <span className="capitalize">{r}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Button className="w-full" onClick={() => {
                if (selectedRole) {
                  setActiveRole(selectedRole);
                  toast.success(t('auth.signedInAs', { role: selectedRole }));
                  setRoleDialogOpen(false);
                  navigate('/');
                }
              }} disabled={!selectedRole}>
                {t('auth.continue')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
      
      <TermsAndConditions open={termsDialogOpen} onOpenChange={setTermsDialogOpen} />
    </div>
  );
};

export default Auth;