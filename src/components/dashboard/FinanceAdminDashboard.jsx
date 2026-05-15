import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { Users, DollarSign, AlertTriangle, CreditCard, TrendingUp, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow } from './DashboardShared';
import useTimedLoading from '@/hooks/useTimedLoading';

export default function FinanceAdminDashboard() {
  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 5000),
    staleTime: 5 * 60 * 1000,
  });

  const { data: bankDetails = [] } = useQuery({
    queryKey: ['bank-details-incomplete'],
    queryFn: async () => {
      const details = await entities.StaffBankDetails.list('-created_at', 5000);
      return details;
    },
    staleTime: 5 * 60 * 1000,
  });
  const staffTimed = useTimedLoading(staffLoading);

  const missingBankDetails = React.useMemo(() => {
    const byProfileId = new Map(
      bankDetails
        .filter(b => b.staff_profile_id)
        .map(b => [b.staff_profile_id, b])
    );

    return staffList.filter(s => {
      const bd = byProfileId.get(s.id);
      return !bd || !bd.account_number || !bd.bank_name;
    });
  }, [bankDetails, staffList]);

  const incompleteProfiles = staffList.filter(s => (s.profile_completion_percentage || 0) < 80);
  const incompleteBankRecords = bankDetails.filter(b => !b.account_number || !b.bank_name || !b.account_name);
  const today = new Date().getDate();
  const salaryReminders = bankDetails.filter(b => {
    if (!b.salary_payment_date) return false;
    const daysUntil = b.salary_payment_date - today;
    return daysUntil >= 0 && daysUntil <= 5;
  });
  const pendingPayrollItems = missingBankDetails.length + incompleteBankRecords.length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Finance Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage payroll, salary, and financial records.</p>
        </div>
        <Link to="/salary">
          <Button size="sm">
            <DollarSign className="w-4 h-4 mr-2" /> Manage Salary
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Staff" 
          value={staffList.length} 
          icon={Users}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Missing Bank Details" 
          value={missingBankDetails.length} 
          icon={CreditCard}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Salary Reminders" 
          value={salaryReminders.length} 
          icon={TrendingUp}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Pending Payroll Items" 
          value={pendingPayrollItems} 
          icon={AlertTriangle}
          loading={staffTimed.showLoader}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Incomplete Bank Records" 
          value={incompleteBankRecords.length} 
          icon={Clock}
          loading={staffTimed.showLoader}
        />
        <StatCard 
          title="Incomplete Profiles" 
          value={incompleteProfiles.length} 
          icon={AlertTriangle}
          loading={staffTimed.showLoader}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard title="Finance Summary" icon={DollarSign}>
          <DashListRow name="Staff with Complete Details" right={staffList.length - missingBankDetails.length} />
          <DashListRow name="Missing Bank Details" right={missingBankDetails.length} />
          <DashListRow name="Active on Payroll" right={staffList.filter(s => s.employment_status === 'Active').length} />
        </DashCard>

        <DashCard title="Quick Links" icon={CreditCard}>
          <Link to="/salary" className="block mb-2">
            <Button variant="outline" size="sm" className="w-full justify-start">View Salaries</Button>
          </Link>
          <Link to="/staff">
            <Button variant="outline" size="sm" className="w-full justify-start">Update Bank Details</Button>
          </Link>
        </DashCard>
      </div>
    </div>
  );
}
