import { useAuth } from './AuthContext';
import { useQuery } from '@tanstack/react-query';
import supabase from './supabase';

const ROLE_LOOKUP_TIMEOUT_MS = 5000;

const withTimeout = (promise, timeoutMs) => (
  Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ data: null, error: new Error('Role lookup timed out') }), timeoutMs);
    }),
  ])
);

export const ROLE_PERMISSIONS = {
  super_admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: true,
    canEditSalary: true, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: true,
    canViewAuditLogs: true, canExport: true, canDeleteRecords: true,
    canManageRoles: true, canEditSettings: true,
  },
  admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: true,
    canEditSalary: true, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: true,
    canViewAuditLogs: true, canExport: true, canDeleteRecords: false,
    canManageRoles: true, canEditSettings: true,
  },
  hr_admin: {
    canViewAllStaff: true, canEditStaff: true, canViewSalary: true,
    canEditSalary: true, canViewDocuments: true, canEditDocuments: true,
    canViewWorkflow: true, canEditWorkflow: false, canReviewReports: false,
    canViewAuditLogs: false, canExport: true, canDeleteRecords: false,
    canManageRoles: false, canEditSettings: false,
  },
  finance_admin: {
    canViewAllStaff: true, canEditStaff: false, canViewSalary: true,
    canEditSalary: true, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: false, canEditWorkflow: false, canReviewReports: false,
    canViewAuditLogs: false, canExport: true, canDeleteRecords: false,
    canManageRoles: false, canEditSettings: false,
  },
  manager: {
    canViewAllStaff: true, canEditStaff: false, canViewSalary: false,
    canEditSalary: false, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: true,
    canViewAuditLogs: false, canExport: true, canDeleteRecords: false,
    canManageRoles: false, canEditSettings: false,
  },
  user: {
    canViewAllStaff: false, canEditStaff: false, canViewSalary: false,
    canEditSalary: false, canViewDocuments: false, canEditDocuments: false,
    canViewWorkflow: true, canEditWorkflow: true, canReviewReports: false,
    canViewAuditLogs: false, canExport: false, canDeleteRecords: false,
    canManageRoles: false, canEditSettings: false,
  },
};

export default function useRoleAccess() {
  const { user } = useAuth();
  const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL;
  const isSuperAdminOverride = !!superAdminEmail && user?.email?.toLowerCase() === superAdminEmail.toLowerCase();
  const fallbackRole = isSuperAdminOverride
    ? 'super_admin'
    : user?.user_metadata?.role || (user ? 'user' : 'guest');

  const {
    data: dbRoleData,
    isFetching: isRoleLoading,
    error: roleError,
  } = useQuery({
    queryKey: ['user-role', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;

      const { data, error } = await withTimeout(
        supabase
          .from('user_roles')
          .select('*')
          .ilike('email', user.email)
          .maybeSingle(),
        ROLE_LOOKUP_TIMEOUT_MS
      );

      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[useRoleAccess] DB role unavailable:', error.message);
        }
        return null;
      }

      return data || null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    networkMode: 'online',
    gcTime: 10 * 60 * 1000,
  });

  const getRole = () => {
    if (!user) return 'guest';

    if (isSuperAdminOverride) {
      if (import.meta.env.DEV) {
        console.log('[useRoleAccess] Using VITE_SUPER_ADMIN_EMAIL override');
      }
      return 'super_admin';
    }

    if (dbRoleData?.role) {
      if (import.meta.env.DEV) {
        console.log('[useRoleAccess] Using DB role:', dbRoleData.role);
      }
      return dbRoleData.role;
    }

    if (fallbackRole !== 'user') {
      if (import.meta.env.DEV) {
        console.log('[useRoleAccess] Using fallback role:', fallbackRole);
      }
      return fallbackRole;
    }

    if (import.meta.env.DEV) {
      console.log('[useRoleAccess] Using default role: user');
    }
    return 'user';
  };

  const role = getRole();
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;

  return {
    user,
    role,
    permissions,
    isLoading: false,
    isRoleLoading,
    roleError,
    isAdmin: ['admin', 'super_admin'].includes(role),
    isSuperAdmin: role === 'super_admin',
    hasPermission: (perm) => !!permissions[perm],
    canManageRoles: !!permissions.canManageRoles,
    canEditSettings: !!permissions.canEditSettings
  };
}
