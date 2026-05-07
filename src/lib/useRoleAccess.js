import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ROLE_PERMISSIONS = {
  super_admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: true,
    canEditSalary: true, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: true,
    canViewAuditLogs: true, canExport: true, canDeleteRecords: true,
    canManageRoles: true,
  },
  admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: false,
    canEditSalary: false, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: true,
    canViewAuditLogs: true, canExport: true, canDeleteRecords: false,
    canManageRoles: true,
  },
  hr_admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: false,
    canEditSalary: false, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: false, canReviewReports: false,
    canViewAuditLogs: false, canExport: true, canDeleteRecords: false,
  },
  finance_admin: {
    canViewAllStaff: true, canEditStaff: false, canViewSalary: true,
    canEditSalary: true, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: false, canEditWorkflow: false, canReviewReports: false,
    canViewAuditLogs: false, canExport: true, canDeleteRecords: false,
  },
  manager: {
    canViewAllStaff: false, canEditStaff: false, canViewSalary: false,
    canEditSalary: false, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: true, canEditWorkflow: false, canReviewReports: true,
    canViewAuditLogs: false, canExport: false, canDeleteRecords: false,
  },
  user: {
    canViewAllStaff: false, canEditStaff: false, canViewSalary: false,
    canEditSalary: false, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: false, canEditWorkflow: false, canReviewReports: false,
    canViewAuditLogs: false, canExport: false, canDeleteRecords: false,
  },
};

export const useRoleAccess = () => {
  const { user, isLoadingAuth, getUserRole } = useAuth();
  const [permissions, setPermissions] = useState(ROLE_PERMISSIONS.user);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoadingAuth) {
      const role = getUserRole ? getUserRole() : 'user';
      setPermissions(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user);
      setIsLoading(false);
    }
  }, [user, isLoadingAuth]);

  const hasPermission = (p) => permissions[p] === true;
  const isAdmin = () => ['super_admin', 'admin', 'hr_admin', 'finance_admin'].includes(getUserRole?.() || 'user');
  const isSuperAdmin = () => (getUserRole?.() || 'user') === 'super_admin';

  return { user, permissions, isLoading, hasPermission, isAdmin, isSuperAdmin };
};

export default useRoleAccess;
