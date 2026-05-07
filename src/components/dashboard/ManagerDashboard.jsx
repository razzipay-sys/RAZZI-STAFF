import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { ClipboardList, Clock, XCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { DashCard, DashListRow, EmptyNote } from './DashboardShared';
import { format } from 'date-fns';

export default function ManagerDashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayReports = [] } = useQuery({
    queryKey: ['today-reports', today],
    queryFn: () => entities.DailyWorkflowReport.filter({ report_date: today }),
  });

  const pendingReview = todayReports.filter(r => r.review_status === 'Pending Review');
  const blockedTasks = todayReports.filter(r => r.status === 'Blocked');
  const completedTasks = todayReports.filter(r => r.status === 'Completed');

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Team Manager Dashboard</h2>
        <p className="text-muted-foreground">Monitor team productivity and review reports.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Reports Today" value={todayReports.length} icon={ClipboardList} />
        <StatCard title="Pending Review" value={pendingReview.length} icon={Clock} />
        <StatCard title="Blocked Tasks" value={blockedTasks.length} icon={XCircle} />
        <StatCard title="Completed" value={completedTasks.length} icon={CheckCircle2} />
      </div>

      <DashCard title="Recent Reports for Review" icon={MessageSquare} to="/workflow">
        {pendingReview.length === 0 ? <EmptyNote text="All reports reviewed!" /> : 
          pendingReview.slice(0, 5).map(r => (
            <DashListRow 
              key={r.id} 
              name={r.staff_name} 
              sub={r.assigned_task} 
              right={<StatusBadge status={r.status} />} 
            />
          ))
        }
      </DashCard>
    </div>
  );
}
