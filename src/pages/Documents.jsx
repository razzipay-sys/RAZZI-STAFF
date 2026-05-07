import React, { useState, useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Eye, FileText, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import { format, parseISO } from 'date-fns';

const DOC_TYPES = ['All', 'CV', 'ID Card', 'Offer Letter', 'Appointment Letter', 'Confirmation Letter', 'NDA', 'Contract', 'Certificate', 'Other'];
const DOC_STATUSES = ['All', 'Pending', 'Submitted', 'Reviewed', 'Requires Update', 'Approved', 'Rejected'];

export default function Documents() {
  const queryClient = useQueryClient();
  const { hasPermission, isAdmin } = useRoleAccess();
  const { logAction } = useAuditLog();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['all-documents'],
    queryFn: () => entities.StaffDocument.list('-created_date', 200),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ docId, status, staffName }) => {
      await entities.StaffDocument.update(docId, { status });
      await logAction({
        actionType: 'UPDATE', entityType: 'StaffDocument',
        entityId: docId, entityName: staffName,
        notes: `Document status changed to ${status}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
      toast.success('Status updated');
    }
  });

  const filtered = useMemo(() => {
    return documents.filter(d => {
      const matchSearch = !search ||
        d.staff_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.document_name?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'All' || d.document_type === typeFilter;
      const matchStatus = statusFilter === 'All' || d.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [documents, search, typeFilter, statusFilter]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Document Type" /></SelectTrigger>
          <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{DOC_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} documents found</p>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No documents found" description="No documents match your current filters." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-sm">{doc.staff_name}</TableCell>
                    <TableCell className="text-sm">{doc.document_name || '-'}</TableCell>
                    <TableCell><StatusBadge status={doc.document_type} /></TableCell>
                    <TableCell><StatusBadge status={doc.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.created_date ? format(parseISO(doc.created_date), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {doc.document_url && (
                          <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button>
                          </a>
                        )}
                        {(isAdmin() || hasPermission('canEditDocuments')) && (
                          <Select defaultValue={doc.status} onValueChange={v => updateStatus.mutate({ docId: doc.id, status: v, staffName: doc.staff_name })}>
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['Pending', 'Submitted', 'Reviewed', 'Requires Update', 'Approved', 'Rejected'].map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
    </div>
  );
}