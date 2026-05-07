import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { 
  Users, ClipboardList, AlertTriangle, ShieldAlert, UserPlus, 
  Clock, CheckCircle2, FileText, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow } from './DashboardShared';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: todayReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['today-reports', format(new Date(), 'yyyy-MM-dd')],
    queryFn: () => entities.DailyWorkflowReport.filter({ 
      report_date: format(new Date(), 'yyyy-MM-dd') 
    }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: userDocuments = [] } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: async () => {
      const docs = await entities.StaffDocument.list('-created_at', 500);
      return docs.filter(d => !d.document_status || d.document_status === 'Pending');
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeStaff = staffList.filter(s => s.employment_status === 'Active');
  const pendingReview = todayReports.filter(r => r.review_status === 'Pending Review');
  const incompleteProfiles = staffList.filter(s => (s.profile_completion_percentage || 0) < 80);
  const completedToday = todayReports.filter(r => r.status === 'Completed');
  const blockedTasks = todayReports.filter(r => r.status === 'Blocked');
  const pendingCVs = staffList.length - userDocuments.filter(d => d.document_type === 'CV').length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage staff, documents, and operations.</p>
        </div>
        <Link to="/staff/new">
          <Button size="sm">
            <UserPlus className="w-4 h-4 mr-2" /> Add Staff
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Staff" 
          value={staffList.length} 
          icon={Users}
          loading={staffLoading}
        />
        <StatCard 
          title="Reports Today" 
          value={todayReports.length} 
          icon={ClipboardList}
          loading={reportsLoading}
        />
        <StatCard 
          title="Completed Today" 
          value={completedToday.length} 
          icon={CheckCircle2}
          loading={reportsLoading}
        />
        <StatCard 
          title="Blocked Tasks" 
          value={blockedTasks.length} 
          icon={AlertTriangle}
          loading={reportsLoading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Pending CVs" 
          value={pendingCVs} 
          icon={FileText}
        />
        <StatCard 
          title="Pending Reviews" 
          value={pendingReview.length} 
          icon={AlertCircle}
          loading={reportsLoading}
        />
        <StatCard 
          title="Due for Confirmation" 
          value={staffList.filter(s => s.confirmation_status === 'Pending').length} 
          icon={Clock}
          loading={staffLoading}
        />
        <StatCard 
          title="Incomplete Profiles" 
          value={incompleteProfiles.length} 
          icon={ShieldAlert}
          loading={staffLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard title="HR Action Queue" icon={ShieldAlert}>
          <DashListRow name="Staff Onboarding" right={incompleteProfiles.length} />
          <DashListRow name="Due for Confirmation" right={<Link to="/staff" className="text-xs text-primary hover:underline">Check</Link>} />
          <DashListRow name="Pending Approvals" right={pendingReview.length} />
        </DashCard>

        <DashCard title="Workflow Overview" icon={ClipboardList} to="/workflow">
          <DashListRow name="Reports Submitted" right={todayReports.length} />
          <DashListRow name="Completed" right={completedToday.length} />
          <DashListRow name="Awaiting Review" right={pendingReview.length} />
        </DashCard>
      </div>
    </div>
  );
}