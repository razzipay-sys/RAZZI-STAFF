import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Search, Shield, Download, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import { exportToCSV, exportToPDF, exportToDocx } from '@/lib/exportUtils';
import { toast } from 'sonner';

const ACTION_TYPES = ['All', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'LOGIN', 'LOGOUT', 'ROLE_CHANGE', 'SETTINGS_UPDATE', 'AVATAR_UPDATE'];

const ACTION_CONFIG = {
  CREATE:          { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  UPDATE:          { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  DELETE:          { bg: 'bg-red-500/10 text-red-400 border-red-500/20' },
  VIEW:            { bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  EXPORT:          { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  LOGIN:           { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  LOGOUT:          { bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  ROLE_CHANGE:     { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  SETTINGS_UPDATE: { bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  AVATAR_UPDATE:   { bg: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
};

export default function AuditLogs() {
  const { hasPermission } = useRoleAccess();
  const { logAction } = useAuditLog();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const { data: logs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => entities.AuditLog.list('-created_at', 500),
    enabled: hasPermission('canViewAuditLogs'),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      const matchSearch = !q ||
        l.performed_by?.toLowerCase().includes(q) ||
        l.entity_name?.toLowerCase().includes(q) ||
        l.entity_type?.toLowerCase().includes(q) ||
        l.notes?.toLowerCase().includes(q);
      const matchAction = actionFilter === 'All' || l.action_type === actionFilter;
      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  const handleExport = async (fmt) => {
    const dataToExport = filtered.map(l => ({
      Timestamp: l.created_at ? format(parseISO(l.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
      Action: l.action_type,
      Entity: l.entity_type,
      Name: l.entity_name || '',
      PerformedBy: l.performed_by,
      Role: l.performed_by_role,
      Notes: l.notes || '',
    }));
    const headers = ['Timestamp', 'Action', 'Entity', 'Name', 'PerformedBy', 'Role', 'Notes'];

    try {
      if (fmt === 'csv') {
        exportToCSV(dataToExport, 'Audit_Logs');
      } else if (fmt === 'docx') {
        await exportToDocx(dataToExport, { title: 'System Audit Log Report', filename: 'Audit_Logs', headers });
      } else {
        await exportToPDF(dataToExport, { title: 'System Audit Log Report', filename: 'Audit_Logs', headers });
      }
      await logAction({ actionType: 'EXPORT', entityType: 'AuditLog', notes: `Exported ${filtered.length} audit logs as ${fmt.toUpperCase()}` });
      toast.success(`Exported as ${fmt.toUpperCase()}`);
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
  };

  if (!hasPermission('canViewAuditLogs')) {
    return <EmptyState icon={Shield} title="Access Restricted" description="You don't have permission to view audit logs." />;
  }

  if (showLoader) return <PageLoader message="Loading audit logs..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {(isError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading audit logs' : 'Audit logs unavailable'}
          description={error?.message || 'Showing an empty audit log for now.'}
          onRetry={refetch}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, entity, or notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(a => (
                <SelectItem key={a} value={a}>{a === 'All' ? 'All Actions' : a.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} found
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={Activity} title="No audit logs" description="No log entries match your current filters." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[130px]">Timestamp</TableHead>
                  <TableHead className="w-[140px]">Action</TableHead>
                  <TableHead className="hidden sm:table-cell">Entity</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Performed By</TableHead>
                  <TableHead className="hidden lg:table-cell">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(log => {
                  const cfg = ACTION_CONFIG[log.action_type];
                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {log.created_at ? format(parseISO(log.created_at), 'MMM d, HH:mm') : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${cfg?.bg || 'bg-muted text-muted-foreground border-border'}`}>
                          {log.action_type?.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{log.entity_type}</TableCell>
                      <TableCell className="text-sm font-medium max-w-[160px] truncate">{log.entity_name || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{log.performed_by}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{log.notes}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
