import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Plus, Search, Filter, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';

const emptyReport = {
  staff_name: '', department: '', report_date: format(new Date(), 'yyyy-MM-dd'),
  assigned_task: '', task_description: '', priority: 'Medium', status: 'In Progress',
  work_done: '', proof_link: '', blockers: '', start_time: '', close_time: '',
  hours_worked: 0, work_mode_for_day: 'On-site', clock_in_time: '', clock_out_time: '',
  compliance_status: 'Pending Review', supervisor_name: '', review_status: 'Pending Review',
  next_action: ''
};

export default function WorkflowReports() {
  const queryClient = useQueryClient();
  const { user, hasPermission, isAdmin } = useRoleAccess();
  const { logAction } = useAuditLog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyReport);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [reviewFilter, setReviewFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewComment, setReviewComment] = useState('');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['workflow-reports'],
    queryFn: () => entities.DailyWorkflowReport.list('-report_date', 200),
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_date', 200),
  });

  const createReport = useMutation({
    mutationFn: async (data) => {
      const staffMatch = staffList.find(s => s.email === user?.email);
      const reportData = {
        ...data,
        staff_id: staffMatch?.id || '',
        staff_name: data.staff_name || staffMatch?.full_name || user?.full_name || '',
        department: data.department || staffMatch?.department || '',
      };
      await entities.DailyWorkflowReport.create(reportData);
      await logAction({
        actionType: 'CREATE', entityType: 'DailyWorkflowReport',
        entityName: reportData.staff_name,
        notes: `Daily report submitted for ${data.report_date}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-reports'] });
      toast.success('Report submitted');
      setDialogOpen(false);
      setForm(emptyReport);
    }
  });

  const reviewReport = useMutation({
    mutationFn: async ({ reportId, reviewStatus, comment }) => {
      await entities.DailyWorkflowReport.update(reportId, {
        review_status: reviewStatus,
        supervisor_comment: comment,
        supervisor_name: user?.full_name || user?.email
      });
      await logAction({
        actionType: 'UPDATE', entityType: 'DailyWorkflowReport',
        entityId: reportId, notes: `Report reviewed: ${reviewStatus}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-reports'] });
      toast.success('Review saved');
      setReviewDialog(null);
      setReviewComment('');
    }
  });

  const filtered = useMemo(() => {
    return reports.filter(r => {
      const matchSearch = !search ||
        r.staff_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.assigned_task?.toLowerCase().includes(search.toLowerCase()) ||
        r.department?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchReview = reviewFilter === 'All' || r.review_status === reviewFilter;
      const matchDate = !dateFilter || r.report_date === dateFilter;
      return matchSearch && matchStatus && matchReview && matchDate;
    });
  }, [reports, search, statusFilter, reviewFilter, dateFilter]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search reports..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Submit Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Submit Daily Workflow Report</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createReport.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Report Date *</Label>
                  <Input type="date" value={form.report_date} onChange={e => updateField('report_date', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => updateField('priority', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Low', 'Medium', 'High', 'Urgent'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Task</Label>
                  <Input value={form.assigned_task} onChange={e => updateField('assigned_task', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => updateField('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Not Started', 'In Progress', 'Completed', 'Pending Review', 'Blocked', 'Carried Forward'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Mode Today</Label>
                  <Select value={form.work_mode_for_day} onValueChange={v => updateField('work_mode_for_day', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Remote', 'On-site', 'Hybrid'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hours Worked</Label>
                  <Input type="number" step="0.5" min="0" value={form.hours_worked} onChange={e => updateField('hours_worked', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Clock In</Label>
                  <Input type="time" value={form.clock_in_time} onChange={e => updateField('clock_in_time', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Clock Out</Label>
                  <Input type="time" value={form.clock_out_time} onChange={e => updateField('clock_out_time', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>What I Worked On Today *</Label>
                <Textarea value={form.work_done} onChange={e => updateField('work_done', e.target.value)} rows={3} required />
              </div>
              <div className="space-y-2">
                <Label>Proof/Link</Label>
                <Input value={form.proof_link} onChange={e => updateField('proof_link', e.target.value)} placeholder="URL or file reference" />
              </div>
              <div className="space-y-2">
                <Label>Blockers/Challenges</Label>
                <Textarea value={form.blockers} onChange={e => updateField('blockers', e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Plan for Tomorrow</Label>
                <Textarea value={form.next_action} onChange={e => updateField('next_action', e.target.value)} rows={2} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createReport.isPending}>Submit Report</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-[180px]" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Task Status" /></SelectTrigger>
          <SelectContent>
            {['All', 'Not Started', 'In Progress', 'Completed', 'Pending Review', 'Blocked', 'Carried Forward'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Review Status" /></SelectTrigger>
          <SelectContent>
            {['All', 'Pending Review', 'Approved', 'Needs Correction', 'Rejected'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} reports found</p>

      {filtered.length === 0 ? (
        <EmptyState title="No reports found" description="No workflow reports match your filters." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden md:table-cell">Task</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead className="hidden lg:table-cell">Hours</TableHead>
                  {(isAdmin() || hasPermission('canReviewReports')) && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{r.staff_name}</p>
                        <p className="text-xs text-muted-foreground">{r.department}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.report_date ? format(parseISO(r.report_date), 'MMM d') : 'N/A'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm max-w-[200px] truncate">{r.assigned_task || r.work_done}</TableCell>
                    <TableCell><StatusBadge status={r.priority || 'Medium'} /></TableCell>
                    <TableCell><StatusBadge status={r.status || 'In Progress'} /></TableCell>
                    <TableCell><StatusBadge status={r.review_status || 'Pending Review'} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{r.hours_worked || '-'}</TableCell>
                    {(isAdmin() || hasPermission('canReviewReports')) && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setReviewDialog(r)}>
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Report</DialogTitle></DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{reviewDialog.staff_name} — {reviewDialog.report_date}</p>
                <p className="text-sm mt-1">{reviewDialog.work_done}</p>
                {reviewDialog.blockers && <p className="text-sm text-destructive mt-1">Blockers: {reviewDialog.blockers}</p>}
              </div>
              <div className="space-y-2">
                <Label>Supervisor Comment</Label>
                <Textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => reviewReport.mutate({ reportId: reviewDialog.id, reviewStatus: 'Needs Correction', comment: reviewComment })}>
                  Needs Correction
                </Button>
                <Button onClick={() => reviewReport.mutate({ reportId: reviewDialog.id, reviewStatus: 'Approved', comment: reviewComment })}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}