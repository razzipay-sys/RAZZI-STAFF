import React, { useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ClipboardList, AlertTriangle, TrendingUp } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { PageLoader } from '@/components/ui/LoadingSpinner';

const COLORS = ['hsl(174, 72%, 46%)', 'hsl(199, 89%, 48%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(280, 65%, 60%)'];

export default function Analytics() {
  const { data: staffList = [], isLoading: ls } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 200),
  });

  const { data: reports = [], isLoading: lr } = useQuery({
    queryKey: ['all-workflow-reports'],
    queryFn: () => entities.DailyWorkflowReport.list('-report_date', 500),
  });

  const loading = ls || lr;

  const analytics = useMemo(() => {
    if (loading) return null;
    const active = staffList.filter(s => s.employment_status === 'Active');
    const last7Days = subDays(new Date(), 7);
    const recentReports = reports.filter(r => r.report_date && isAfter(parseISO(r.report_date), last7Days));

    // Department breakdown
    const deptCount = {};
    active.forEach(s => {
      const dept = s.department || 'Unassigned';
      deptCount[dept] = (deptCount[dept] || 0) + 1;
    });
    const deptData = Object.entries(deptCount).map(([name, value]) => ({ name, value }));

    // Task status breakdown
    const statusCount = {};
    recentReports.forEach(r => {
      const st = r.status || 'Unknown';
      statusCount[st] = (statusCount[st] || 0) + 1;
    });
    const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

    // Daily report count (last 7 days)
    const dailyCounts = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyCounts[d] = 0;
    }
    recentReports.forEach(r => {
      if (dailyCounts[r.report_date] !== undefined) {
        dailyCounts[r.report_date]++;
      }
    });
    const dailyData = Object.entries(dailyCounts).map(([date, count]) => ({
      date: format(parseISO(date), 'MMM d'),
      reports: count
    }));

    // Compliance breakdown
    const complianceCount = {};
    recentReports.forEach(r => {
      const c = r.compliance_status || 'Pending Review';
      complianceCount[c] = (complianceCount[c] || 0) + 1;
    });
    const complianceData = Object.entries(complianceCount).map(([name, value]) => ({ name, value }));

    const totalReports = recentReports.length;
    const completedReports = recentReports.filter(r => r.status === 'Completed').length;
    const blockedReports = recentReports.filter(r => r.status === 'Blocked').length;
    const approvedReports = recentReports.filter(r => r.review_status === 'Approved').length;

    return {
      active: active.length,
      totalReports,
      completedReports,
      blockedReports,
      approvedReports,
      completionRate: totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0,
      deptData,
      statusData,
      dailyData,
      complianceData
    };
  }, [staffList, reports, loading]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Staff" value={analytics.active} icon={Users} />
        <StatCard title="Reports (7 days)" value={analytics.totalReports} icon={ClipboardList} />
        <StatCard title="Completion Rate" value={`${analytics.completionRate}%`} icon={TrendingUp} />
        <StatCard title="Blocked Tasks" value={analytics.blockedReports} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Reports Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Daily Reports (Last 7 Days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="reports" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Staff by Department</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={analytics.deptData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {analytics.deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task Status Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">Task Status (7 Days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={analytics.statusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {analytics.statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card>
          <CardHeader><CardTitle className="text-base">Compliance Status (7 Days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.complianceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}