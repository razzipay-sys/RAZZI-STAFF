import React, { useState } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Shield, UserPlus, UserCog, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import StatusBadge from '@/components/ui/StatusBadge';

const ROLES = [
  { value: 'user', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'finance_admin', label: 'Finance Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

export default function AccessControl() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { role: currentUserRole, isSuperAdmin, hasPermission } = useRoleAccess(); // ← REMOVED () from isSuperAdmin
  const { logAction } = useAuditLog();
  const [searchTab, setSearchTab] = useState('staff');
  const [search, setSearch] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Fetch all profiles to link roles to users
  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ['staff-profiles-access'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch current roles from user_roles table
  const { data: userRoles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ['user-roles-list'],
    queryFn: () => entities.UserRole.list(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ email, newRole }) => {
      // Safety checks
      if (newRole === 'super_admin' && !isSuperAdmin) { // ← REMOVED () from isSuperAdmin
        throw new Error('Only Super Admins can assign the Super Admin role');
      }

      // Find if user already has a role
      const existing = userRoles.find(r => r.email?.toLowerCase() === email.toLowerCase());
      
      if (existing) {
        await entities.UserRole.update(existing.id, { 
          role: newRole,
          updated_at: new Date().toISOString()
        });
      } else {
        await entities.UserRole.create({
          email: email,
          role: newRole,
          assigned_by: currentUserRole
        });
      }

      await logAction({
        actionType: 'ROLE_CHANGE',
        entityType: 'UserRole',
        entityName: email,
        notes: `Role changed from ${existing?.role || 'user'} to ${newRole}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles-list'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      toast.success('User role updated successfully');
      setSelectedUser(null);
      setManualEmail('');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update role');
    }
  });

  // Improved search: case-insensitive, staff_id support
  const filteredStaff = staffList.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) || 
      s.email?.toLowerCase().includes(q) ||
      s.staff_id?.toLowerCase().includes(q) ||
      s.department?.toLowerCase().includes(q)
    );
  });

  if (!hasPermission('canManageRoles')) {
    return <EmptyState icon={Shield} title="Access Restricted" description="You don't have permission to manage roles." />;
  }

  if (loadingStaff || loadingRoles) return <PageLoader />;

  const noResults = filteredStaff.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Access Control</h2>
          <p className="text-muted-foreground">Manage user roles and system permissions.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by registered email, staff ID, name, or department..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-10" 
          />
        </div>
      </div>

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
              {noResults ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-muted-foreground">No matching registered staff/user found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map(staff => {
                  const roleData = userRoles.find(r => r.email?.toLowerCase() === staff.email?.toLowerCase());
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
                      <TableCell className="text-sm font-mono text-xs">{staff.staff_id || 'N/A'}</TableCell>
                      <TableCell>
                        <StatusBadge status={currentRole.replace('_', ' ')} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedUser({ ...staff, currentRole })}
                          disabled={currentRole === 'super_admin' && !isSuperAdmin} // ← REMOVED () from isSuperAdmin
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

      {/* Role Management Dialog */}
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
                  onValueChange={(val) => {
                    // Safety checks
                    if (val === 'super_admin' && !isSuperAdmin) { // ← REMOVED () from isSuperAdmin
                      toast.error('Only Super Admins can assign the Super Admin role');
                      return;
                    }
                    if (selectedUser.currentRole === 'super_admin' && !isSuperAdmin) { // ← REMOVED () from isSuperAdmin
                      toast.error('Only Super Admins can change a Super Admin role');
                      return;
                    }
                    updateRoleMutation.mutate({ 
                      email: selectedUser.email, 
                      newRole: val 
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem 
                        key={r.value} 
                        value={r.value}
                        disabled={r.value === 'super_admin' && !isSuperAdmin} // ← REMOVED () from isSuperAdmin
                      >
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Note: Role changes take effect immediately on the next page refresh for the user.
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