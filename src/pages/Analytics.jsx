import React, { useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ClipboardList, AlertTriangle, TrendingUp, CheckCircle2, Clock, UserCheck, BarChart2 } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';

const COLORS = [
  '#20b2aa', '#3b9ede', '#f59e0b', '#ef4444', '#10b981',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
];

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  labelStyle: { color: 'hsl(var(--foreground))' },
};

const axisTickStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

function ChartCard({ title, subtitle, children }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="pb-4 px-2">
        {children}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { data: staffList = [], isLoading: ls, isError: staffError, error: staffErrorData, refetch: refetchStaff } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 5000),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: reports = [], isLoading: lr, isError: reportsError, error: reportsErrorData, refetch: refetchReports } = useQuery({
    queryKey: ['all-workflow-reports'],
    queryFn: () => entities.DailyWorkflowReport.list('-report_date', 500),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loading = ls || lr;
  const { showLoader, timedOut } = useTimedLoading(loading);

  const analytics = useMemo(() => {
    const now = new Date();
    const last7 = subDays(now, 7);
    const last30 = subDays(now, 30);

    const active = staffList.filter(s => s.employment_status === 'Active');
    const recentReports7 = reports.filter(r => r.report_date && isAfter(parseISO(r.report_date), last7));
    const recentReports30 = reports.filter(r => r.report_date && isAfter(parseISO(r.report_date), last30));

    // Dept breakdown
    const deptCount = {};
    active.forEach(s => { const d = s.department || 'Unassigned'; deptCount[d] = (deptCount[d] || 0) + 1; });
    const deptData = Object.entries(deptCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Employment type
    const typeCount = {};
    active.forEach(s => { const t = s.employment_type || 'Unspecified'; typeCount[t] = (typeCount[t] || 0) + 1; });
    const typeData = Object.entries(typeCount).map(([name, value]) => ({ name, value }));

    // Task status
    const statusCount = {};
    recentReports7.forEach(r => { const st = r.status || 'Unknown'; statusCount[st] = (statusCount[st] || 0) + 1; });
    const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

    // Daily report trend (last 14 days)
    const dailyCounts = {};
    for (let i = 13; i >= 0; i--) {
      const d = format(subDays(now, i), 'yyyy-MM-dd');
      dailyCounts[d] = 0;
    }
    recentReports30.forEach(r => {
      if (r.report_date && dailyCounts[r.report_date] !== undefined) dailyCounts[r.report_date]++;
    });
    const dailyData = Object.entries(dailyCounts).map(([date, count]) => ({
      date: format(parseISO(date), 'MMM d'),
      reports: count,
    }));

    // Compliance
    const complianceCount = {};
    recentReports7.forEach(r => {
      const c = r.compliance_status || 'Pending Review';
      complianceCount[c] = (complianceCount[c] || 0) + 1;
    });
    const complianceData = Object.entries(complianceCount).map(([name, value]) => ({ name, value }));

    // Work mode distribution
    const modeCount = {};
    active.forEach(s => { const m = s.work_mode || 'Unspecified'; modeCount[m] = (modeCount[m] || 0) + 1; });
    const modeData = Object.entries(modeCount).map(([name, value]) => ({ name, value }));

    const totalReports7 = recentReports7.length;
    const completed7 = recentReports7.filter(r => r.status === 'Completed').length;
    const blocked7 = recentReports7.filter(r => r.status === 'Blocked').length;
    const pendingReview7 = recentReports7.filter(r => r.review_status === 'Pending Review').length;
    const confirmed = active.filter(s => s.confirmation_status === 'Confirmed').length;
    const completionRate = totalReports7 > 0 ? Math.round((completed7 / totalReports7) * 100) : 0;

    return {
      activeCount: active.length,
      totalStaff: staffList.length,
      confirmed,
      totalReports7,
      completed7,
      blocked7,
      pendingReview7,
      completionRate,
      deptData,
      typeData,
      statusData,
      dailyData,
      complianceData,
      modeData,
    };
  }, [staffList, reports]);

  if (showLoader) return <PageLoader message="Loading analytics..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {(staffError || reportsError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading analytics' : 'Analytics data unavailable'}
          description={staffErrorData?.message || reportsErrorData?.message || 'Displaying available data.'}
          onRetry={() => { refetchStaff(); refetchReports(); }}
        />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Staff" value={analytics.activeCount} icon={Users}
          description={`${analytics.totalStaff} total`} />
        <StatCard title="Reports (7 days)" value={analytics.totalReports7} icon={ClipboardList}
          description={`${analytics.completionRate}% completed`} />
        <StatCard title="Completion Rate" value={`${analytics.completionRate}%`} icon={TrendingUp}
          description={`${analytics.completed7} completed`} />
        <StatCard title="Blocked Tasks" value={analytics.blocked7} icon={AlertTriangle}
          description="Last 7 days" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending Review" value={analytics.pendingReview7} icon={Clock}
          description="Awaiting approval" />
        <StatCard title="Confirmed Staff" value={analytics.confirmed} icon={UserCheck}
          description="Confirmed employees" />
        <StatCard title="Departments" value={analytics.deptData.length} icon={BarChart2}
          description="Active departments" />
        <StatCard title="On Probation" value={analytics.typeData.find(t => t.name === 'Probation')?.value ?? 0}
          icon={Users} description="Probationary staff" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Daily Report Trend" subtitle="Last 14 days">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={analytics.dailyData}>
              <defs>
                <linearGradient id="reportGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#20b2aa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#20b2aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={axisTickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Area
                type="monotone" dataKey="reports" stroke="#20b2aa" strokeWidth={2}
                fill="url(#reportGradient)" dot={{ fill: '#20b2aa', r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Staff by Department" subtitle="Active employees">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics.deptData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={axisTickStyle} axisLine={false} tickLine={false} width={90} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#20b2aa">
                {analytics.deptData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Task Status" subtitle="Last 7 days">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={analytics.statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" paddingAngle={3}>
                {analytics.statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Work Mode" subtitle="Active staff distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={analytics.modeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" paddingAngle={3}>
                {analytics.modeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Employment Type" subtitle="Active staff breakdown">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={analytics.typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" paddingAngle={3}>
                {analytics.typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Compliance bar */}
      <ChartCard title="Compliance Status" subtitle="Last 7 days breakdown">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={analytics.complianceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" tick={axisTickStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {analytics.complianceData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
