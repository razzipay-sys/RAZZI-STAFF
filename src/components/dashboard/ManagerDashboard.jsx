import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { ClipboardList, AlertTriangle, CheckCircle2, Users, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow } from './DashboardShared';
import { format } from 'date-fns';

export default function ManagerDashboard() {
  const { data: todayReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['today-reports', format(new Date(), 'yyyy-MM-dd')],
    queryFn: () => entities.DailyWorkflowReport.filter({ 
      report_date: format(new Date(), 'yyyy-MM-dd') 
    }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
    staleTime: 5 * 60 * 1000,
  });

  const completedToday = todayReports.filter(r => r.status === 'Completed');
  const blockedTasks = todayReports.filter(r => r.status === 'Blocked');
  const pendingReview = todayReports.filter(r => r.review_status === 'Pending Review');

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manager Dashboard</h2>
          <p className="text-muted-foreground">Oversee team workflow and performance.</p>
        </div>
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
          title="Pending Reviews" 
          value={pendingReview.length} 
          icon={AlertCircle}
          loading={reportsLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard title="Workflow Status" icon={ClipboardList}>
          <DashListRow name="Reports Today" right={todayReports.length} />
          <DashListRow name="Completed" right={completedToday.length} />
          <DashListRow name="Blocked/Needs Attention" right={blockedTasks.length} />
          <DashListRow name="Awaiting Your Review" right={pendingReview.length} />
        </DashCard>

        <DashCard title="Team Overview" icon={Users}>
          <Link to="/workflow" className="block mb-2">
            <Button variant="outline" size="sm" className="w-full justify-start">Review Reports</Button>
          </Link>
          <Link to="/staff">
            <Button variant="outline" size="sm" className="w-full justify-start">View Team</Button>
          </Link>
        </DashCard>
      </div>
    </div>
  );
}
