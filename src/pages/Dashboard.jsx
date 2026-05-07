import React from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, FileText, ClipboardList, AlertTriangle,
  CheckCircle2, Clock, XCircle, ArrowRight, Cake,
  UserCheck, DollarSign, CalendarDays,
  Building2, ShieldAlert, UserPlus, Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import useRoleAccess from '@/lib/useRoleAccess';

function DashListRow({ name, sub, right }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="text-right text-sm text-muted-foreground shrink-0 ml-2">{right}</div>
    </div>
  );
}

function DashCard({ title, icon: Icon, to, children }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
        {to && (
          <Link to={to}>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyNote({ text }) {
  return <p className="text-sm text-muted-foreground text-center py-5">{text}</p>;
}

export default function Dashboard() {
  const { role, hasPermission, isAdmin, isSuperAdmin } = useRoleAccess();
  
  // Fetch app settings for work schedule
  const { data: dbSettings = [] } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => entities.AppSetting.list(),
  });

  const schedule = dbSettings.find(s => s.setting_key === 'work_schedule')?.setting_value || { start_time: '09:00', late_threshold_minutes: 15 };

  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['staff-documents'],
    queryFn: () => entities.StaffDocument.list('-created_at', 500),
  });

  const { data: bankRecords = [], isLoading: loadingBank } = useQuery({
    queryKey: ['bank-details'],
    queryFn: () => entities.StaffBankDetails.list('-created_at', 500),
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['today-reports', today],
    queryFn: () => entities.DailyWorkflowReport.filter({ report_date: today }, '-created_at', 500),
  });

  if (loadingStaff || loadingDocs || loadingBank || loadingReports) return <PageLoader />;

  const now = new Date();
  const activeStaff = staffList.filter(s => s.employment_status === 'Active');
  const onProbation = staffList.filter(s => s.employment_type === 'Probation' || s.confirmation_status === 'Pending');
  const confirmed = staffList.filter(s => s.confirmation_status === 'Confirmed');

  // CV tracking
  const staffWithApprovedCV = new Set(
    documents.filter(d => d.document_type === 'CV' && ['Submitted', 'Reviewed', 'Approved'].includes(d.status)).map(d => d.staff_id)
  );
  const missingCVStaff = activeStaff.filter(s => !staffWithApprovedCV.has(s.id));

  // Incomplete profiles (missing 2+ of key fields)
  const incompleteProfiles = activeStaff.filter(s => {
    const filled = [s.phone, s.date_of_birth, s.date_joined, s.address, s.emergency_contact_name, s.employment_type].filter(Boolean).length;
    return filled < 4;
  });

  // Missing bank details
  const staffWithBank = new Set(bankRecords.map(b => b.staff_id));
  const missingBank = activeStaff.filter(s => !staffWithBank.has(s.id));

  // Today's workflow
  const completedToday = todayReports.filter(r => r.status === 'Completed');
  const blockedToday = todayReports.filter(r => r.status === 'Blocked');
  const pendingReviewToday = todayReports.filter(r => r.review_status === 'Pending Review');
  
  const lateClockIns = todayReports.filter(r => {
    if (!r.clock_in_time) return false;
    const [h, m] = r.clock_in_time.split(':').map(Number);
    const [startH, startM] = schedule.start_time.split(':').map(Number);
    const threshold = schedule.late_threshold_minutes || 0;
    
    const clockInMinutes = h * 60 + m;
    const startMinutes = startH * 60 + startM + threshold;
    
    return clockInMinutes > startMinutes;
  });

  // Upcoming birthdays (next 30 days)
  const upcomingBirthdays = activeStaff.filter(s => {
    if (!s.date_of_birth) return false;
    const bday = parseISO(s.date_of_birth);
    const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    return isAfter(thisYearBday, addDays(now, -1)) && isBefore(thisYearBday, addDays(now, 30));
  }).sort((a, b) => {
    const aD = parseISO(a.date_of_birth), bD = parseISO(b.date_of_birth);
    return new Date(now.getFullYear(), aD.getMonth(), aD.getDate()) - new Date(now.getFullYear(), bD.getMonth(), bD.getDate());
  }).slice(0, 5);

  // Work anniversaries (next 30 days)
  const upcomingAnniversaries = activeStaff.filter(s => {
    if (!s.date_joined) return false;
    const joined = parseISO(s.date_joined);
    const ann = new Date(now.getFullYear(), joined.getMonth(), joined.getDate());
    return isAfter(ann, addDays(now, -1)) && isBefore(ann, addDays(now, 30));
  }).slice(0, 5);

  // Due for confirmation (next 60 days)
  const dueForConfirmation = activeStaff.filter(s => {
    if (s.confirmation_status !== 'Pending') return false;
    if (!s.probation_end_date) return false;
    return isBefore(parseISO(s.probation_end_date), addDays(now, 60));
  }).slice(0, 5);

  // Salary payment reminders (within 5 days)
  const salaryReminders = bankRecords.filter(b => {
    if (!b.salary_payment_date) return false;
    const day = b.salary_payment_date;
    const todayDay = now.getDate();
    return day >= todayDay && day <= todayDay + 5;
  }).slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back, {role.replace('_', ' ')}</h2>
          <p className="text-muted-foreground">Here's what's happening at RazziStaff today.</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Link to="/access-control">
              <Button variant="outline" size="sm"><Shield className="w-4 h-4 mr-2" /> Roles</Button>
            </Link>
          )}
          {(isAdmin || hasPermission('canEditStaff')) && (
            <Link to="/staff/new">
              <Button size="sm"><UserPlus className="w-4 h-4 mr-2" /> Add Staff</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Role-Specific Dashboard Views */}
      {(role === 'super_admin' || role === 'admin') && (
        <div className="space-y-8">
          {/* Admin Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Staff" value={staffList.length} icon={Users} />
            <StatCard title="Active Staff" value={activeStaff.length} icon={CheckCircle2} />
            <StatCard title="On Probation" value={onProbation.length} icon={Clock} />
            <StatCard title="Pending Review" value={pendingReviewToday.length} icon={AlertTriangle} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DashCard title="HR Action Items" icon={ShieldAlert}>
              <DashListRow name="Missing CVs" right={missingCVStaff.length} />
              <DashListRow name="Incomplete Profiles" right={incompleteProfiles.length} />
              <DashListRow name="Due for Confirmation" right={dueForConfirmation.length} />
              <DashListRow name="Late Clock-ins Today" right={lateClockIns.length} />
            </DashCard>

            <DashCard title="Today's Workflow" icon={ClipboardList} to="/workflow">
              <DashListRow name="Reports Submitted" right={todayReports.length} />
              <DashListRow name="Completed Tasks" right={completedToday.length} />
              <DashListRow name="Blocked Tasks" right={blockedToday.length} />
              <DashListRow name="Review Needed" right={pendingReviewToday.length} />
            </DashCard>

            <DashCard title="Finance Overview" icon={DollarSign} to="/salary">
              <DashListRow name="Missing Bank Details" right={missingBank.length} />
              <DashListRow name="Salary Reminders" right={salaryReminders.length} />
              <div className="pt-2">
                <Link to="/salary"><Button variant="link" size="sm" className="h-auto p-0 text-primary">View Payroll Schedule</Button></Link>
              </div>
            </DashCard>
          </div>
        </div>
      )}

      {role === 'hr_admin' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Active Staff" value={activeStaff.length} icon={Users} />
            <StatCard title="Due for Confirmation" value={dueForConfirmation.length} icon={ShieldAlert} />
            <StatCard title="Missing CVs" value={missingCVStaff.length} icon={FileText} />
            <StatCard title="Incomplete Profiles" value={incompleteProfiles.length} icon={AlertTriangle} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DashCard title="Upcoming Birthdays" icon={Cake} to="/calendar">
              {upcomingBirthdays.length === 0 ? <EmptyNote text="No birthdays soon" /> : 
                upcomingBirthdays.map(s => <DashListRow key={s.id} name={s.full_name} sub={s.department} right={format(parseISO(s.date_of_birth), 'MMM d')} />)
              }
            </DashCard>
            <DashCard title="Work Anniversaries" icon={CalendarDays} to="/calendar">
              {upcomingAnniversaries.length === 0 ? <EmptyNote text="No anniversaries soon" /> : 
                upcomingAnniversaries.map(s => <DashListRow key={s.id} name={s.full_name} sub={s.department} right={format(parseISO(s.date_joined), 'MMM d')} />)
              }
            </DashCard>
          </div>
        </div>
      )}

      {role === 'finance_admin' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Staff with Bank" value={staffWithBank.size} icon={Building2} />
            <StatCard title="Missing Bank" value={missingBank.length} icon={AlertTriangle} />
            <StatCard title="Reminders" value={salaryReminders.length} icon={DollarSign} />
            <StatCard title="Total Active" value={activeStaff.length} icon={Users} />
          </div>
          <DashCard title="Payment Reminders (Next 5 Days)" icon={DollarSign} to="/salary">
            {salaryReminders.length === 0 ? <EmptyNote text="No payments due" /> : 
              salaryReminders.map(b => <DashListRow key={b.id} name={b.staff_name} sub={b.bank_name} right={`Due: ${b.salary_payment_date}th`} />)
            }
          </DashCard>
        </div>
      )}

      {role === 'manager' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Reports Submitted" value={todayReports.length} icon={ClipboardList} />
            <StatCard title="Pending Review" value={pendingReviewToday.length} icon={Clock} />
            <StatCard title="Blocked Tasks" value={blockedToday.length} icon={XCircle} />
            <StatCard title="Late Clock-ins" value={lateClockIns.length} icon={AlertTriangle} />
          </div>
          <DashCard title="Recent Reports for Review" icon={ClipboardList} to="/workflow">
            {pendingReviewToday.length === 0 ? <EmptyNote text="All caught up!" /> : 
              pendingReviewToday.slice(0, 5).map(r => <DashListRow key={r.id} name={r.staff_name} sub={r.assigned_task} right={<StatusBadge status={r.status} />} />)
            }
          </DashCard>
        </div>
      )}

      {role === 'user' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-lg">Daily Workflow Report</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Submit your daily report to keep your manager updated on your progress.</p>
                <Link to="/workflow"><Button className="w-full sm:w-auto">Go to Workflow Reports</Button></Link>
              </CardContent>
            </Card>
            <DashCard title="My Profile Status" icon={UserCheck}>
              <div className="space-y-4">
                <div className="flex justify-between text-sm"><span>Onboarding</span><span className="font-bold">80%</span></div>
                <div className="w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{ width: '80%' }} /></div>
                <p className="text-xs text-muted-foreground">Please ensure your bank details and emergency contacts are up to date in Settings.</p>
              </div>
            </DashCard>
          </div>
        </div>
      )}

      {/* Common Footer Grid for Admins */}
      {(role === 'super_admin' || role === 'admin') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DashCard title="Upcoming Birthdays" icon={Cake} to="/calendar">
            {upcomingBirthdays.length === 0 ? <EmptyNote text="No birthdays soon" /> : 
              upcomingBirthdays.map(s => <DashListRow key={s.id} name={s.full_name} sub={s.department} right={format(parseISO(s.date_of_birth), 'MMM d')} />)
            }
          </DashCard>
          <DashCard title="Late Clock-ins Today" icon={ShieldAlert} to="/workflow">
            {lateClockIns.length === 0 ? <EmptyNote text="Everyone is on time!" /> : 
              lateClockIns.map(r => <DashListRow key={r.id} name={r.staff_name} sub={r.department} right={<StatusBadge status="Late" />} />)
            }
          </DashCard>
        </div>
      )}
    </div>
  );
}