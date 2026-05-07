import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Search, Shield, Download } from 'lucide-react';
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
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';

export default function AuditLogs() {
  const { hasPermission } = useRoleAccess();
  const { logAction } = useAuditLog();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const { data: logs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => entities.AuditLog.list('-created_at', 200),
    enabled: hasPermission('canViewAuditLogs'),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = !search ||
        l.performed_by?.toLowerCase().includes(search.toLowerCase()) ||
        l.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.entity_type?.toLowerCase().includes(search.toLowerCase());
      const matchAction = actionFilter === 'All' || l.action_type === actionFilter;
      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  const handleExport = async (format) => {
    const dataToExport = filtered.map(l => ({
      Timestamp: l.created_at,
      Action: l.action_type,
      Entity: l.entity_type,
      Name: l.entity_name,
      PerformedBy: l.performed_by,
      Role: l.performed_by_role,
      Notes: l.notes
    }));

    if (format === 'csv') {
      exportToCSV(dataToExport, 'Audit_Logs');
    } else {
      exportToPDF(dataToExport, { 
        title: 'System Audit Logs Report', 
        filename: 'Audit_Logs',
        headers: ['Timestamp', 'Action', 'Entity', 'Name', 'PerformedBy', 'Role', 'Notes']
      });
    }

    await logAction({
      actionType: 'EXPORT',
      entityType: 'AuditLog',
      notes: `Exported ${filtered.length} audit logs as ${format.toUpperCase()}`
    });
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  if (!hasPermission('canViewAuditLogs')) {
    return <EmptyState icon={Shield} title="Access Restricted" description="You don't have permission to view audit logs." />;
  }

  if (showLoader) return <PageLoader />;

  const actionStyles = {
    'CREATE': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'UPDATE': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'DELETE': 'bg-red-500/10 text-red-500 border-red-500/20',
    'VIEW': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    'EXPORT': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'ROLE_CHANGE': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'SETTINGS_UPDATE': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    'AVATAR_UPDATE': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {(isError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading audit logs' : 'Audit logs unavailable'}
          description={error?.message || 'Showing an empty audit log for now.'}
          onRetry={refetch}
        />
      )}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              {['All', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'ROLE_CHANGE', 'SETTINGS_UPDATE', 'AVATAR_UPDATE'].map(a => (
                <SelectItem key={a} value={a}>{a.replace('_', ' ')}</SelectItem>
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
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} log entries</p>

      {filtered.length === 0 ? (
        <EmptyState icon={Shield} title="No audit logs" description="No log entries found." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden sm:table-cell">Entity</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Performed By</TableHead>
                  <TableHead className="hidden lg:table-cell">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.created_at ? format(parseISO(log.created_at), 'MMM d, HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${actionStyles[log.action_type] || ''}`}>
                        {log.action_type}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{log.entity_type}</TableCell>
                    <TableCell className="text-sm font-medium">{log.entity_name || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{log.performed_by}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{log.notes}</TableCell>
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
