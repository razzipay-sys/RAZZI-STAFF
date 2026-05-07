import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { Users, CheckCircle2, Clock, AlertTriangle, ShieldAlert, ClipboardList, DollarSign, Shield, UserPlus, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow } from './DashboardShared';
import { format } from 'date-fns';

export default function SuperAdminDashboard() {
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
  });

  const { data: todayReports = [] } = useQuery({
    queryKey: ['today-reports', format(new Date(), 'yyyy-MM-dd')],
    queryFn: () => entities.DailyWorkflowReport.filter({ report_date: format(new Date(), 'yyyy-MM-dd') }),
  });

  const activeStaff = staffList.filter(s => s.employment_status === 'Active');
  const onProbation = staffList.filter(s => s.employment_type === 'Probation');
  const pendingReview = todayReports.filter(r => r.review_status === 'Pending Review');

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Super Admin Console</h2>
          <p className="text-muted-foreground">Global oversight and system controls.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/access-control"><Button variant="outline" size="sm"><Shield className="w-4 h-4 mr-2" /> Roles</Button></Link>
          <Link to="/audit-logs"><Button variant="outline" size="sm"><FileText className="w-4 h-4 mr-2" /> Audits</Button></Link>
          <Link to="/staff/new"><Button size="sm"><UserPlus className="w-4 h-4 mr-2" /> Add Staff</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Staff" value={staffList.length} icon={Users} />
        <StatCard title="Active Staff" value={activeStaff.length} icon={CheckCircle2} />
        <StatCard title="On Probation" value={onProbation.length} icon={Clock} />
        <StatCard title="Pending Review" value={pendingReview.length} icon={AlertTriangle} />
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
        </DashCard>

        <DashCard title="Finance Summary" icon={DollarSign} to="/salary">
          <DashListRow name="Missing Bank Details" right={staffList.length - activeStaff.length} />
          <DashListRow name="Salary Reminders" right="Active" />
        </DashCard>
      </div>
    </div>
  );
}
