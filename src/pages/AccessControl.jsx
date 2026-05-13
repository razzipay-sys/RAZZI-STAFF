import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Shield, UserPlus, UserCog, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import StatusBadge from '@/components/ui/StatusBadge';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import { entities } from '@/lib/supabaseEntities';
import supabase from '@/lib/supabase';
import useTimedLoading from '@/hooks/useTimedLoading';

const ROLES = [
  { value: 'user', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'finance_admin', label: 'Finance Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

const isMissingCreatedAt = (error) => error?.message?.includes('user_roles.created_at') || error?.message?.includes('created_at');

async function insertUserRole(record) {
  const { error } = await supabase.from('user_roles').insert(record);
  if (!error) return;

  if (isMissingCreatedAt(error)) {
    const { created_at: _createdAt, ...legacyRecord } = record;
    const fallback = await supabase.from('user_roles').insert(legacyRecord);
    if (!fallback.error) return;
    throw fallback.error;
  }

  throw error;
}

export default function AccessControl() {
  const queryClient = useQueryClient();
  const { role: currentUserRole, isSuperAdmin, hasPermission } = useRoleAccess();
  const { logAction } = useAuditLog();
  const [search, setSearch] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualRole, setManualRole] = useState('user');
  const [selectedUser, setSelectedUser] = useState(null);
  const visibleRoles = useMemo(
    () => (isSuperAdmin ? ROLES : ROLES.filter(r => r.value !== 'super_admin')),
    [isSuperAdmin]
  );

  const { data: staffList = [], isLoading: loadingStaff, isError: staffError, error: staffErrorData, refetch: refetchStaff } = useQuery({
    queryKey: ['staff-profiles-access'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
    staleTime: 2 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: userRoles = [], isLoading: loadingRoles, isError: rolesError, error: rolesErrorData, refetch: refetchRoles } = useQuery({
    queryKey: ['user-roles-list'],
    queryFn: async () => {
      try {
        return await entities.UserRole.list('-created_at', 500);
      } catch (error) {
        if (isMissingCreatedAt(error)) {
          return entities.UserRole.list('-assigned_at', 500);
        }
        throw error;
      }
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const staffLoadingState = useTimedLoading(loadingStaff);
  const rolesLoadingState = useTimedLoading(loadingRoles);

  const roleByEmail = useMemo(() => (
    new Map(userRoles.map(role => [role.email?.toLowerCase(), role]))
  ), [userRoles]);

  const updateRoleMutation = useMutation({
    mutationFn: async ({ staff, newRole }) => {
      const email = staff.email?.toLowerCase();
      if (!email) throw new Error('Selected staff member does not have an email address');
      if (newRole === 'super_admin' && !isSuperAdmin) {
        throw new Error('Only Super Admins can assign the Super Admin role');
      }
      if (staff.currentRole === 'super_admin' && !isSuperAdmin) {
        throw new Error('Only Super Admins can change a Super Admin role');
      }

      const existing = roleByEmail.get(email);
      if (existing) {
        const { error } = await supabase
          .from('user_roles')
          .update({
            user_id: staff.user_id || existing.user_id || null,
            email,
            role: newRole,
            assigned_by: currentUserRole,
            assigned_at: existing.assigned_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        await insertUserRole({
          user_id: staff.user_id || null,
          email,
          role: newRole,
          assigned_by: currentUserRole,
          assigned_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      await logAction({
        actionType: 'ROLE_CHANGE',
        entityType: 'UserRole',
        entityName: email,
        notes: `Role changed from ${existing?.role || 'user'} to ${newRole}`,
      });

      return { email };
    },
    onSuccess: ({ email }) => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-list'] });
      queryClient.invalidateQueries({ queryKey: ['user-role', email] });
      toast.success('User role updated successfully');
      setSelectedUser(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update role');
    },
  });

  const assignEmailMutation = useMutation({
    mutationFn: async () => {
      const email = manualEmail.trim().toLowerCase();
      if (!email) throw new Error('Enter an email address');
      if (manualRole === 'super_admin' && !isSuperAdmin) {
        throw new Error('Only Super Admins can assign the Super Admin role');
      }

      const existing = roleByEmail.get(email);
      const record = {
        email,
        role: manualRole,
        assigned_by: currentUserRole,
        assigned_at: existing?.assigned_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase.from('user_roles').update(record).eq('id', existing.id);
        if (error) throw error;
      } else {
        await insertUserRole({
          ...record,
          created_at: new Date().toISOString(),
        });
      }

      await logAction({
        actionType: 'ROLE_CHANGE',
        entityType: 'UserRole',
        entityName: email,
        notes: `Email-based role assignment to ${manualRole}`,
      });

      return { email };
    },
    onSuccess: ({ email }) => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-list'] });
      queryClient.invalidateQueries({ queryKey: ['user-role', email] });
      setManualEmail('');
      toast.success('Role assigned by email');
    },
    onError: (err) => toast.error(err.message || 'Failed to assign role'),
  });

  const filteredStaff = staffList.filter(staff => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      staff.email?.toLowerCase().includes(q) ||
      staff.staff_id?.toLowerCase().includes(q) ||
      staff.full_name?.toLowerCase().includes(q) ||
      staff.department?.toLowerCase().includes(q)
    );
  });

  if (!hasPermission('canManageRoles')) {
    return <EmptyState icon={Shield} title="Access Restricted" description="You don't have permission to manage roles." />;
  }

  if (staffLoadingState.showLoader && staffList.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Access Control</h2>
          <p className="text-muted-foreground">Manage user roles and system permissions.</p>
        </div>
      </div>

      {(staffError || staffLoadingState.timedOut) && (
        <DataState
          title={staffLoadingState.timedOut ? 'Still loading staff profiles' : 'Staff profiles unavailable'}
          description={staffErrorData?.message || 'Role assignment by email is still available below.'}
          onRetry={refetchStaff}
        />
      )}
      {(rolesError || rolesLoadingState.timedOut) && (
        <DataState
          title={rolesLoadingState.timedOut ? 'Still loading role list' : 'Role list unavailable'}
          description={rolesErrorData?.message || 'Staff profiles are shown without assigned role details.'}
          onRetry={refetchRoles}
        />
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by staff email, staff ID, full name, or department..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card className="p-4 border-white/5 bg-white/5">
        <form
          className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            assignEmailMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label>Assign role by email</Label>
            <Input
              type="email"
              placeholder="registered.user@example.com"
              value={manualEmail}
              onChange={event => setManualEmail(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use this when a registered user does not have a staff profile yet. Role resolution works by email.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={manualRole} onValueChange={setManualRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {visibleRoles.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={assignEmailMutation.isPending}>
            {assignEmailMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Assign Role
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>User / Staff</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Staff ID</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-muted-foreground">No matching registered staff/user found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map(staff => {
                  const roleData = roleByEmail.get(staff.email?.toLowerCase());
                  const currentRole = roleData?.role || 'user';

                  return (
                    <TableRow key={staff.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{staff.full_name}</span>
                          <span className="text-xs text-muted-foreground">{staff.department || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{staff.email}</TableCell>
                      <TableCell className="text-sm font-mono">{staff.staff_id || 'N/A'}</TableCell>
                      <TableCell>
                        <StatusBadge status={currentRole.replace('_', ' ')} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUser({ ...staff, currentRole })}
                          disabled={currentRole === 'super_admin' && !isSuperAdmin}
                        >
                          <UserCog className="w-4 h-4 mr-2" /> Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage User Role</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{selectedUser.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Select New Role</Label>
                <Select
                  defaultValue={selectedUser.currentRole}
                  onValueChange={(newRole) => updateRoleMutation.mutate({ staff: selectedUser, newRole })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleRoles.map(role => (
                      <SelectItem
                        key={role.value}
                        value={role.value}
                      >
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Role changes are saved immediately and reflected for the user after cache refresh or page reload.
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
            {updateRoleMutation.isPending && (
              <Button disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
