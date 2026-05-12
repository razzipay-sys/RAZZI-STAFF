import React, { useState, useEffect } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, User, Building2, Clock, Shield, Bell, Upload, Loader2, UserCog } from 'lucide-react';
import useRoleAccess from '@/lib/useRoleAccess';
import supabase from '@/lib/supabase';
import useAuditLog from '@/lib/useAuditLog';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';

const DEFAULT_SETTINGS = {
  company_name: 'RazziPay',
  app_name: 'RazziStaff',
  work_start_time: '09:00',
  work_close_time: '18:00',
  late_threshold_minutes: 15,
  default_salary_payment_day: 25,
  allowed_document_types: 'CV, ID Card, Offer Letter, Appointment Letter, Confirmation Letter, NDA, Contract, Certificate, Other',
  birthday_reminder_days: 7,
  confirmation_reminder_days: 30,
  salary_reminder_days: 5,
};

const SETTINGS_KEY = 'razzistaff_settings';

function Section({ title, icon: Icon, children }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function FieldRow({ label, description, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
      <div className="sm:col-span-1">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { role, isAdmin, hasPermission } = useRoleAccess();
  const { logAction } = useAuditLog();
  
  // Fetch staff profile for avatar and full name
  const { data: staffProfile, isLoading: loadingProfile, isError: profileError, error: profileErrorData, refetch: refetchProfile } = useQuery({
    queryKey: ['my-profile', authUser?.email],
    queryFn: async () => {
      if (!authUser?.email) return null;
      try {
        const profiles = await entities.StaffProfile.filter({ email: authUser.email });
        return profiles[0] || null;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[Settings] Failed to fetch staff profile:', err.message);
        }
        return null;
      }
    },
    enabled: !!authUser?.email,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Fetch app settings from Supabase (only if user is admin)
  const { data: dbSettings = [], isLoading: loadingSettings, isError: settingsError, error: settingsErrorData, refetch: refetchSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      try {
        return await entities.AppSetting.list();
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[Settings] Failed to fetch app settings:', err.message);
        }
        return [];
      }
    },
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const profileLoadingState = useTimedLoading(loadingProfile);
  const settingsLoadingState = useTimedLoading(isAdmin && loadingSettings);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [uploading, setUploading] = useState(false);

  // ── Profile form state (editable by the user themselves) ──────────────────
  const PROFILE_DEFAULTS = {
    full_name: '',
    phone: '',
    address: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    next_of_kin_relationship: '',
    staff_bio: '',
  };
  const [profileForm, setProfileForm] = useState(PROFILE_DEFAULTS);
  const updateField = (key, value) => setProfileForm(prev => ({ ...prev, [key]: value }));

  // Hydrate form when profile loads
  useEffect(() => {
    if (staffProfile) {
      setProfileForm({
        full_name: staffProfile.full_name || '',
        phone: staffProfile.phone || '',
        address: staffProfile.address || '',
        date_of_birth: staffProfile.date_of_birth || '',
        emergency_contact_name: staffProfile.emergency_contact_name || '',
        emergency_contact_phone: staffProfile.emergency_contact_phone || '',
        next_of_kin_name: staffProfile.next_of_kin_name || '',
        next_of_kin_phone: staffProfile.next_of_kin_phone || '',
        next_of_kin_relationship: staffProfile.next_of_kin_relationship || '',
        staff_bio: staffProfile.staff_bio || '',
      });
    }
  }, [staffProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!staffProfile?.id) throw new Error('Profile not found. Please contact your administrator.');
      const trimmed = Object.fromEntries(
        Object.entries(profileForm).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
      );
      if (!trimmed.full_name) throw new Error('Full name is required.');
      await entities.StaffProfile.update(staffProfile.id, trimmed);
      await logAction({
        actionType: 'PROFILE_UPDATE',
        entityType: 'StaffProfile',
        entityId: staffProfile.id,
        entityName: trimmed.full_name,
        notes: 'Staff updated their own profile',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', authUser?.email] });
      toast.success('Profile updated successfully');
    },
    onError: (err) => {
      console.error('[Settings] Profile update error:', err);
      toast.error(err.message || 'Failed to update profile');
    },
  });

  useEffect(() => {
    if (dbSettings.length > 0) {
      const merged = { ...DEFAULT_SETTINGS };
      dbSettings.forEach(s => {
        if (s.setting_key === 'work_schedule' && s.setting_value) {
          Object.assign(merged, s.setting_value);
        }
        if (s.setting_key === 'reminders' && s.setting_value) {
          Object.assign(merged, s.setting_value);
        }
        if (s.setting_key === 'company_identity' && s.setting_value) {
          Object.assign(merged, s.setting_value);
        }
      });
      setSettings(merged);
    }
  }, [dbSettings]);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!isAdmin) return;
      
      const identity = { 
        company_name: settings.company_name, 
        app_name: settings.app_name 
      };
      const schedule = { 
        work_start_time: settings.work_start_time, 
        work_close_time: settings.work_close_time, 
        late_threshold_minutes: settings.late_threshold_minutes 
      };
      const reminders = {
        birthday_reminder_days: settings.birthday_reminder_days,
        confirmation_reminder_days: settings.confirmation_reminder_days,
        salary_reminder_days: settings.salary_reminder_days
      };

      const promises = [
        supabase.from('app_settings').upsert({
          setting_key: 'company_identity',
          setting_value: identity,
          updated_by: authUser?.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' }),
        supabase.from('app_settings').upsert({
          setting_key: 'work_schedule',
          setting_value: schedule,
          updated_by: authUser?.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' }),
        supabase.from('app_settings').upsert({
          setting_key: 'reminders',
          setting_value: reminders,
          updated_by: authUser?.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' })
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach((result) => {
        if (result.error) {
          throw new Error(`Failed to save setting: ${result.error.message}`);
        }
      });

      await logAction({ 
        actionType: 'SETTINGS_UPDATE', 
        entityType: 'AppSettings', 
        notes: 'Global app settings updated' 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('Global settings saved to database');
    },
    onError: (err) => {
      console.error('[Settings] Save error:', err);
      toast.error(err.message || 'Failed to save settings');
    }
  });

  const uploadAvatar = async (file) => {
    if (!staffProfile) {
      toast.error('Staff profile not found');
      return;
    }
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${staffProfile.id}/avatar-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('staff-avatars')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('staff-avatars').getPublicUrl(fileName);
      
      await entities.StaffProfile.update(staffProfile.id, { profile_photo_url: publicUrl });
      await logAction({ 
        actionType: 'AVATAR_UPDATE', 
        entityType: 'StaffProfile', 
        entityId: staffProfile.id, 
        notes: 'Avatar updated' 
      });
      
      queryClient.invalidateQueries({ queryKey: ['my-profile', authUser?.email] });
      toast.success('Profile photo updated');
    } catch (e) {
      console.error('[Settings] Avatar upload error:', e);
      toast.error('Upload failed: ' + (e.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  if (profileLoadingState.showLoader && !authUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const displayName = staffProfile?.full_name || authUser?.email?.split('@')[0] || 'User';
  const avatarUrl = staffProfile?.profile_photo_url;
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const StatusBadge = ({ status }) => (
    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium uppercase tracking-wider">
      {status}
    </span>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {(profileError || profileLoadingState.timedOut) && (
        <DataState
          title={profileLoadingState.timedOut ? 'Still loading profile' : 'Profile unavailable'}
          description={profileErrorData?.message || 'Your account section is using safe fallback details.'}
          onRetry={refetchProfile}
        />
      )}
      {isAdmin && (settingsError || settingsLoadingState.timedOut) && (
        <DataState
          title="Database settings unavailable. Using defaults."
          description={settingsErrorData?.message || 'You can keep using the page while settings retry.'}
          onRetry={refetchSettings}
        />
      )}

      {/* My Account */}
      <Section title="My Account" icon={User}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <Avatar className="h-20 w-20 ring-4 ring-primary/10">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Upload className="w-5 h-5" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                disabled={uploading}
              />
            </label>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xl font-bold">{displayName}</p>
            <p className="text-sm text-muted-foreground">{authUser?.email}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
              <StatusBadge status={role.replace('_', ' ')} />
              {staffProfile?.department && <StatusBadge status={staffProfile.department} />}
            </div>
            <div className="mt-3">
              <Button asChild variant="outline" size="sm" disabled={uploading || !staffProfile}>
                <label className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                    disabled={uploading || !staffProfile}
                  />
                </label>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Update My Profile */}
      <Section title="Update My Profile" icon={UserCog}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-full-name">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="profile-full-name"
                value={profileForm.full_name}
                onChange={e => updateField('full_name', e.target.value)}
                placeholder="Your full name"
                disabled={updateProfileMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Phone Number</Label>
              <Input
                id="profile-phone"
                value={profileForm.phone}
                onChange={e => updateField('phone', e.target.value)}
                placeholder="+234 000 0000 000"
                disabled={updateProfileMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-dob">Date of Birth</Label>
              <Input
                id="profile-dob"
                type="date"
                value={profileForm.date_of_birth}
                onChange={e => updateField('date_of_birth', e.target.value)}
                disabled={updateProfileMutation.isPending}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="profile-address">Residential Address</Label>
              <Input
                id="profile-address"
                value={profileForm.address}
                onChange={e => updateField('address', e.target.value)}
                placeholder="Your current address"
                disabled={updateProfileMutation.isPending}
              />
            </div>
          </div>

          <Separator />

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emergency Contact</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-emerg-name">Contact Name</Label>
              <Input
                id="profile-emerg-name"
                value={profileForm.emergency_contact_name}
                onChange={e => updateField('emergency_contact_name', e.target.value)}
                placeholder="Emergency contact full name"
                disabled={updateProfileMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-emerg-phone">Contact Phone</Label>
              <Input
                id="profile-emerg-phone"
                value={profileForm.emergency_contact_phone}
                onChange={e => updateField('emergency_contact_phone', e.target.value)}
                placeholder="+234 000 0000 000"
                disabled={updateProfileMutation.isPending}
              />
            </div>
          </div>

          <Separator />

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next of Kin</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-kin-name">Full Name</Label>
              <Input
                id="profile-kin-name"
                value={profileForm.next_of_kin_name}
                onChange={e => updateField('next_of_kin_name', e.target.value)}
                placeholder="Next of kin name"
                disabled={updateProfileMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-kin-phone">Phone</Label>
              <Input
                id="profile-kin-phone"
                value={profileForm.next_of_kin_phone}
                onChange={e => updateField('next_of_kin_phone', e.target.value)}
                placeholder="+234 000 0000 000"
                disabled={updateProfileMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-kin-rel">Relationship</Label>
              <Input
                id="profile-kin-rel"
                value={profileForm.next_of_kin_relationship}
                onChange={e => updateField('next_of_kin_relationship', e.target.value)}
                placeholder="e.g. Spouse, Parent"
                disabled={updateProfileMutation.isPending}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="profile-bio">Bio / About Me</Label>
            <Textarea
              id="profile-bio"
              value={profileForm.staff_bio}
              onChange={e => updateField('staff_bio', e.target.value)}
              placeholder="A short bio about yourself, your skills, experience..."
              rows={3}
              className="resize-none"
              disabled={updateProfileMutation.isPending}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending || !staffProfile}
              className="gradient-primary text-primary-foreground min-w-[160px]"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Update Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </Section>

      {/* Admin-only Global Settings */}
      {isAdmin && (
        <>
          <Section title="Company & App Identity" icon={Building2}>
            <FieldRow label="Company Name">
              <Input 
                value={settings.company_name} 
                onChange={e => update('company_name', e.target.value)} 
                placeholder="RazziPay"
              />
            </FieldRow>
            <FieldRow label="App Name" description="Displayed in the sidebar and page title">
              <Input 
                value={settings.app_name} 
                onChange={e => update('app_name', e.target.value)}
                placeholder="RazziStaff"
              />
            </FieldRow>
          </Section>

          <Section title="Work Schedule" icon={Clock}>
            <FieldRow label="Work Start Time" description="Used to calculate late clock-ins">
              <Input 
                type="time" 
                value={settings.work_start_time} 
                onChange={e => update('work_start_time', e.target.value)} 
              />
            </FieldRow>
            <FieldRow label="Work Close Time">
              <Input 
                type="time" 
                value={settings.work_close_time} 
                onChange={e => update('work_close_time', e.target.value)} 
              />
            </FieldRow>
            <FieldRow label="Late Threshold" description="Minutes after start time before marked Late">
              <Input 
                type="number" 
                min="0" 
                max="120" 
                value={settings.late_threshold_minutes}
                onChange={e => update('late_threshold_minutes', parseInt(e.target.value) || 0)} 
              />
            </FieldRow>
          </Section>

          <Section title="Salary & Payroll" icon={Shield}>
            <FieldRow label="Default Payment Day" description="Day of month salaries are paid (1–31)">
              <Input 
                type="number" 
                min="1" 
                max="31" 
                value={settings.default_salary_payment_day}
                onChange={e => update('default_salary_payment_day', parseInt(e.target.value) || 25)} 
              />
            </FieldRow>
            <FieldRow label="Salary Reminder (days)" description="Days before payment day to show reminder on dashboard">
              <Input 
                type="number" 
                min="1" 
                max="14" 
                value={settings.salary_reminder_days}
                onChange={e => update('salary_reminder_days', parseInt(e.target.value) || 5)} 
              />
            </FieldRow>
          </Section>

          <Section title="Reminders & Alerts" icon={Bell}>
            <FieldRow label="Birthday Reminder" description="Days in advance to show birthday reminders">
              <Input 
                type="number" 
                min="1" 
                max="30" 
                value={settings.birthday_reminder_days}
                onChange={e => update('birthday_reminder_days', parseInt(e.target.value) || 7)} 
              />
            </FieldRow>
            <FieldRow label="Confirmation Reminder" description="Days before probation end to show reminder">
              <Input 
                type="number" 
                min="7" 
                max="90" 
                value={settings.confirmation_reminder_days}
                onChange={e => update('confirmation_reminder_days', parseInt(e.target.value) || 30)} 
              />
            </FieldRow>
          </Section>

          <div className="flex justify-end">
            <Button 
              onClick={() => saveSettingsMutation.mutate()} 
              disabled={saveSettingsMutation.isPending}
              className="gradient-primary text-primary-foreground"
            >
              {saveSettingsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Global Settings
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Role Access Information 
          - Admins see full matrix
          - Non-admins only see their own role info
      */}
      <Section title="System Access" icon={Shield}>
        <div className="space-y-2">
          {[
            { role: 'super_admin', label: 'Super Admin', desc: 'Full access — staff, salary, audit logs, settings, all data.' },
            { role: 'admin', label: 'Admin', desc: 'Staff management, documents, workflow review. No salary access.' },
            { role: 'hr_admin', label: 'HR Admin', desc: 'Staff records, CVs, onboarding, HR notes. No salary.' },
            { role: 'finance_admin', label: 'Finance Admin', desc: 'Salary and bank information only. Read-only on staff.' },
            { role: 'manager', label: 'Manager', desc: 'View team workflow reports, submit reviews. No HR data.' },
            { role: 'user', label: 'Staff', desc: 'Submit daily reports and view own profile only.' },
          ]
          .filter(r => isAdmin || r.role === role) // FIX: Show full matrix to admins, only current role to others
          .map(r => (
            <div 
              key={r.role} 
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                role === r.role 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border'
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {r.label}
                  {role === r.role && (
                    <span className="ml-2 text-xs text-primary font-bold">(Your Role)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="pb-10" />
    </div>
  );
}