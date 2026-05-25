import React, { useState, useMemo, useRef } from 'react';
import { entities } from '@/lib/supabaseEntities';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Plus, Search, MessageSquare, CheckCircle2, Eye, Download,
  ImageIcon, X, FileText, Clock, MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';
import { toast } from 'sonner';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import {
  exportToCSV, exportToPDF, exportToDocx,
  exportSingleReportToPDF, exportSingleReportToDocx,
} from '@/lib/exportUtils';

const EVIDENCE_MAX_MB = 10;
const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

const EMPTY_REPORT = {
  report_date: format(new Date(), 'yyyy-MM-dd'),
  assigned_task: '', task_description: '', priority: 'Medium', status: 'In Progress',
  work_done: '', proof_link: '', blockers: '', hours_worked: 0,
  work_mode_for_day: 'On-site', clock_in_time: '', clock_out_time: '',
  compliance_status: 'Pending Review', next_action: '',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ReportSection({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{title}</p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function MetaChip({ icon: Icon, label }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-md">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WorkflowReports() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission, isAdmin } = useRoleAccess();
  const { logAction } = useAuditLog();
  const evidenceInputRef = useRef(null);

  // Form state
  const [submitOpen, setSubmitOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_REPORT);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [reviewFilter, setReviewFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  // Dialog state
  const [viewDialog, setViewDialog] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewComment, setReviewComment] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: reports = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['workflow-reports'],
    queryFn: () => entities.DailyWorkflowReport.list('-report_date', 500),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 5000),
    staleTime: 5 * 60 * 1000,
  });

  // ── Evidence upload handler ────────────────────────────────────────────────

  const handleEvidenceChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!EVIDENCE_TYPES.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, WebP, GIF, HEIC)');
      return;
    }
    if (file.size > EVIDENCE_MAX_MB * 1024 * 1024) {
      toast.error(`Image must be under ${EVIDENCE_MAX_MB}MB`);
      return;
    }
    setEvidenceFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setEvidencePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearEvidence = () => {
    setEvidenceFile(null);
    setEvidencePreview(null);
    if (evidenceInputRef.current) evidenceInputRef.current.value = '';
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createReport = useMutation({
    mutationFn: async (data) => {
      const staffMatch = staffList.find(s => s.email?.toLowerCase() === user?.email?.toLowerCase());
      let evidenceUrl = null;

      // Upload evidence image first (non-blocking — report still saves if upload fails)
      if (evidenceFile) {
        setIsUploading(true);
        const ext = evidenceFile.name.split('.').pop() || 'jpg';
        const path = `workflow-evidence/${staffMatch?.id || user?.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('staff-documents')
          .upload(path, evidenceFile, { upsert: true });
        setIsUploading(false);
        if (uploadErr) {
          toast.warning('Evidence image could not be uploaded — report will be saved without it');
        } else {
          const { data: urlData } = supabase.storage.from('staff-documents').getPublicUrl(path);
          evidenceUrl = urlData.publicUrl;
        }
      }

      const reportData = {
        ...data,
        staff_profile_id: staffMatch?.id || '',
        staff_name: data.staff_name || staffMatch?.full_name || user?.email || '',
        department: data.department || staffMatch?.department || '',
        evidence_url: evidenceUrl,
      };

      const created = await entities.DailyWorkflowReport.create(reportData);
      await logAction({
        actionType: 'CREATE', entityType: 'DailyWorkflowReport',
        entityName: reportData.staff_name,
        notes: `Daily report submitted for ${data.report_date}${evidenceUrl ? ' (with evidence)' : ''}`,
      });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-reports'] });
      toast.success('Report submitted successfully');
      setSubmitOpen(false);
      setForm(EMPTY_REPORT);
      clearEvidence();
    },
    onError: (err) => toast.error(err?.message || 'Failed to submit report'),
  });

  const reviewReport = useMutation({
    mutationFn: async ({ reportId, reviewStatus, comment }) => {
      await entities.DailyWorkflowReport.update(reportId, {
        review_status: reviewStatus,
        supervisor_comment: comment,
        supervisor_name: user?.user_metadata?.full_name || user?.email,
      });
      await logAction({
        actionType: 'UPDATE', entityType: 'DailyWorkflowReport',
        entityId: reportId, notes: `Report reviewed: ${reviewStatus}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-reports'] });
      toast.success('Review saved');
      setReviewDialog(null);
      setReviewComment('');
      // Sync view dialog if open
      if (viewDialog) {
        setViewDialog(prev => prev ? { ...prev, review_status: reviewDialog?.review_status } : null);
      }
    },
    onError: (err) => toast.error(err?.message || 'Review failed'),
  });

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reports.filter(r => {
      const matchSearch = !q ||
        r.staff_name?.toLowerCase().includes(q) ||
        r.assigned_task?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.work_done?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchReview = reviewFilter === 'All' || r.review_status === reviewFilter;
      const matchDate = !dateFilter || r.report_date === dateFilter;
      return matchSearch && matchStatus && matchReview && matchDate;
    });
  }, [reports, search, statusFilter, reviewFilter, dateFilter]);

  // ── Export handlers ───────────────────────────────────────────────────────

  const handleBulkExport = async (fmt) => {
    const dataToExport = filtered.map(r => ({
      Staff: r.staff_name || '',
      Date: r.report_date || '',
      Department: r.department || '',
      Task: r.assigned_task || r.work_done || '',
      Priority: r.priority || '',
      Status: r.status || '',
      Review: r.review_status || '',
      Hours: r.hours_worked || '',
      WorkMode: r.work_mode_for_day || '',
      Blockers: r.blockers || '',
      NextAction: r.next_action || '',
      Supervisor: r.supervisor_name || '',
      SupervisorComment: r.supervisor_comment || '',
      Evidence: r.evidence_url ? 'Yes' : 'No',
    }));
    const exportHeaders = ['Staff', 'Date', 'Department', 'Task', 'Priority', 'Status', 'Review', 'Hours', 'WorkMode', 'Blockers', 'NextAction', 'Supervisor', 'SupervisorComment', 'Evidence'];

    try {
      if (fmt === 'csv') {
        exportToCSV(dataToExport, 'Workflow_Reports');
      } else if (fmt === 'docx') {
        await exportToDocx(dataToExport, { title: 'Daily Workflow Reports', filename: 'Workflow_Reports', headers: exportHeaders });
      } else {
        await exportToPDF(dataToExport, { title: 'Daily Workflow Reports', filename: 'Workflow_Reports', headers: exportHeaders });
      }
      await logAction({ actionType: 'EXPORT', entityType: 'DailyWorkflowReport', notes: `Bulk exported ${filtered.length} reports as ${fmt.toUpperCase()}` });
      toast.success(`${filtered.length} reports exported as ${fmt.toUpperCase()}`);
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
  };

  const handleSingleExport = async (report, fmt) => {
    try {
      if (fmt === 'pdf') {
        await exportSingleReportToPDF(report);
      } else {
        await exportSingleReportToDocx(report);
      }
      await logAction({
        actionType: 'EXPORT', entityType: 'DailyWorkflowReport',
        entityId: report.id, entityName: report.staff_name,
        notes: `Exported single report as ${fmt.toUpperCase()}`,
      });
      toast.success(`Report exported as ${fmt.toUpperCase()}`);
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const canReview = isAdmin || hasPermission('canReviewReports');
  const canExport = isAdmin || hasPermission('canExport');

  // ── Loaders / errors ──────────────────────────────────────────────────────

  if (showLoader) return <PageLoader message="Loading workflow reports..." />;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {(isError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading reports' : 'Workflow reports unavailable'}
          description={error?.message || 'Showing what is available.'}
          onRetry={refetch}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, task, department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Bulk export */}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export All ({filtered.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleBulkExport('csv')}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkExport('pdf')}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkExport('docx')}>Export as DOCX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Submit report */}
          <Dialog open={submitOpen} onOpenChange={open => { setSubmitOpen(open); if (!open) { setForm(EMPTY_REPORT); clearEvidence(); } }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Submit Report
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit Daily Workflow Report</DialogTitle>
              </DialogHeader>

              <form onSubmit={e => { e.preventDefault(); createReport.mutate(form); }} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Report Date *</Label>
                    <Input type="date" value={form.report_date} onChange={e => updateField('report_date', e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => updateField('priority', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Low', 'Medium', 'High', 'Urgent'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assigned Task</Label>
                    <Input value={form.assigned_task} onChange={e => updateField('assigned_task', e.target.value)} placeholder="e.g. Fix login bug" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => updateField('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Not Started', 'In Progress', 'Completed', 'Pending Review', 'Blocked', 'Carried Forward'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Work Mode Today</Label>
                    <Select value={form.work_mode_for_day} onValueChange={v => updateField('work_mode_for_day', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Remote', 'On-site', 'Hybrid'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hours Worked</Label>
                    <Input type="number" step="0.5" min="0" max="24" value={form.hours_worked} onChange={e => updateField('hours_worked', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Clock In</Label>
                    <Input type="time" value={form.clock_in_time} onChange={e => updateField('clock_in_time', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Clock Out</Label>
                    <Input type="time" value={form.clock_out_time} onChange={e => updateField('clock_out_time', e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>What I Worked On Today *</Label>
                  <Textarea value={form.work_done} onChange={e => updateField('work_done', e.target.value)} rows={3} required placeholder="Describe what you accomplished today..." />
                </div>

                <div className="space-y-1.5">
                  <Label>Blockers / Challenges</Label>
                  <Textarea value={form.blockers} onChange={e => updateField('blockers', e.target.value)} rows={2} placeholder="Any blockers or issues encountered..." />
                </div>

                <div className="space-y-1.5">
                  <Label>Plan for Tomorrow</Label>
                  <Textarea value={form.next_action} onChange={e => updateField('next_action', e.target.value)} rows={2} placeholder="What you plan to do next..." />
                </div>

                <div className="space-y-1.5">
                  <Label>Proof Link (optional)</Label>
                  <Input value={form.proof_link} onChange={e => updateField('proof_link', e.target.value)} placeholder="URL to a PR, commit, Figma, Notion, etc." />
                </div>

                {/* Evidence image upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    Evidence Image (optional)
                  </Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 bg-muted/20">
                    {evidencePreview ? (
                      <div className="relative">
                        <img
                          src={evidencePreview}
                          alt="Evidence preview"
                          className="w-full max-h-52 object-contain rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={clearEvidence}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">{evidenceFile?.name}</p>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col items-center gap-2 cursor-pointer py-4"
                        onClick={() => evidenceInputRef.current?.click()}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                          Click to upload a screenshot or photo as proof<br />
                          <span className="text-xs">JPEG, PNG, WebP, GIF — max {EVIDENCE_MAX_MB}MB</span>
                        </p>
                      </div>
                    )}
                    <input
                      ref={evidenceInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEvidenceChange}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setSubmitOpen(false); setForm(EMPTY_REPORT); clearEvidence(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createReport.isPending || isUploading}>
                    {createReport.isPending || isUploading ? 'Submitting…' : 'Submit Report'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <Input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="w-[180px]"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Task Status" /></SelectTrigger>
          <SelectContent>
            {['All', 'Not Started', 'In Progress', 'Completed', 'Pending Review', 'Blocked', 'Carried Forward'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Review Status" /></SelectTrigger>
          <SelectContent>
            {['All', 'Pending Review', 'Approved', 'Needs Correction', 'Rejected'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(dateFilter || statusFilter !== 'All' || reviewFilter !== 'All' || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFilter(''); setStatusFilter('All'); setReviewFilter('All'); setSearch(''); }}>
            Clear filters
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'report' : 'reports'} found</p>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No reports found" description="No workflow reports match your current filters." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden md:table-cell">Task</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Review</TableHead>
                  <TableHead className="hidden lg:table-cell">Hours</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{r.staff_name}</p>
                        <p className="text-xs text-muted-foreground">{r.department}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.report_date ? format(parseISO(r.report_date), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm max-w-[200px] truncate text-muted-foreground">
                      {r.assigned_task || r.work_done}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={r.priority || 'Medium'} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={r.status || 'In Progress'} />
                        {r.evidence_url && (
                          <span title="Has evidence image">
                            <ImageIcon className="w-3.5 h-3.5 text-primary/60" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={r.review_status || 'Pending Review'} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {r.hours_worked ? `${r.hours_worked}h` : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* View full report */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="View report"
                          onClick={() => setViewDialog(r)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {/* Per-report export */}
                        {canExport && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Export report">
                                <Download className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleSingleExport(r, 'pdf')}>
                                Export as PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSingleExport(r, 'docx')}>
                                Export as DOCX
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {/* Review */}
                        {canReview && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Review report"
                            onClick={() => { setReviewDialog(r); setReviewComment(''); }}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── View Report Dialog ── */}
      <Dialog open={!!viewDialog} onOpenChange={open => { if (!open) setViewDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-lg">{viewDialog?.staff_name}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {viewDialog?.department} {viewDialog?.department && viewDialog?.report_date ? '•' : ''} {viewDialog?.report_date ? format(parseISO(viewDialog.report_date), 'MMMM d, yyyy') : ''}
                </p>
              </div>
              {canExport && viewDialog && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0">
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSingleExport(viewDialog, 'pdf')}>Export as PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSingleExport(viewDialog, 'docx')}>Export as DOCX</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </DialogHeader>

          {viewDialog && (
            <div className="space-y-5 pt-1">
              {/* Meta chips */}
              <div className="flex flex-wrap gap-2">
                <MetaChip icon={Clock} label={viewDialog.hours_worked ? `${viewDialog.hours_worked}h worked` : null} />
                <MetaChip icon={MapPin} label={viewDialog.work_mode_for_day} />
                {viewDialog.clock_in_time && <MetaChip label={`In: ${viewDialog.clock_in_time}`} />}
                {viewDialog.clock_out_time && <MetaChip label={`Out: ${viewDialog.clock_out_time}`} />}
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={viewDialog.status} />
                <StatusBadge status={viewDialog.review_status} />
                <StatusBadge status={viewDialog.priority} />
                {viewDialog.compliance_status && <StatusBadge status={viewDialog.compliance_status} />}
              </div>

              {/* Content sections */}
              {viewDialog.assigned_task && (
                <ReportSection title="Task Assigned">
                  <p className="font-medium">{viewDialog.assigned_task}</p>
                  {viewDialog.task_description && (
                    <p className="text-muted-foreground mt-1">{viewDialog.task_description}</p>
                  )}
                </ReportSection>
              )}

              <ReportSection title="Work Done">
                <p className="whitespace-pre-wrap">{viewDialog.work_done || '—'}</p>
              </ReportSection>

              {viewDialog.blockers && (
                <ReportSection title="Blockers / Challenges">
                  <p className="whitespace-pre-wrap text-amber-600 dark:text-amber-400">{viewDialog.blockers}</p>
                </ReportSection>
              )}

              {viewDialog.next_action && (
                <ReportSection title="Plan for Tomorrow">
                  <p className="whitespace-pre-wrap">{viewDialog.next_action}</p>
                </ReportSection>
              )}

              {viewDialog.proof_link && (
                <ReportSection title="Proof Link">
                  <a
                    href={viewDialog.proof_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {viewDialog.proof_link}
                  </a>
                </ReportSection>
              )}

              {/* Evidence image */}
              {viewDialog.evidence_url && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" /> Evidence Image
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
                    <img
                      src={viewDialog.evidence_url}
                      alt="Report evidence"
                      className="w-full max-h-80 object-contain"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <a href={viewDialog.evidence_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> View Full Size
                      </Button>
                    </a>
                    <a href={viewDialog.evidence_url} download>
                      <Button variant="outline" size="sm">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download Image
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {/* Supervisor review */}
              {viewDialog.supervisor_name && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Supervisor Review</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={viewDialog.review_status} />
                    <span className="text-sm text-muted-foreground">by {viewDialog.supervisor_name}</span>
                  </div>
                  {viewDialog.supervisor_comment && (
                    <p className="text-sm mt-1 whitespace-pre-wrap">{viewDialog.supervisor_comment}</p>
                  )}
                </div>
              )}

              {/* Review action (for permitted roles) */}
              {canReview && (
                <div className="flex justify-end pt-1 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setReviewDialog(viewDialog); setReviewComment(viewDialog.supervisor_comment || ''); }}
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                    {viewDialog.supervisor_name ? 'Update Review' : 'Add Review'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog ── */}
      <Dialog open={!!reviewDialog} onOpenChange={open => { if (!open) setReviewDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review Report</DialogTitle></DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-sm font-medium">{reviewDialog.staff_name} — {reviewDialog.report_date}</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{reviewDialog.work_done}</p>
                {reviewDialog.blockers && (
                  <p className="text-xs text-amber-500 mt-1">Blockers: {reviewDialog.blockers}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Supervisor Comment</Label>
                <Textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="Add a comment or feedback..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => reviewReport.mutate({ reportId: reviewDialog.id, reviewStatus: 'Needs Correction', comment: reviewComment })}
                  disabled={reviewReport.isPending}
                >
                  Needs Correction
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => reviewReport.mutate({ reportId: reviewDialog.id, reviewStatus: 'Rejected', comment: reviewComment })}
                  disabled={reviewReport.isPending}
                >
                  Reject
                </Button>
                <Button
                  onClick={() => reviewReport.mutate({ reportId: reviewDialog.id, reviewStatus: 'Approved', comment: reviewComment })}
                  disabled={reviewReport.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
