import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { UserCheck, ClipboardList, CalendarDays, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashCard, DashListRow, EmptyNote } from './DashboardShared';
import StatusBadge from '@/components/ui/StatusBadge';

export default function StaffDashboard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.email],
    queryFn: async () => {
      const p = await entities.StaffProfile.filter({ email: user?.email });
      return p[0] || null;
    },
    enabled: !!user?.email,
  });

  const { data: myReports = [] } = useQuery({
    queryKey: ['my-reports', profile?.staff_id],
    queryFn: () => entities.DailyWorkflowReport.filter({ staff_id: profile.staff_id }, '-report_date', 5),
    enabled: !!profile?.staff_id,
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Hello, {profile?.full_name?.split(' ')[0] || 'Staff'}</h2>
        <p className="text-muted-foreground">Keep your reports up to date and check your schedule.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-white/5 bg-white/5 backdrop-blur-sm">
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
            myReports.map(r => (
              <DashListRow 
                key={r.id} 
                name={r.report_date} 
                sub={r.assigned_task} 
                right={<StatusBadge status={r.status} />} 
              />
            ))
          }
        </DashCard>

        <DashCard title="Quick Links" icon={CalendarDays}>
          <div className="space-y-2">
            <Link to="/calendar"><Button className="w-full justify-start" variant="outline" size="sm">HR Calendar</Button></Link>
            <Link to="/settings"><Button className="w-full justify-start" variant="outline" size="sm">My Account Settings</Button></Link>
          </div>
        </DashCard>
      </div>
    </div>
  );
}
