import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { Users, ClipboardList, AlertTriangle, ShieldAlert, UserPlus, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow } from './DashboardShared';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
  });

  const { data: todayReports = [] } = useQuery({
    queryKey: ['today-reports', format(new Date(), 'yyyy-MM-dd')],
    queryFn: () => entities.DailyWorkflowReport.filter({ report_date: format(new Date(), 'yyyy-MM-dd') }),
  });

  const activeStaff = staffList.filter(s => s.employment_status === 'Active');
  const pendingReview = todayReports.filter(r => r.review_status === 'Pending Review');
  const incompleteProfiles = staffList.filter(s => (s.profile_completion_percentage || 0) < 80);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage staff, documents, and operations.</p>
        </div>
        <Link to="/staff/new"><Button size="sm"><UserPlus className="w-4 h-4 mr-2" /> Add Staff</Button></Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Staff" value={activeStaff.length} icon={Users} />
        <StatCard title="Today's Reports" value={todayReports.length} icon={ClipboardList} />
        <StatCard title="Pending Review" value={pendingReview.length} icon={AlertTriangle} />
        <StatCard title="Incomplete Profiles" value={incompleteProfiles.length} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard title="HR Action Queue" icon={ShieldAlert}>
          <DashListRow name="Staff Onboarding" right={incompleteProfiles.length} />
          <DashListRow name="Due for Confirmation" right={<Link to="/staff" className="text-xs text-primary hover:underline">Check List</Link>} />
        </DashCard>

        <DashCard title="Workflow Overview" icon={ClipboardList} to="/workflow">
          <DashListRow name="Reports Submitted" right={todayReports.length} />
          <DashListRow name="Awaiting Approval" right={pendingReview.length} />
        </DashCard>
      </div>
    </div>
  );
}
