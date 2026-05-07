import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { DollarSign, Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow, EmptyNote } from './DashboardShared';

export default function FinanceAdminDashboard() {
  const { data: bankRecords = [] } = useQuery({
    queryKey: ['bank-details'],
    queryFn: () => entities.StaffBankDetails.list(),
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list(),
  });

  const missingBank = staffList.filter(s => s.employment_status === 'Active' && !bankRecords.some(b => b.staff_id === s.staff_id));

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Finance Dashboard</h2>
        <p className="text-muted-foreground">Payroll oversight and bank details management.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Staff with Bank" value={bankRecords.length} icon={Building2} />
        <StatCard title="Missing Bank" value={missingBank.length} icon={AlertTriangle} />
        <StatCard title="Total Active" value={staffList.filter(s => s.employment_status === 'Active').length} icon={DollarSign} />
        <StatCard title="Pending Payouts" value={0} icon={CheckCircle2} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard title="Missing Bank Records" icon={AlertTriangle} to="/salary">
          {missingBank.length === 0 ? <EmptyNote text="All active staff have bank details" /> : 
            missingBank.slice(0, 5).map(s => <DashListRow key={s.id} name={s.full_name} sub={s.department} right={s.staff_id} />)
          }
        </DashCard>

        <DashCard title="Quick Actions" icon={DollarSign}>
          <div className="space-y-2">
            <Link to="/salary"><Button className="w-full justify-start" variant="outline">Manage Salary Records</Button></Link>
            <Button className="w-full justify-start" variant="outline" disabled>Export Payroll CSV</Button>
          </div>
        </DashCard>
      </div>
    </div>
  );
}
