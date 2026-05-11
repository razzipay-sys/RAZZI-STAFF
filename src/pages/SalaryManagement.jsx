import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, DollarSign, Edit, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

export default function SalaryManagement() {
  const queryClient = useQueryClient();
  const { hasPermission } = useRoleAccess();
  const { logAction } = useAuditLog();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    staff_id: '', staff_name: '', bank_name: '', account_number: '',
    account_name: '', salary_amount: 0, salary_currency: 'NGN',
    salary_payment_date: 25, payment_frequency: 'Monthly',
    tax_deduction: 0, pension_deduction: 0, other_deductions: 0, finance_notes: ''
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
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.staff_id) {
        throw new Error('Select a staff member');
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
      Amount: b.salary_amount,
      Currency: b.salary_currency,
      Payment_Date: `${b.salary_payment_date}th`,
      Frequency: b.payment_frequency
    }));

    if (format === 'csv') {
      exportToCSV(dataToExport, 'Salary_Bank_Details');
    } else {
      exportToPDF(dataToExport, { 
        title: 'Salary & Bank Details Report', 
        filename: 'Salary_Bank_Details',
        headers: ['Staff', 'Bank', 'Account_No', 'Account_Name', 'Amount', 'Currency', 'Payment_Date', 'Frequency']
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
    setForm({
      staff_id: '', staff_name: '', bank_name: '', account_number: '',
      account_name: '', salary_amount: 0, salary_currency: 'NGN',
      salary_payment_date: 25, payment_frequency: 'Monthly',
      tax_deduction: 0, pension_deduction: 0, other_deductions: 0, finance_notes: ''
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
          title={timedOut ? 'Still loading salary data' : 'Salary data unavailable'}
          description={error?.message || 'Showing an empty salary list for now.'}
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
        <EmptyState icon={DollarSign} title="No bank records" description="No salary/bank records found." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead className="hidden md:table-cell">Frequency</TableHead>
                  <TableHead className="hidden lg:table-cell">Pay Day</TableHead>
                  {hasPermission('canEditSalary') && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-sm">{b.staff_name}</TableCell>
                    <TableCell className="text-sm">{b.bank_name}</TableCell>
                    <TableCell className="text-sm font-mono">{b.account_number}</TableCell>
                    <TableCell className="text-sm font-semibold">{b.salary_currency || 'NGN'} {b.salary_amount?.toLocaleString()}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{b.payment_frequency}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{b.salary_payment_date ? `${b.salary_payment_date}th` : '-'}</TableCell>
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
              <Label>Staff Member</Label>
              <Select value={form.staff_id} onValueChange={v => {
                const match = staffList.find(s => s.staff_id === v);
                updateField('staff_id', v);
                updateField('staff_name', match?.full_name || '');
              }}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staffList.map(s => <SelectItem key={s.staff_id} value={s.staff_id}>{s.full_name} ({s.staff_id})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Salary Amount</Label>
                <Input type="number" min="0" value={form.salary_amount} onChange={e => updateField('salary_amount', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Frequency</Label>
                <Select value={form.payment_frequency} onValueChange={v => updateField('payment_frequency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Monthly', 'Weekly', 'Bi-weekly', 'Contract-based'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Day</Label>
                <Input type="number" min="1" max="31" value={form.salary_payment_date} onChange={e => updateField('salary_payment_date', parseInt(e.target.value) || 25)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Finance Notes</Label>
              <Textarea value={form.finance_notes} onChange={e => updateField('finance_notes', e.target.value)} rows={2} />
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
