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

  // Fetch role from user_roles table with comprehensive error handling
  const { data: dbRoleData, isLoading: loadingRole } = useQuery({
    queryKey: ['user-role', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        const roles = await entities.UserRole.filter({ email: user.email });
        return roles?.[0] || null;
      } catch (err) {
        // Log in development, silently fallback in production
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useRoleAccess] DB role fetch failed:', err.message);
        }
        return null; // Fallback to VITE_SUPER_ADMIN_EMAIL or user metadata
      }
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once
    gcTime: 10 * 60 * 1000, // Keep in cache 10 minutes
  });

  const getRole = () => {
    if (!user) return 'guest';

    // 1. Super Admin Override (from env var) - highest priority
    const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL;
    if (superAdminEmail && user.email === superAdminEmail) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[useRoleAccess] Using VITE_SUPER_ADMIN_EMAIL override');
      }
      return 'super_admin';
    }

    // 2. Database Role (from user_roles table)
    if (dbRoleData?.role) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[useRoleAccess] Using DB role:', dbRoleData.role);
      }
      return dbRoleData.role;
    }

    // 3. User Metadata Fallback (from auth user metadata)
    if (user.user_metadata?.role) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[useRoleAccess] Using user metadata role:', user.user_metadata.role);
      }
      return user.user_metadata.role;
    }

    // 4. Default to 'user' (staff role)
    if (process.env.NODE_ENV === 'development') {
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
    isLoading: loadingRole,
    isAdmin: ['admin', 'super_admin'].includes(role), // Boolean, not function
    isSuperAdmin: role === 'super_admin', // Boolean, not function
    hasPermission: (perm) => !!permissions[perm], // Function for custom permissions
    canManageRoles: !!permissions.canManageRoles,
    canEditSettings: !!permissions.canEditSettings
  };
}
