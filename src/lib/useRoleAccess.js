import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useQuery } from '@tanstack/react-query';
import { entities } from './supabaseEntities';

export const ROLE_PERMISSIONS = {
  super_admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: true,
    canEditSalary: true, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: true,
    canViewAuditLogs: true, canExport: true, canDeleteRecords: true,
    canManageRoles: true, canEditSettings: true,
  },
  admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: false,
    canEditSalary: false, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: true,
    canViewAuditLogs: true, canExport: true, canDeleteRecords: false,
    canManageRoles: true, canEditSettings: true,
  },
  hr_admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: false,
    canEditSalary: false, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: false, canReviewReports: false,
    canViewAuditLogs: false, canExport: true, canDeleteRecords: false,
    canEditSettings: false,
  },
  finance_admin: {
    canViewAllStaff: true, canEditStaff: false, canViewSalary: true,
    canEditSalary: true, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: false, canEditWorkflow: false, canReviewReports: false,
    canViewAuditLogs: false, canExport: true, canDeleteRecords: false,
    canEditSettings: false,
  },
  manager: {
    canViewAllStaff: true, canEditStaff: false, canViewSalary: false,
    canEditSalary: false, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: true,
    canViewAuditLogs: false, canExport: true, canDeleteRecords: false,
    canEditSettings: false,
  },
  user: {
    canViewAllStaff: false, canEditStaff: false, canViewSalary: false,
    canEditSalary: false, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: false,
    canViewAuditLogs: false, canExport: false, canDeleteRecords: false,
    canEditSettings: false,
  },
};

export default function useRoleAccess() {
  const { user } = useAuth();
  
  // Fetch role from user_roles table
  const { data: dbRoleData, isLoading: loadingRole } = useQuery({
    queryKey: ['user-role', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const roles = await entities.UserRole.filter({ email: user.email });
      return roles[0] || null;
    },
    enabled: !!user?.email,
  });

  const getRole = () => {
    if (!user) return 'guest';
    
    // 1. Super Admin Override
    if (user.email === import.meta.env.VITE_SUPER_ADMIN_EMAIL) return 'super_admin';
    
    // 2. Database Role
    if (dbRoleData?.role) return dbRoleData.role;
    
    // 3. Metadata Fallback
    if (user.user_metadata?.role) return user.user_metadata.role;
    
    // 4. Default
    return 'user';
  };

  const role = getRole();
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;

  return {
    user,
    role,
    permissions,
    isLoading: loadingRole,
    isAdmin: ['admin', 'super_admin'].includes(role),
    isSuperAdmin: role === 'super_admin',
    hasPermission: (perm) => !!permissions[perm],
    canManageRoles: !!permissions.canManageRoles,
    canEditSettings: !!permissions.canEditSettings
  };
}
