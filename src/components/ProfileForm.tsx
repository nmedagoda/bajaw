import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { User, Save, Loader2 } from 'lucide-react';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  age: z.coerce.number().min(13, 'Age must be at least 13').max(120, 'Age must be less than 120').optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  contact_number: z.string().optional().nullable(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  className?: string;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ className }) => {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: '', email: '', age: null, gender: null, address: null, contact_number: null },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        full_name: profile.full_name || '',
        email: profile.email || '',
        age: profile.age || null,
        gender: profile.gender || null,
        address: profile.address || null,
        contact_number: profile.contact_number || null,
      });
    }
  }, [profile, form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      toast({ title: t('profile.updateFailed'), description: t('profile.mustBeLoggedIn'), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const updateData = { full_name: data.full_name, email: data.email, age: data.age, gender: data.gender, address: data.address, contact_number: data.contact_number };
      const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
      if (error) throw error;
      await updateProfile(updateData);
      toast({ title: t('profile.profileUpdated'), description: t('profile.profileUpdatedDesc') });
    } catch (error) {
      console.error('Profile update error:', error);
      toast({ title: t('profile.updateFailed'), description: error instanceof Error ? error.message : "Failed to update profile", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="w-5 h-5" />
          <CardTitle>{t('profile.profileInfo')}</CardTitle>
        </div>
        <CardDescription>{t('profile.updateDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem><FormLabel>{t('profile.fullName')}</FormLabel><FormControl><Input placeholder={t('profile.enterFullName')} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>{t('profile.emailAddress')}</FormLabel><FormControl><Input type="email" placeholder={t('profile.enterEmail')} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="age" render={({ field }) => (
                <FormItem><FormLabel>{t('profile.age')}</FormLabel><FormControl><Input type="number" placeholder={t('profile.enterAge')} {...field} value={field.value || ''} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.gender')}</FormLabel>
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('profile.selectGender')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Male">{t('profile.male')}</SelectItem>
                      <SelectItem value="Female">{t('profile.female')}</SelectItem>
                      <SelectItem value="Other">{t('profile.other')}</SelectItem>
                      <SelectItem value="Prefer not to say">{t('profile.preferNotToSay')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_number" render={({ field }) => (
                <FormItem><FormLabel>{t('profile.contactNumber')}</FormLabel><FormControl><Input type="tel" placeholder={t('profile.enterContactNumber')} {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>{t('profile.address')}</FormLabel><FormControl><Textarea placeholder={t('profile.enterAddress')} className="min-h-[80px]" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('profile.updating')}</>) : (<><Save className="w-4 h-4 mr-2" />{t('profile.updateProfile')}</>)}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ProfileForm;