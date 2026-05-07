import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { UserCheck, ClipboardList, CalendarDays, ArrowRight, AlertCircle, TrendingUp, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow, EmptyNote } from './DashboardShared';
import StatusBadge from '@/components/ui/StatusBadge';
import { format } from 'date-fns';
import useTimedLoading from '@/hooks/useTimedLoading';

export default function StaffDashboard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.email],
    queryFn: async () => {
      const p = await entities.StaffProfile.filter({ email: user?.email });
      return p[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
  });

  const { data: myReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['my-reports', profile?.staff_id],
    queryFn: () => entities.DailyWorkflowReport.filter({ 
      staff_id: profile.staff_id 
    }, '-report_date', 10),
    enabled: !!profile?.staff_id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: myPendingReviews = [] } = useQuery({
    queryKey: ['my-pending-reviews', profile?.staff_id],
    queryFn: async () => {
      const reports = await entities.DailyWorkflowReport.filter({ 
        staff_id: profile.staff_id 
      });
      return reports.filter(r => r.review_status === 'Pending Review');
    },
    enabled: !!profile?.staff_id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: myDocuments = [] } = useQuery({
    queryKey: ['my-documents', profile?.staff_id],
    queryFn: () => entities.StaffDocument.filter({ staff_id: profile.staff_id }),
    enabled: !!profile?.staff_id,
    staleTime: 2 * 60 * 1000,
  });

  const thisMonthReports = myReports.filter(r => {
    const reportMonth = new Date(r.report_date).getMonth();
    return reportMonth === new Date().getMonth();
  });

  const completedReports = myReports.filter(r => r.status === 'Completed');
  const reportsTimed = useTimedLoading(reportsLoading);
  const todayReportCount = myReports.filter(r => r.report_date === format(new Date(), 'yyyy-MM-dd')).length;
  const pendingDocuments = myDocuments.filter(d => !d.document_status || d.document_status === 'Pending' || d.status === 'Pending');

  if (!profile) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome</h2>
          <p className="text-muted-foreground">Your profile is being set up...</p>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">Your staff profile has not been linked yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Please contact your administrator to link your profile to your email: {user?.email}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Hello, {profile?.full_name?.split(' ')[0] || 'Staff'}</h2>
        <p className="text-muted-foreground">Keep your reports up to date and check your schedule.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="My Reports This Month" 
          value={thisMonthReports.length} 
          icon={ClipboardList}
          loading={reportsTimed.showLoader}
        />
        <StatCard 
          title="My Reports Today" 
          value={todayReportCount} 
          icon={TrendingUp}
          loading={reportsTimed.showLoader}
        />
        <StatCard 
          title="My Completed Tasks" 
          value={completedReports.length} 
          icon={UserCheck}
          loading={reportsTimed.showLoader}
        />
        <StatCard 
          title="My Pending Reviews" 
          value={myPendingReviews.length} 
          icon={AlertCircle}
          loading={reportsTimed.showLoader}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="My Documents Pending" 
          value={pendingDocuments.length} 
          icon={FileText}
        />
        <StatCard 
          title="My Profile Completion" 
          value={`${profile?.profile_completion_percentage || 0}%`} 
          icon={UserCheck}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Daily Workflow Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Submit your daily progress report to keep your manager informed.</p>
            <Link to="/workflow">
              <Button className="gradient-primary text-primary-foreground">
                Go to Workflow <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <DashCard title="Profile Completion" icon={UserCheck}>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Onboarding Status</span>
              <span className="font-bold">{profile?.profile_completion_percentage || 0}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${profile?.profile_completion_percentage || 0}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground italic">Ensure bank details and documents are uploaded in Settings.</p>
          </div>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard title="My Recent Reports" icon={ClipboardList} to="/workflow">
          {myReports.length === 0 ? <EmptyNote text="No reports submitted yet" /> : 
            myReports.slice(0, 5).map(r => (
              <DashListRow 
                key={r.id} 
                name={r.report_date} 
                sub={r.assigned_task?.substring(0, 40)} 
                right={<StatusBadge status={r.status} />} 
              />
            ))
          }
        </DashCard>

        <DashCard title="Quick Links" icon={CalendarDays}>
          <div className="space-y-2">
            <Link to="/calendar">
              <Button className="w-full justify-start" variant="outline" size="sm">HR Calendar</Button>
            </Link>
            <Link to="/settings">
              <Button className="w-full justify-start" variant="outline" size="sm">My Account Settings</Button>
            </Link>
            <Link to="/workflow">
              <Button className="w-full justify-start" variant="outline" size="sm">Submit Report</Button>
            </Link>
          </div>
        </DashCard>
      </div>
    </div>
  );
}
