import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { Users, FileText, Clock, AlertTriangle, CheckCircle2, Briefcase, Cake, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow } from './DashboardShared';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import useTimedLoading from '@/hooks/useTimedLoading';

export default function HRAdminDashboard() {
  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: userDocuments = [] } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: async () => {
      const docs = await entities.StaffDocument.list('-created_at', 500);
      return docs.filter(d => !d.document_status || d.document_status === 'Pending');
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: todayReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['today-reports', format(new Date(), 'yyyy-MM-dd')],
    queryFn: () => entities.DailyWorkflowReport.filter({ 
      report_date: format(new Date(), 'yyyy-MM-dd') 
    }),
    staleTime: 2 * 60 * 1000,
  });
  const staffTimed = useTimedLoading(staffLoading);
  const reportsTimed = useTimedLoading(reportsLoading);

  const totalStaff = staffList.length;
  const incompleteProfiles = staffList.filter(s => (s.profile_completion_percentage || 0) < 80);
  const dueProbation = staffList.filter(s => s.confirmation_status === 'Pending' || s.employment_type === 'Probation');
  const pendingCVs = staffList.length - userDocuments.filter(d => d.document_type === 'CV').length;
  const pendingReview = todayReports.filter(r => r.review_status === 'Pending Review');
  const now = new Date();
  const birthdays = staffList.filter(s => {
    if (!s.date_of_birth) return false;
    const bday = parseISO(s.date_of_birth);
    const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    return isAfter(thisYear, addDays(now, -1)) && isBefore(thisYear, addDays(now, 30));
  });
  const anniversaries = staffList.filter(s => {
    if (!s.date_joined) return false;
    const joined = parseISO(s.date_joined);
    const thisYear = new Date(now.getFullYear(), joined.getMonth(), joined.getDate());
    return isAfter(thisYear, addDays(now, -1)) && isBefore(thisYear, addDays(now, 30));
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">HR Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage onboarding, documents, and staff records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Staff" 
          value={totalStaff} 
          icon={Users}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Reports Today" 
          value={todayReports.length} 
          icon={CheckCircle2}
          loading={reportsTimed.showLoader}
        />
        <StatCard 
          title="Pending Reviews" 
          value={pendingReview.length} 
          icon={Clock}
          loading={reportsTimed.showLoader}
        />
        <StatCard 
          title="Pending CVs" 
          value={pendingCVs} 
          icon={FileText}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Due for Confirmation" 
          value={dueProbation.length} 
          icon={Clock}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Incomplete Profiles" 
          value={incompleteProfiles.length} 
          icon={AlertTriangle}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Work Anniversaries" 
          value={anniversaries.length} 
          icon={CalendarDays}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Birthdays" 
          value={birthdays.length} 
          icon={Cake}
          loading={staffTimed.showLoader}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard title="Onboarding Queue" icon={Briefcase}>
          <DashListRow name="Pending Documents" right={userDocuments.length} />
          <DashListRow name="Incomplete Profiles" right={incompleteProfiles.length} />
          <DashListRow name="On Probation" right={dueProbation.length} />
        </DashCard>

        <DashCard title="Quick Actions" icon={CheckCircle2}>
          <Link to="/staff" className="block mb-2">
            <Button variant="outline" size="sm" className="w-full justify-start">View All Staff</Button>
          </Link>
          <Link to="/documents">
            <Button variant="outline" size="sm" className="w-full justify-start">Manage Documents</Button>
          </Link>
        </DashCard>
      </div>
    </div>
  );
}
