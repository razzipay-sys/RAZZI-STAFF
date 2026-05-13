import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, DollarSign, Edit, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';
import { toast } from 'sonner';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';
import { useAuth } from '@/lib/AuthContext';

export default function SalaryManagement() {
  const queryClient = useQueryClient();
  const { hasPermission } = useRoleAccess();
  const { logAction } = useAuditLog();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    staff_id: '', staff_name: '', bank_name: '', account_number: '',
    account_name: ''
  });

  const { data: bankRecords = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['bank-details'],
    queryFn: () => entities.StaffBankDetails.list('-created_at', 200),
    enabled: hasPermission('canViewSalary'),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 200),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const staffOptions = useMemo(() => (
    [...staffList].filter(s => s.staff_id && s.full_name).sort((a, b) => a.full_name.localeCompare(b.full_name))
  ), [staffList]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.staff_id) {
        throw new Error('Select a staff name');
      }
      if (!data.bank_name || !data.account_number || !data.account_name) {
        throw new Error('Please fill in all required bank fields');
      }

      const staffMatch = staffList.find(s => s.staff_id === data.staff_id);
      const finalData = {
        ...data,
        staff_name: staffMatch?.full_name || data.staff_name
      };

      if (editId) {
        await entities.StaffBankDetails.update(editId, finalData);
        await logAction({
          actionType: 'UPDATE',
          entityType: 'StaffBankDetails',
          entityId: editId,
          entityName: finalData.staff_name,
          notes: 'Bank details updated'
        });
      } else {
        const result = await entities.StaffBankDetails.create(finalData);
        await logAction({
          actionType: 'CREATE',
          entityType: 'StaffBankDetails',
          entityId: result?.id,
          entityName: finalData.staff_name,
          notes: 'Bank details created'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-details'] });
      toast.success(editId ? 'Bank details updated' : 'Bank details created');
      setDialogOpen(false);
      setEditId(null);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save bank details');
    },
  });

  const filtered = useMemo(() => {
    return bankRecords.filter(b => {
      return !search || b.staff_name?.toLowerCase().includes(search.toLowerCase()) || b.bank_name?.toLowerCase().includes(search.toLowerCase());
    });
  }, [bankRecords, search]);

  const handleExport = async (format) => {
    const dataToExport = filtered.map(b => ({
      Staff: b.staff_name,
      Bank: b.bank_name,
      Account_No: b.account_number,
      Account_Name: b.account_name,
    }));

    if (format === 'csv') {
      exportToCSV(dataToExport, 'Bank_Details');
    } else {
      exportToPDF(dataToExport, { 
        title: 'Bank Details Report', 
        filename: 'Bank_Details',
        headers: ['Staff', 'Bank', 'Account_No', 'Account_Name']
      });
    }

    await logAction({
      actionType: 'EXPORT',
      entityType: 'StaffBankDetails',
      notes: `Exported ${filtered.length} salary records as ${format.toUpperCase()}`
    });
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const openEdit = (record) => {
    setForm(record);
    setEditId(record.id);
    setDialogOpen(true);
  };

  const openNew = () => {
    const self = staffList.find(s => s.email?.toLowerCase() === user?.email?.toLowerCase());
    setForm({
      staff_id: self?.staff_id || '',
      staff_name: self?.full_name || '',
      bank_name: '',
      account_number: '',
      account_name: ''
    });
    setEditId(null);
    setDialogOpen(true);
  };

  const updateField = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  if (!hasPermission('canViewSalary')) {
    return <EmptyState icon={DollarSign} title="Access Restricted" description="You don't have permission to view salary information." />;
  }

  if (showLoader) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {(isError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading bank data' : 'Bank data unavailable'}
          description={error?.message || 'Showing an empty bank details list for now.'}
          onRetry={refetch}
        />
      )}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by staff name or bank..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
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
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasPermission('canEditSalary') && (
            <Button onClick={openNew} className="gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Add Bank Details
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={DollarSign} title="No bank records" description="No bank records found." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account</TableHead>
                  {hasPermission('canEditSalary') && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-sm">{b.staff_name}</TableCell>
                    <TableCell className="text-sm">{b.bank_name}</TableCell>
                    <TableCell className="text-sm font-mono">{b.account_number}</TableCell>
                    {hasPermission('canEditSalary') && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Edit className="w-4 h-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Add'} Bank Details</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Name *</Label>
              <Select value={form.staff_id} onValueChange={v => {
                const match = staffOptions.find(s => s.staff_id === v);
                updateField('staff_id', v);
                updateField('staff_name', match?.full_name || '');
              }}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staffOptions.map(s => <SelectItem key={s.staff_id} value={s.staff_id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name *</Label>
                <Input value={form.bank_name} onChange={e => updateField('bank_name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Account Number *</Label>
                <Input value={form.account_number} onChange={e => updateField('account_number', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <Input value={form.account_name} onChange={e => updateField('account_name', e.target.value)} required />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{editId ? 'Update' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
