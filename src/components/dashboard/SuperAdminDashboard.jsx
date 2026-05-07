import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { 
  Users, CheckCircle2, Clock, AlertTriangle, ShieldAlert, 
  ClipboardList, DollarSign, Shield, UserPlus, FileText,
  FileCheck, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow } from './DashboardShared';
import { format } from 'date-fns';
import useTimedLoading from '@/hooks/useTimedLoading';

export default function SuperAdminDashboard() {
  const { data: staffList = [], isLoading: staffLoading, error: staffError } = useQuery({
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

  const { data: userDocuments = [], isLoading: docsLoading } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: async () => {
      const docs = await entities.StaffDocument.list('-created_at', 500);
      return docs.filter(d => !d.document_status || d.document_status === 'Pending');
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: bankDetails = [] } = useQuery({
    queryKey: ['bank-details-incomplete'],
    queryFn: async () => {
      const details = await entities.StaffBankDetails.list();
      return details.filter(b => !b.account_number || !b.bank_name);
    },
    staleTime: 5 * 60 * 1000,
  });

  const onProbation = staffList.filter(s => s.employment_type === 'Probation');
  const incompleteProfiles = staffList.filter(s => (s.profile_completion_percentage || 0) < 80);
  const completedToday = todayReports.filter(r => r.status === 'Completed');
  const blockedTasks = todayReports.filter(r => r.status === 'Blocked');
  const pendingReview = todayReports.filter(r => r.review_status === 'Pending Review');
  const pendingCVs = staffList.length - userDocuments.filter(d => d.document_type === 'CV').length;
  const dueForConfirmation = staffList.filter(s => s.confirmation_status === 'Pending');
  const staffTimed = useTimedLoading(staffLoading);
  const reportsTimed = useTimedLoading(reportsLoading);
  const docsTimed = useTimedLoading(docsLoading);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Super Admin Console</h2>
          <p className="text-muted-foreground">Global oversight and system controls.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/access-control">
            <Button variant="outline" size="sm">
              <Shield className="w-4 h-4 mr-2" /> Roles
            </Button>
          </Link>
          <Link to="/audit-logs">
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" /> Audits
            </Button>
          </Link>
          <Link to="/staff/new">
            <Button size="sm">
              <UserPlus className="w-4 h-4 mr-2" /> Add Staff
            </Button>
          </Link>
        </div>
      </div>

      {/* Top-level metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Staff" 
          value={staffList.length} 
          icon={Users}
          loading={staffTimed.showLoader}
          error={staffError}
        />
        <StatCard 
          title="Reports Today" 
          value={todayReports.length} 
          icon={ClipboardList}
          loading={reportsTimed.showLoader}
        />
        <StatCard 
          title="Completed Today" 
          value={completedToday.length} 
          icon={CheckCircle2}
          loading={reportsTimed.showLoader}
        />
        <StatCard 
          title="Blocked Tasks" 
          value={blockedTasks.length} 
          icon={AlertTriangle}
          loading={reportsTimed.showLoader}
          description={blockedTasks.length > 0 ? 'Needs attention' : 'All clear'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Pending CVs" 
          value={pendingCVs} 
          icon={FileText}
          loading={docsTimed.showLoader}
        />
        <StatCard 
          title="Pending Reviews" 
          value={pendingReview.length} 
          icon={AlertCircle}
          loading={reportsTimed.showLoader}
        />
        <StatCard 
          title="Due for Confirmation" 
          value={dueForConfirmation.length} 
          icon={FileCheck}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Incomplete Profiles" 
          value={incompleteProfiles.length} 
          icon={Clock}
          loading={staffTimed.showLoader}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DashCard title="System Integrity" icon={ShieldAlert}>
          <DashListRow name="Recent Audit Logs" right={<Link to="/audit-logs" className="text-xs text-primary hover:underline">View All</Link>} />
          <DashListRow name="Role Assignments" right={<Link to="/access-control" className="text-xs text-primary hover:underline">Manage</Link>} />
          <DashListRow name="Global Settings" right={<Link to="/settings" className="text-xs text-primary hover:underline">Configure</Link>} />
        </DashCard>

        <DashCard title="Workflow Health" icon={ClipboardList} to="/workflow">
          <DashListRow name="Reports Today" right={todayReports.length} />
          <DashListRow name="Needs Review" right={pendingReview.length} />
          <DashListRow name="Blocked" right={blockedTasks.length} />
        </DashCard>

        <DashCard title="Finance Summary" icon={DollarSign} to="/salary">
          <DashListRow name="Missing Bank Details" right={bankDetails.length} />
          <DashListRow name="Pending CVs" right={pendingCVs} />
          <DashListRow name="On Probation" right={onProbation.length} />
        </DashCard>
      </div>
    </div>
  );
}
