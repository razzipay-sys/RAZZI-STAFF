import React, { useState, useEffect } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, User, Building2, Clock, Shield, Bell } from 'lucide-react';

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
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const load = async () => {
      try {
setUser(currentUser);
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const saveSettings = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    toast.success('Settings saved');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

      {/* My Account */}
      <Section title="My Account" icon={User}>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{user?.full_name || 'User'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium capitalize">
              {user?.role?.replace(/_/g, ' ') || 'user'}
            </span>
          </div>
        </div>
      </Section>

      {/* Company Settings */}
      <Section title="Company & App Identity" icon={Building2}>
        <FieldRow label="Company Name">
          <Input value={settings.company_name} onChange={e => update('company_name', e.target.value)} />
        </FieldRow>
        <FieldRow label="App Name" description="Displayed in the sidebar and page title">
          <Input value={settings.app_name} onChange={e => update('app_name', e.target.value)} />
        </FieldRow>
      </Section>

      {/* Work Schedule */}
      <Section title="Work Schedule" icon={Clock}>
        <FieldRow label="Work Start Time" description="Used to calculate late clock-ins">
          <Input type="time" value={settings.work_start_time} onChange={e => update('work_start_time', e.target.value)} />
        </FieldRow>
        <FieldRow label="Work Close Time">
          <Input type="time" value={settings.work_close_time} onChange={e => update('work_close_time', e.target.value)} />
        </FieldRow>
        <FieldRow label="Late Threshold" description="Minutes after start time before marked Late">
          <Input type="number" min="0" max="120" value={settings.late_threshold_minutes}
            onChange={e => update('late_threshold_minutes', parseInt(e.target.value) || 0)} />
        </FieldRow>
      </Section>

      {/* Salary Settings */}
      <Section title="Salary & Payroll" icon={Shield}>
        <FieldRow label="Default Payment Day" description="Day of month salaries are paid (1–31)">
          <Input type="number" min="1" max="31" value={settings.default_salary_payment_day}
            onChange={e => update('default_salary_payment_day', parseInt(e.target.value) || 25)} />
        </FieldRow>
        <FieldRow label="Salary Reminder (days)" description="Days before payment day to show reminder on dashboard">
          <Input type="number" min="1" max="14" value={settings.salary_reminder_days}
            onChange={e => update('salary_reminder_days', parseInt(e.target.value) || 5)} />
        </FieldRow>
      </Section>

      {/* Reminder Settings */}
      <Section title="Reminders & Alerts" icon={Bell}>
        <FieldRow label="Birthday Reminder" description="Days in advance to show birthday reminders">
          <Input type="number" min="1" max="30" value={settings.birthday_reminder_days}
            onChange={e => update('birthday_reminder_days', parseInt(e.target.value) || 7)} />
        </FieldRow>
        <FieldRow label="Confirmation Reminder" description="Days before probation end to show reminder">
          <Input type="number" min="7" max="90" value={settings.confirmation_reminder_days}
            onChange={e => update('confirmation_reminder_days', parseInt(e.target.value) || 30)} />
        </FieldRow>
      </Section>

      {/* Role Matrix */}
      <Section title="Role Access Matrix" icon={Shield}>
        <div className="space-y-2">
          {[
            { role: 'super_admin', label: 'Super Admin', desc: 'Full access — staff, salary, audit logs, settings, all data.' },
            { role: 'admin', label: 'Admin', desc: 'Staff management, documents, workflow review. No salary access.' },
            { role: 'hr_admin', label: 'HR Admin', desc: 'Staff records, CVs, onboarding, HR notes. No salary.' },
            { role: 'finance_admin', label: 'Finance Admin', desc: 'Salary and bank information only. Read-only on staff.' },
            { role: 'manager', label: 'Manager', desc: 'View team workflow reports, submit reviews. No HR data.' },
            { role: 'user', label: 'Staff', desc: 'Submit daily reports and view own profile only.' },
          ].map(r => (
            <div key={r.role} className={`flex items-start gap-3 p-3 rounded-lg border ${user?.role === r.role ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex-1">
                <p className="text-sm font-medium">{r.label}
                  {user?.role === r.role && <span className="ml-2 text-xs text-primary">(You)</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex justify-end pb-8">
        <Button onClick={saveSettings} className="gradient-primary text-primary-foreground">
          <Save className="w-4 h-4 mr-2" /> Save Settings
        </Button>
      </div>
    </div>
  );
}