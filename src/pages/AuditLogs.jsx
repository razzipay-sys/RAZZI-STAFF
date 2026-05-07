import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Search, Shield, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import useRoleAccess from '@/lib/useRoleAccess';

export default function AuditLogs() {
  const { hasPermission } = useRoleAccess();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => entities.AuditLog.list('-created_date', 200),
    enabled: hasPermission('canViewAuditLogs'),
  });

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

  if (!hasPermission('canViewAuditLogs')) {
    return <EmptyState icon={Shield} title="Access Restricted" description="You don't have permission to view audit logs." />;
  }

  if (isLoading) return <PageLoader />;

  const actionStyles = {
    'CREATE': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'UPDATE': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'DELETE': 'bg-red-500/10 text-red-500 border-red-500/20',
    'VIEW': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    'EXPORT': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            {['All', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT'].map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                      {log.created_date ? format(parseISO(log.created_date), 'MMM d, HH:mm') : 'N/A'}
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