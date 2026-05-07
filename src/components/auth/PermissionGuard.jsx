import React from 'react';
import { useLocation } from 'react-router-dom';
import useRoleAccess from '@/lib/useRoleAccess';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { ShieldAlert } from 'lucide-react';

export default function PermissionGuard({ children, permission, adminOnly = false }) {
  const { hasPermission, isAdmin, isLoading } = useRoleAccess();
  const location = useLocation();

  if (isLoading) return <PageLoader />;

  const isAuthorized = adminOnly ? isAdmin : hasPermission(permission);

  if (!isAuthorized) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState 
          icon={ShieldAlert}
          title="Access Restricted"
          description="You do not have the required permissions to view this page. If you believe this is an error, please contact your system administrator."
          actionLabel="Go to Dashboard"
          action={() => window.location.href = '/'}
        />
      </div>
    );
  }

  return children;
}
