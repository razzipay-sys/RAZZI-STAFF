import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { Users, FileText, Clock, AlertTriangle, CheckCircle2, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow } from './DashboardShared';
import { format } from 'date-fns';

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

  const totalStaff = staffList.length;
  const incompleteProfiles = staffList.filter(s => (s.profile_completion_percentage || 0) < 80);
  const dueProbation = staffList.filter(s => s.confirmation_status === 'Pending' || s.employment_type === 'Probation');
  const pendingCVs = staffList.length - userDocuments.filter(d => d.document_type === 'CV').length;
  const pendingReview = todayReports.filter(r => r.review_status === 'Pending Review');

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
          loading={staffLoading}
        />
        <StatCard 
          title="Reports Today" 
          value={todayReports.length} 
          icon={CheckCircle2}
          loading={reportsLoading}
        />
        <StatCard 
          title="Pending Reviews" 
          value={pendingReview.length} 
          icon={Clock}
          loading={reportsLoading}
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
          loading={staffLoading}
        />
        <StatCard 
          title="Incomplete Profiles" 
          value={incompleteProfiles.length} 
          icon={AlertTriangle}
          loading={staffLoading}
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
