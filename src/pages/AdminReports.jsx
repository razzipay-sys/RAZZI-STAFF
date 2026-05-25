import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import {
  Search, Download, Eye, MessageSquare, CheckCircle2,
  ClipboardList, Clock, AlertTriangle, TrendingUp, ImageIcon,
  Filter, X, FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/ui/StatusBadge';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import {
  exportToCSV, exportToPDF, exportToDocx,
  exportSingleReportToPDF, exportSingleReportToDocx,
} from '@/lib/exportUtils';

// ─── Small helpers ────────────────────────────────────────────────────────────

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

const TODAY = format(new Date(), 'yyyy-MM-dd');

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminReports() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { logAction } = useAuditLog();

  // Filter state
  const [search, setSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [reviewFilter, setReviewFilter] = useState('All');
  const [evidenceFilter, setEvidenceFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Dialog state
  const [viewDialog, setViewDialog] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewComment, setReviewComment] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: reports = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-all-reports'],
    queryFn: () => entities.DailyWorkflowReport.list('-report_date', 1000),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 5000),
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived filter options ─────────────────────────────────────────────────

  const staffNames = useMemo(() => {
    const names = [...new Set(reports.map(r => r.staff_name).filter(Boolean))].sort();
    return names;
  }, [reports]);

  const departments = useMemo(() => {
    const depts = [...new Set(reports.map(r => r.department).filter(Boolean))].sort();
    return depts;
  }, [reports]);

  // ── Summary stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const todayReports = reports.filter(r => r.report_date === TODAY);
    return {
      total: reports.length,
      todayCount: todayReports.length,
      pendingReview: reports.filter(r => r.review_status === 'Pending Review').length,
      approved: reports.filter(r => r.review_status === 'Approved').length,
      blocked: reports.filter(r => r.status === 'Blocked').length,
      withEvidence: reports.filter(r => r.evidence_url).length,
    };
  }, [reports]);

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reports.filter(r => {
      if (q && !(
        r.staff_name?.toLowerCase().includes(q) ||
        r.assigned_task?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.work_done?.toLowerCase().includes(q)
      )) return false;
      if (staffFilter !== 'All' && r.staff_name !== staffFilter) return false;
      if (deptFilter !== 'All' && r.department !== deptFilter) return false;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (reviewFilter !== 'All' && r.review_status !== reviewFilter) return false;
      if (evidenceFilter === 'Yes' && !r.evidence_url) return false;
      if (evidenceFilter === 'No' && r.evidence_url) return false;
      if (dateFrom && r.report_date && r.report_date < dateFrom) return false;
      if (dateTo && r.report_date && r.report_date > dateTo) return false;
      return true;
    });
  }, [reports, search, staffFilter, deptFilter, statusFilter, reviewFilter, evidenceFilter, dateFrom, dateTo]);

  const activeFilterCount = [
    staffFilter !== 'All', deptFilter !== 'All', statusFilter !== 'All',
    reviewFilter !== 'All', evidenceFilter !== 'All', !!dateFrom, !!dateTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch(''); setStaffFilter('All'); setDeptFilter('All');
    setStatusFilter('All'); setReviewFilter('All'); setEvidenceFilter('All');
    setDateFrom(''); setDateTo('');
  };

  // ── Review mutation ────────────────────────────────────────────────────────

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
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-reports'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-reports'] });
      toast.success('Review saved');
      // Update view dialog if it's the same report
      if (viewDialog?.id === reviewDialog?.id) {
        setViewDialog(prev => prev ? { ...prev, review_status: vars.reviewStatus, supervisor_comment: vars.comment, supervisor_name: user?.email } : null);
      }
      setReviewDialog(null);
      setReviewComment('');
    },
    onError: (err) => toast.error(err?.message || 'Review failed'),
  });

  // ── Export handlers ────────────────────────────────────────────────────────

  const handleBulkExport = async (fmt) => {
    if (filtered.length === 0) { toast.error('No reports to export'); return; }
    const rows = filtered.map(r => ({
      Staff: r.staff_name || '',
      Date: r.report_date || '',
      Department: r.department || '',
      Task: r.assigned_task || '',
      WorkDone: r.work_done || '',
      Priority: r.priority || '',
      Status: r.status || '',
      ReviewStatus: r.review_status || '',
      Hours: r.hours_worked || '',
      WorkMode: r.work_mode_for_day || '',
      Blockers: r.blockers || '',
      NextAction: r.next_action || '',
      Supervisor: r.supervisor_name || '',
      Comment: r.supervisor_comment || '',
      Evidence: r.evidence_url ? 'Yes' : 'No',
    }));
    const hdrs = ['Staff', 'Date', 'Department', 'Task', 'WorkDone', 'Priority', 'Status', 'ReviewStatus', 'Hours', 'WorkMode', 'Blockers', 'NextAction', 'Supervisor', 'Comment', 'Evidence'];

    try {
      if (fmt === 'csv') {
        exportToCSV(rows, 'Staff_Reports_Admin');
      } else if (fmt === 'docx') {
        await exportToDocx(rows, { title: 'Staff Workflow Reports — Admin Export', filename: 'Staff_Reports_Admin', headers: hdrs });
      } else {
        await exportToPDF(rows, { title: 'Staff Workflow Reports — Admin Export', filename: 'Staff_Reports_Admin', headers: hdrs });
      }
      await logAction({ actionType: 'EXPORT', entityType: 'DailyWorkflowReport', notes: `Admin bulk exported ${filtered.length} reports as ${fmt.toUpperCase()}` });
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
      await logAction({ actionType: 'EXPORT', entityType: 'DailyWorkflowReport', entityId: report.id, entityName: report.staff_name, notes: `Admin exported single report as ${fmt.toUpperCase()}` });
      toast.success(`Report exported as ${fmt.toUpperCase()}`);
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (showLoader) return <PageLoader message="Loading staff reports..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {(isError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading reports' : 'Reports unavailable'}
          description={error?.message || 'Could not load reports right now.'}
          onRetry={refetch}
          variant={isError ? 'error' : 'warning'}
        />
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View, review and export all workflow reports submitted by staff
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shrink-0">
              <Download className="w-4 h-4 mr-2" />
              Export All ({filtered.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => handleBulkExport('csv')}>
              <FileText className="w-4 h-4 mr-2" /> Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkExport('pdf')}>
              <FileText className="w-4 h-4 mr-2" /> Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkExport('docx')}>
              <FileText className="w-4 h-4 mr-2" /> Export as DOCX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Total Reports" value={stats.total} icon={ClipboardList} description="All time" />
        <StatCard title="Today" value={stats.todayCount} icon={TrendingUp} description={format(new Date(), 'MMM d')} />
        <StatCard title="Pending Review" value={stats.pendingReview} icon={Clock} description="Awaiting" />
        <StatCard title="Approved" value={stats.approved} icon={CheckCircle2} description="All time" />
        <StatCard title="Blocked" value={stats.blocked} icon={AlertTriangle} description="Needs attention" />
        <StatCard title="With Evidence" value={stats.withEvidence} icon={ImageIcon} description="Has image proof" />
      </div>

      {/* ── Search & filter toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by staff, task, department, or notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(v => !v)}
          className="shrink-0"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" onClick={clearFilters} className="shrink-0 text-muted-foreground">
            <X className="w-4 h-4 mr-1.5" /> Clear
          </Button>
        )}
      </div>

      {/* ── Expanded filters panel ── */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Staff */}
              <div className="space-y-1.5">
                <Label className="text-xs">Staff Member</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Staff" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Staff</SelectItem>
                    {staffNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Departments</SelectItem>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Task status */}
              <div className="space-y-1.5">
                <Label className="text-xs">Task Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    {['All', 'Not Started', 'In Progress', 'Completed', 'Pending Review', 'Blocked', 'Carried Forward'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Review status */}
              <div className="space-y-1.5">
                <Label className="text-xs">Review Status</Label>
                <Select value={reviewFilter} onValueChange={setReviewFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Review States" /></SelectTrigger>
                  <SelectContent>
                    {['All', 'Pending Review', 'Approved', 'Needs Correction', 'Rejected'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Evidence */}
              <div className="space-y-1.5">
                <Label className="text-xs">Evidence Image</Label>
                <Select value={evidenceFilter} onValueChange={setEvidenceFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Yes">Has evidence</SelectItem>
                    <SelectItem value="No">No evidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date from */}
              <div className="space-y-1.5">
                <Label className="text-xs">Date From</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
              </div>

              {/* Date to */}
              <div className="space-y-1.5">
                <Label className="text-xs">Date To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {reports.length} reports
      </p>

      {/* ── Reports table ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No reports found"
          description={activeFilterCount > 0 || search ? 'Try adjusting your filters or search query.' : 'No workflow reports have been submitted yet.'}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Task</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead className="hidden md:table-cell">Hours</TableHead>
                  <TableHead className="hidden xl:table-cell">Mode</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow
                    key={r.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setViewDialog(r)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div>
                        <p className="text-sm font-medium">{r.staff_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{r.department || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.report_date ? format(parseISO(r.report_date), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[180px]">
                      <p className="text-sm truncate text-muted-foreground">{r.assigned_task || r.work_done || '—'}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={r.priority || 'Medium'} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={r.status || 'In Progress'} />
                        {r.evidence_url && (
                          <ImageIcon className="w-3.5 h-3.5 text-primary/50 shrink-0" title="Has evidence image" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.review_status || 'Pending Review'} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {r.hours_worked ? `${r.hours_worked}h` : '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                      {r.work_mode_for_day || '—'}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          title="View report"
                          onClick={() => setViewDialog(r)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Export report">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSingleExport(r, 'pdf')}>Export as PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSingleExport(r, 'docx')}>Export as DOCX</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          title="Review report"
                          onClick={() => { setReviewDialog(r); setReviewComment(r.supervisor_comment || ''); }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Button>
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
                  {[viewDialog?.department, viewDialog?.report_date ? format(parseISO(viewDialog.report_date), 'MMMM d, yyyy') : ''].filter(Boolean).join(' • ')}
                </p>
              </div>
              {viewDialog && (
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
              {/* Meta */}
              <div className="flex flex-wrap gap-2">
                <MetaChip icon={Clock} label={viewDialog.hours_worked ? `${viewDialog.hours_worked}h worked` : null} />
                <MetaChip label={viewDialog.work_mode_for_day} />
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

              {viewDialog.assigned_task && (
                <ReportSection title="Task Assigned">
                  <p className="font-medium">{viewDialog.assigned_task}</p>
                  {viewDialog.task_description && <p className="text-muted-foreground mt-1">{viewDialog.task_description}</p>}
                </ReportSection>
              )}

              <ReportSection title="Work Done">
                <p className="whitespace-pre-wrap">{viewDialog.work_done || '—'}</p>
              </ReportSection>

              {viewDialog.blockers && (
                <ReportSection title="Blockers / Challenges">
                  <p className="whitespace-pre-wrap text-amber-500 dark:text-amber-400">{viewDialog.blockers}</p>
                </ReportSection>
              )}

              {viewDialog.next_action && (
                <ReportSection title="Plan for Tomorrow">
                  <p className="whitespace-pre-wrap">{viewDialog.next_action}</p>
                </ReportSection>
              )}

              {viewDialog.proof_link && (
                <ReportSection title="Proof Link">
                  <a href={viewDialog.proof_link} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline break-all">
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
                    <img src={viewDialog.evidence_url} alt="Report evidence" className="w-full max-h-80 object-contain" />
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

              {/* Review action */}
              <div className="flex justify-end pt-1 border-t border-border">
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setReviewDialog(viewDialog); setReviewComment(viewDialog.supervisor_comment || ''); }}
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  {viewDialog.supervisor_name ? 'Update Review' : 'Add Review'}
                </Button>
              </div>
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
              <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{reviewDialog.staff_name}</p>
                  <p className="text-xs text-muted-foreground">{reviewDialog.report_date}</p>
                </div>
                <p className="text-xs text-muted-foreground">{reviewDialog.department}</p>
                <p className="text-sm line-clamp-3 mt-1">{reviewDialog.work_done}</p>
                {reviewDialog.blockers && (
                  <p className="text-xs text-amber-500 mt-1">⚠ Blockers: {reviewDialog.blockers}</p>
                )}
                <div className="flex gap-1.5 pt-1">
                  <StatusBadge status={reviewDialog.status} />
                  <StatusBadge status={reviewDialog.priority} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Your Comment (optional)</Label>
                <Textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="Add feedback for the staff member..."
                />
              </div>

              <div className="flex gap-2 justify-end flex-wrap">
                <Button
                  variant="outline"
                  disabled={reviewReport.isPending}
                  onClick={() => reviewReport.mutate({ reportId: reviewDialog.id, reviewStatus: 'Needs Correction', comment: reviewComment })}
                >
                  Needs Correction
                </Button>
                <Button
                  variant="destructive"
                  disabled={reviewReport.isPending}
                  onClick={() => reviewReport.mutate({ reportId: reviewDialog.id, reviewStatus: 'Rejected', comment: reviewComment })}
                >
                  Reject
                </Button>
                <Button
                  disabled={reviewReport.isPending}
                  onClick={() => reviewReport.mutate({ reportId: reviewDialog.id, reviewStatus: 'Approved', comment: reviewComment })}
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
