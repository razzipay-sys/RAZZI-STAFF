import React from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, FileText, ClipboardList, AlertTriangle,
  CheckCircle2, Clock, XCircle, ArrowRight, Cake,
  UserCheck, DollarSign, CalendarDays, TrendingUp,
  Building2, ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format, isAfter, isBefore, addDays, parseISO } from 'date-fns';

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
  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_date', 500),
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['staff-documents'],
    queryFn: () => entities.StaffDocument.list('-created_date', 500),
  });

  const { data: bankRecords = [], isLoading: loadingBank } = useQuery({
    queryKey: ['bank-details'],
    queryFn: () => entities.StaffBankDetails.list('-created_date', 500),
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['today-reports', today],
    queryFn: () => entities.DailyWorkflowReport.filter({ report_date: today }, '-created_date', 500),
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
    return h > 9 || (h === 9 && m > 0);
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
    <div className="space-y-6 animate-fade-in">

      {/* Row 1: Staff Overview */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Staff Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Total Staff" value={staffList.length} icon={Users} />
          <StatCard title="Active Staff" value={activeStaff.length} icon={CheckCircle2} />
          <StatCard title="On Probation" value={onProbation.length} icon={Clock} />
          <StatCard title="Confirmed" value={confirmed.length} icon={UserCheck} />
        </div>
      </div>

      {/* Row 2: HR Actions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">HR Action Items</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Missing CVs" value={missingCVStaff.length} icon={FileText} />
          <StatCard title="Incomplete Profiles" value={incompleteProfiles.length} icon={AlertTriangle} />
          <StatCard title="No Bank Details" value={missingBank.length} icon={DollarSign} />
          <StatCard title="Due for Confirmation" value={dueForConfirmation.length} icon={ShieldAlert} />
        </div>
      </div>

      {/* Row 3: Today's Workflow */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Workflow — {format(now, 'EEEE, MMM d yyyy')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Reports Submitted" value={todayReports.length} icon={ClipboardList} />
          <StatCard title="Completed Tasks" value={completedToday.length} icon={TrendingUp} />
          <StatCard title="Blocked Tasks" value={blockedToday.length} icon={XCircle} />
          <StatCard title="Pending Reviews" value={pendingReviewToday.length} icon={Clock} />
        </div>
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Today's Reports */}
        <DashCard title="Today's Reports" icon={ClipboardList} to="/workflow">
          {todayReports.length === 0 ? <EmptyNote text="No reports submitted today" /> : (
            <div>
              {todayReports.slice(0, 6).map(r => (
                <DashListRow key={r.id}
                  name={r.staff_name}
                  sub={r.assigned_task || r.work_done?.slice(0, 50)}
                  right={<StatusBadge status={r.status || 'In Progress'} />}
                />
              ))}
            </div>
          )}
        </DashCard>

        {/* Upcoming Birthdays */}
        <DashCard title="Upcoming Birthdays (30 days)" icon={Cake} to="/calendar">
          {upcomingBirthdays.length === 0 ? <EmptyNote text="No upcoming birthdays in the next 30 days" /> : (
            <div>
              {upcomingBirthdays.map(s => (
                <DashListRow key={s.id}
                  name={s.full_name}
                  sub={s.department}
                  right={format(new Date(now.getFullYear(), parseISO(s.date_of_birth).getMonth(), parseISO(s.date_of_birth).getDate()), 'MMM d')}
                />
              ))}
            </div>
          )}
        </DashCard>

        {/* Missing CVs */}
        <DashCard title="Staff Missing CVs" icon={FileText} to="/documents">
          {missingCVStaff.length === 0 ? <EmptyNote text="All active staff have submitted CVs" /> : (
            <div>
              {missingCVStaff.slice(0, 6).map(s => (
                <DashListRow key={s.id}
                  name={s.full_name}
                  sub={`${s.department || '—'} · ${s.role || '—'}`}
                  right={<StatusBadge status="Pending" />}
                />
              ))}
            </div>
          )}
        </DashCard>

        {/* Due for Confirmation */}
        <DashCard title="Confirmation Due (60 days)" icon={UserCheck}>
          {dueForConfirmation.length === 0 ? <EmptyNote text="No staff due for confirmation" /> : (
            <div>
              {dueForConfirmation.map(s => (
                <DashListRow key={s.id}
                  name={s.full_name}
                  sub={s.department}
                  right={s.probation_end_date ? format(parseISO(s.probation_end_date), 'MMM d, yyyy') : 'N/A'}
                />
              ))}
            </div>
          )}
        </DashCard>

        {/* Work Anniversaries */}
        <DashCard title="Work Anniversaries (30 days)" icon={CalendarDays} to="/calendar">
          {upcomingAnniversaries.length === 0 ? <EmptyNote text="No work anniversaries in the next 30 days" /> : (
            <div>
              {upcomingAnniversaries.map(s => {
                const joined = parseISO(s.date_joined);
                const years = now.getFullYear() - joined.getFullYear();
                return (
                  <DashListRow key={s.id}
                    name={s.full_name}
                    sub={s.department}
                    right={`${years} yr${years !== 1 ? 's' : ''} · ${format(new Date(now.getFullYear(), joined.getMonth(), joined.getDate()), 'MMM d')}`}
                  />
                );
              })}
            </div>
          )}
        </DashCard>

        {/* Salary Reminders */}
        <DashCard title="Salary Payment Reminders" icon={DollarSign} to="/salary">
          {salaryReminders.length === 0 ? <EmptyNote text="No salary payments due in the next 5 days" /> : (
            <div>
              {salaryReminders.map(b => (
                <DashListRow key={b.id}
                  name={b.staff_name}
                  sub={b.bank_name}
                  right={`Due: ${b.salary_payment_date}th`}
                />
              ))}
            </div>
          )}
        </DashCard>

        {/* Missing Bank Details */}
        <DashCard title="Missing Bank/Account Details" icon={Building2} to="/salary">
          {missingBank.length === 0 ? <EmptyNote text="All active staff have bank details recorded" /> : (
            <div>
              {missingBank.slice(0, 6).map(s => (
                <DashListRow key={s.id}
                  name={s.full_name}
                  sub={`${s.department || '—'} · ${s.role || '—'}`}
                  right={<StatusBadge status="Pending" />}
                />
              ))}
            </div>
          )}
        </DashCard>

        {/* Late Clock-ins */}
        <DashCard title="Late Clock-ins Today" icon={ShieldAlert} to="/workflow">
          {lateClockIns.length === 0 ? <EmptyNote text="No late clock-ins recorded today" /> : (
            <div>
              {lateClockIns.slice(0, 6).map(r => (
                <DashListRow key={r.id}
                  name={r.staff_name}
                  sub={r.department}
                  right={<StatusBadge status="Late" />}
                />
              ))}
            </div>
          )}
        </DashCard>

      </div>
    </div>
  );
}