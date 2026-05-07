import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, Download, ChevronDown,
  Mail, Phone, Building2, MapPin
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import useRoleAccess from '@/lib/useRoleAccess';

const DEPARTMENTS = ['All', 'Engineering', 'Finance', 'Operations', 'HR', 'Marketing', 'Sales', 'Customer Support', 'Legal', 'Product', 'Executive'];
const STATUSES = ['All', 'Active', 'Suspended', 'Resigned', 'Terminated', 'On Leave'];
const WORK_MODES = ['All', 'On-site', 'Remote', 'Hybrid'];
const EMPLOYMENT_TYPES = ['All', 'Full-time', 'Part-time', 'Contract', 'Intern', 'Probation'];

export default function StaffDirectory() {
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = useRoleAccess();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [status, setStatus] = useState('All');
  const [workMode, setWorkMode] = useState('All');
  const [empType, setEmpType] = useState('All');

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_date', 200),
  });

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

  if (isLoading) return <PageLoader />;

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6 animate-fade-in">
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
          {(isAdmin() || hasPermission('canEditStaff')) && (
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
          action={isAdmin() ? () => navigate('/staff/new') : undefined}
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