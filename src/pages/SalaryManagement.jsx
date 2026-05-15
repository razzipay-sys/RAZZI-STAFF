import React, { useMemo, useState } from 'react';
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
import { exportToCSV, exportToPDF, exportToDocx } from '@/lib/exportUtils';
import { useAuth } from '@/lib/AuthContext';
import supabase from '@/lib/supabase';

export default function SalaryManagement() {
  const queryClient = useQueryClient();
  const { hasPermission } = useRoleAccess();
  const { logAction } = useAuditLog();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    staff_profile_id: '',
    staff_name: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    salary_amount: '',
    salary_currency: 'NGN',
    salary_payment_date: '',
    payment_frequency: 'Monthly',
    tax_deduction: '',
    pension_deduction: '',
    other_deductions: '',
    finance_notes: '',
  });

  const { data: bankRecords = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['bank-details'],
    queryFn: () => entities.StaffBankDetails.list('-created_at', 5000),
    enabled: hasPermission('canViewSalary'),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles-salary'],
    queryFn: async () => {
      const batchSize = 1000;
      const maxRows = 20000;
      const rows = [];

      for (let from = 0; from < maxRows; from += batchSize) {
        const to = from + batchSize - 1;
        const { data, error } = await supabase
          .from('staff_profiles')
          .select('id, full_name, email, created_at')
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        const chunk = data || [];
        rows.push(...chunk);
        if (chunk.length < batchSize) break;
      }

      return rows;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const staffOptions = useMemo(() => {
    const displayName = (s) => (s?.full_name || s?.email || '').toString();
    return [...staffList]
      .filter(s => displayName(s))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [staffList]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const rawProfileId = typeof data.staff_profile_id === 'string' ? data.staff_profile_id.trim() : '';
      const safeProfileId = uuidRegex.test(rawProfileId) ? rawProfileId : '';

      const staffMatch = staffList.find(s => s.id === safeProfileId) || null;
      if (!staffMatch?.id) throw new Error('Selected staff profile not found');

      const salaryPaymentDate = data.salary_payment_date === '' || data.salary_payment_date === null || data.salary_payment_date === undefined
        ? null
        : Number(data.salary_payment_date);
      if (salaryPaymentDate !== null && (Number.isNaN(salaryPaymentDate) || salaryPaymentDate < 1 || salaryPaymentDate > 31)) {
        throw new Error('Salary payment date must be between 1 and 31');
      }

      const toNumberOrNull = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      };

      const finalData = {
        staff_profile_id: safeProfileId,
        staff_name: staffMatch?.full_name || data.staff_name,
        bank_name: data.bank_name,
        account_number: data.account_number,
        account_name: data.account_name,
        salary_amount: toNumberOrNull(data.salary_amount),
        salary_currency: data.salary_currency || 'NGN',
        salary_payment_date: salaryPaymentDate,
        payment_frequency: data.payment_frequency || null,
        tax_deduction: toNumberOrNull(data.tax_deduction),
        pension_deduction: toNumberOrNull(data.pension_deduction),
        other_deductions: toNumberOrNull(data.other_deductions),
        finance_notes: data.finance_notes || null,
      };

      if (editId) {
        await entities.StaffBankDetails.update(editId, finalData);
        await logAction({
          actionType: 'UPDATE',
          entityType: 'StaffBankDetails',
          entityId: editId,
          entityName: finalData.staff_name,
          notes: 'Bank & salary details updated'
        });
      } else {
        const result = await entities.StaffBankDetails.upsert(finalData, 'staff_profile_id');
        await logAction({
          actionType: 'CREATE',
          entityType: 'StaffBankDetails',
          entityId: result?.id,
          entityName: finalData.staff_name,
          notes: 'Bank & salary details created'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-details'] });
      toast.success(editId ? 'Bank details updated' : 'Bank details saved');
      setDialogOpen(false);
      setEditId(null);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save bank & salary details');
    },
  });

  const rows = useMemo(() => {
    const bankByProfileId = new Map(
      bankRecords
        .filter(b => b.staff_profile_id)
        .map(b => [b.staff_profile_id, b])
    );

    return staffOptions.map(s => {
      const bank = bankByProfileId.get(s.id);
      return {
        staff: s,
        bank,
      };
    });
  }, [bankRecords, staffOptions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ staff, bank }) => {
      return (
        staff.full_name?.toLowerCase().includes(q) ||
        staff.email?.toLowerCase().includes(q) ||
        bank?.bank_name?.toLowerCase().includes(q) ||
        bank?.account_number?.toLowerCase().includes(q) ||
        bank?.account_name?.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const handleExport = async (format) => {
    const dataToExport = filtered.map(({ staff, bank }) => ({
      Staff: staff.full_name || '',
      Email: staff.email || '',
      Bank: bank?.bank_name || '',
      Account_No: bank?.account_number || '',
      Account_Name: bank?.account_name || '',
      Salary: bank?.salary_amount ?? '',
      Currency: bank?.salary_currency ?? '',
      Pay_Date: bank?.salary_payment_date ?? '',
      Frequency: bank?.payment_frequency ?? '',
    }));

    const exportHeaders = ['Staff', 'Email', 'Bank', 'Account_No', 'Account_Name', 'Salary', 'Currency', 'Pay_Date', 'Frequency'];

    if (format === 'csv') {
      exportToCSV(dataToExport, 'Bank_Details');
    } else if (format === 'docx') {
      await exportToDocx(dataToExport, {
        title: 'Bank & Salary Report',
        filename: 'Bank_Details',
        headers: exportHeaders,
      });
    } else {
      exportToPDF(dataToExport, {
        title: 'Bank & Salary Report',
        filename: 'Bank_Details',
        headers: exportHeaders,
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
    const staffMatch = staffOptions.find(s => s.id === record.staff_profile_id) || null;
    setForm({
      staff_profile_id: record.staff_profile_id || staffMatch?.id || '',
      staff_name: staffMatch?.full_name || record.staff_name || '',
      bank_name: record.bank_name || '',
      account_number: record.account_number || '',
      account_name: record.account_name || '',
      salary_amount: record.salary_amount ?? '',
      salary_currency: record.salary_currency || 'NGN',
      salary_payment_date: record.salary_payment_date ?? '',
      payment_frequency: record.payment_frequency || 'Monthly',
      tax_deduction: record.tax_deduction ?? '',
      pension_deduction: record.pension_deduction ?? '',
      other_deductions: record.other_deductions ?? '',
      finance_notes: record.finance_notes || '',
    });
    setEditId(record.id);
    setDialogOpen(true);
  };

  const openNew = (staff = null) => {
    const selected = staff || staffList.find(s => s.email?.toLowerCase() === user?.email?.toLowerCase()) || null;
    setForm({
      staff_profile_id: selected?.id || '',
      staff_name: selected?.full_name || '',
      bank_name: '',
      account_number: '',
      account_name: '',
      salary_amount: '',
      salary_currency: 'NGN',
      salary_payment_date: '',
      payment_frequency: 'Monthly',
      tax_deduction: '',
      pension_deduction: '',
      other_deductions: '',
      finance_notes: '',
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
                <DropdownMenuItem onClick={() => handleExport('docx')}>Export as DOCX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasPermission('canEditSalary') && (
            <Button onClick={() => openNew()} className="gradient-primary text-primary-foreground">
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
                  <TableHead>Status</TableHead>
                  {hasPermission('canEditSalary') && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ staff, bank }) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium text-sm">{staff.full_name}</TableCell>
                    <TableCell className="text-sm">{bank?.bank_name || '—'}</TableCell>
                    <TableCell className="text-sm font-mono">{bank?.account_number || '—'}</TableCell>
                    <TableCell className="text-sm">{bank ? 'Saved' : 'Not set'}</TableCell>
                    {hasPermission('canEditSalary') && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {bank ? (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(bank)}><Edit className="w-4 h-4" /></Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => openNew(staff)}>Add</Button>
                          )}
                        </div>
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
              <Select value={form.staff_profile_id} onValueChange={v => {
                const match = staffOptions.find(s => s.id === v);
                updateField('staff_profile_id', v);
                updateField('staff_name', match?.full_name || '');
              }}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staffOptions.map(s => (
                    <SelectItem
                      key={s.id}
                      value={s.id}
                    >
                      {s.full_name}{s.email ? ` • ${s.email}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Salary Amount</Label>
                <Input value={form.salary_amount} onChange={e => updateField('salary_amount', e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.salary_currency} onValueChange={v => updateField('salary_currency', v)}>
                  <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Frequency</Label>
                <Select value={form.payment_frequency} onValueChange={v => updateField('payment_frequency', v)}>
                  <SelectTrigger><SelectValue placeholder="Frequency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="Contract-based">Contract-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Day (1-31)</Label>
                <Input value={form.salary_payment_date} onChange={e => updateField('salary_payment_date', e.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>Tax Deduction</Label>
                <Input value={form.tax_deduction} onChange={e => updateField('tax_deduction', e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Pension Deduction</Label>
                <Input value={form.pension_deduction} onChange={e => updateField('pension_deduction', e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Other Deductions</Label>
                <Input value={form.other_deductions} onChange={e => updateField('other_deductions', e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Finance Notes</Label>
                <Input value={form.finance_notes} onChange={e => updateField('finance_notes', e.target.value)} />
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
