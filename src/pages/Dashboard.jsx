import React from 'react';
import useRoleAccess from '@/lib/useRoleAccess';

// Role-specific Dashboards
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import HRAdminDashboard from '@/components/dashboard/HRAdminDashboard';
import FinanceAdminDashboard from '@/components/dashboard/FinanceAdminDashboard';
import ManagerDashboard from '@/components/dashboard/ManagerDashboard';
import StaffDashboard from '@/components/dashboard/StaffDashboard';

export default function Dashboard() {
  const { role, isRoleLoading } = useRoleAccess();

  const renderDashboard = () => {
    switch (role) {
    case 'super_admin':
      return <SuperAdminDashboard />;
    case 'admin':
      return <AdminDashboard />;
    case 'hr_admin':
      return <HRAdminDashboard />;
    case 'finance_admin':
      return <FinanceAdminDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'user':
    default:
      return <StaffDashboard />;
    }
  };

  return (
    <>
      {isRoleLoading && (
        <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          Syncing access...
        </div>
      )}
      {renderDashboard()}
    </>
  );
}
