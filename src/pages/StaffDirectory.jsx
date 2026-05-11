import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Download
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import { exportToCSV, exportToPDF, exportIDCardsToPDF } from '@/lib/exportUtils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const DEPARTMENTS = ['All', 'Engineering', 'Finance', 'Operations', 'HR', 'Marketing', 'Sales', 'Customer Support', 'Legal', 'Product', 'Executive'];
const STATUSES = ['All', 'Active', 'Suspended', 'Resigned', 'Terminated', 'On Leave'];
const WORK_MODES = ['All', 'On-site', 'Remote', 'Hybrid'];
const EMPLOYMENT_TYPES = ['All', 'Full-time', 'Part-time', 'Contract', 'Intern', 'Probation'];

export default function StaffDirectory() {
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = useRoleAccess();
  const { logAction } = useAuditLog();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [status, setStatus] = useState('All');
  const [workMode, setWorkMode] = useState('All');
  const [empType, setEmpType] = useState('All');

  const { data: staffList = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 200),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const filtered = useMemo(() => {
    return staffList.filter(s => {
      const matchSearch = !search || 
        s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.phone?.includes(search) ||
        s.staff_id?.toLowerCase().includes(search.toLowerCase()) ||
        s.department?.toLowerCase().includes(search.toLowerCase());
      const matchDept = department === 'All' || s.department === department;
      const matchStatus = status === 'All' || s.employment_status === status;
      const matchMode = workMode === 'All' || s.work_mode === workMode;
      const matchType = empType === 'All' || s.employment_type === empType;
      return matchSearch && matchDept && matchStatus && matchMode && matchType;
    });
  }, [staffList, search, department, status, workMode, empType]);

  if (showLoader) return <PageLoader />;

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleExport = async (format) => {
    const dataToExport = filtered.map(s => ({
      ID: s.staff_id,
      Name: s.full_name,
      Email: s.email,
      Phone: s.phone,
      Department: s.department,
      Role: s.role,
      Status: s.employment_status,
      Mode: s.work_mode,
      Joined: s.date_joined
    }));

    if (format === 'csv') {
      exportToCSV(dataToExport, 'Staff_Directory');
    } else {
      exportToPDF(dataToExport, { 
        title: 'Staff Directory Report', 
        filename: 'Staff_Directory',
        headers: ['ID', 'Name', 'Email', 'Phone', 'Department', 'Role', 'Status', 'Mode', 'Joined']
      });
    }

    await logAction({
      actionType: 'EXPORT',
      entityType: 'StaffProfile',
      notes: `Exported ${filtered.length} staff records as ${format.toUpperCase()}`
    });
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const handleIdCardsExport = async () => {
    try {
      await exportIDCardsToPDF(filtered, { filename: 'Staff_ID_Cards' });
      await logAction({
        actionType: 'EXPORT',
        entityType: 'StaffProfile',
        notes: `Generated ID cards for ${filtered.length} staff members`,
      });
      toast.success('ID cards generated');
    } catch (err) {
      toast.error(err?.message || 'Failed to generate ID cards');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {(isError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading staff' : 'Staff data unavailable'}
          description={error?.message || 'Showing an empty staff directory for now.'}
          onRetry={refetch}
        />
      )}
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, email, phone, ID..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {hasPermission('canExport') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={handleIdCardsExport}>Generate ID Cards (PDF)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {(isAdmin || hasPermission('canEditStaff')) && (
            <Button onClick={() => navigate('/staff/new')} className="gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Add Staff
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={workMode} onValueChange={setWorkMode}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Work Mode" />
          </SelectTrigger>
          <SelectContent>
            {WORK_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={empType} onValueChange={setEmpType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Employment" />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">{filtered.length} staff members found</p>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState 
          title="No staff members found"
          description="Try adjusting your filters or add a new staff member."
          action={isAdmin ? () => navigate('/staff/new') : undefined}
          actionLabel="Add Staff"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden md:table-cell">Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Work Mode</TableHead>
                  <TableHead className="hidden lg:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(staff => (
                  <TableRow 
                    key={staff.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/staff/${staff.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={staff.profile_photo_url} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(staff.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{staff.full_name}</p>
                          <p className="text-xs text-muted-foreground">{staff.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{staff.department}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{staff.role}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {staff.work_mode && <StatusBadge status={staff.work_mode} />}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {staff.employment_type && <StatusBadge status={staff.employment_type} />}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={staff.employment_status || 'Active'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
