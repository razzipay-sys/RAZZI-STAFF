import React, { useState } from 'react';
import { entities } from '@/lib/supabaseEntities';
import supabase from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, Edit, Mail, Phone, FileText, Eye, Download, Plus, IdCard
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';
import { toast } from 'sonner';
import useRoleAccess from '@/lib/useRoleAccess';
import useAuditLog from '@/lib/useAuditLog';
import { exportToCSV, exportToPDF, exportToDocx, exportIDCardToPDF } from '@/lib/exportUtils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission, isAdmin } = useRoleAccess();
  const { logAction } = useAuditLog();
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ document_type: 'CV', document_name: '', status: 'Pending' });

  const { data: staff, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff-profile', id],
    queryFn: async () => {
      const s = await entities.StaffProfile.filter({ id });
      return s[0] || null;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const { data: documents = [] } = useQuery({
    queryKey: ['staff-documents', staff?.id],
    queryFn: () => entities.StaffDocument.filter({ staff_profile_id: staff.id }),
    enabled: !!staff?.id,
  });

  const { data: bankDetails = [] } = useQuery({
    queryKey: ['staff-bank', staff?.id],
    queryFn: async () => {
      if (!staff?.id) return [];
      const { data, error } = await supabase
        .from('staff_bank_details')
        .select('*')
        .eq('staff_profile_id', staff.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: hasPermission('canViewSalary') && !!staff?.id,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['staff-reports', staff?.id],
    queryFn: () => entities.DailyWorkflowReport.filter({ staff_profile_id: staff.id }, '-report_date', 20),
    enabled: !!staff?.id,
  });

  const uploadDoc = useMutation({
    mutationFn: async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${staff.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('staff-documents')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('staff-documents').getPublicUrl(fileName);
      await entities.StaffDocument.create({
        staff_profile_id: staff.id,
        staff_name: staff.full_name,
        document_type: newDoc.document_type,
        document_name: newDoc.document_name || file.name,
        document_url: publicUrl,
        status: 'Submitted'
      });
      await logAction({
        actionType: 'CREATE', entityType: 'StaffDocument',
        entityId: staff.id, entityName: staff.full_name,
        notes: `Document uploaded: ${newDoc.document_type}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-documents', staff.id] });
      toast.success('Document uploaded');
      setDocDialogOpen(false);
      setNewDoc({ document_type: 'CV', document_name: '', status: 'Pending' });
    }
  });

  const updateDocStatus = useMutation({
    mutationFn: async ({ docId, status }) => {
      await entities.StaffDocument.update(docId, { status });
      await logAction({
        actionType: 'UPDATE', entityType: 'StaffDocument',
        entityId: docId, entityName: staff.full_name,
        notes: `Document status changed to ${status}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-documents', staff.id] });
      toast.success('Status updated');
    }
  });

  const profileData = [{
    Name: staff?.full_name,
    Email: staff?.email,
    Phone: staff?.phone,
    Department: staff?.department,
    Role: staff?.role,
    Joined: staff?.date_joined,
    Address: staff?.address,
    Emergency_Contact: staff?.emergency_contact_name,
    Emergency_Phone: staff?.emergency_contact_phone,
  }];

  const handleExportProfile = async (format) => {
    const safeName = (staff.full_name || 'Staff').replace(/\s+/g, '_');
    if (format === 'csv') {
      exportToCSV(profileData, `Staff_Profile_${safeName}`);
    } else if (format === 'docx') {
      await exportToDocx(profileData, {
        title: `Staff Profile: ${staff.full_name}`,
        filename: `Staff_Profile_${safeName}`,
        headers: ['Name', 'Email', 'Phone', 'Department', 'Role', 'Joined', 'Address'],
      });
    } else {
      exportToPDF(profileData, {
        title: `Staff Profile: ${staff.full_name}`,
        filename: `Staff_Profile_${safeName}`,
        headers: ['Name', 'Email', 'Phone', 'Department', 'Role', 'Joined'],
      });
    }

    await logAction({
      actionType: 'EXPORT',
      entityType: 'StaffProfile',
      entityId: id,
      entityName: staff.full_name,
      notes: `Exported staff profile as ${format.toUpperCase()}`
    });
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const handleGenerateIdCard = async () => {
    try {
      const safeName = (staff.full_name || 'Staff').replace(/\s+/g, '_');
      await exportIDCardToPDF(staff, { filename: `ID_Card_${safeName}` });
      await logAction({
        actionType: 'EXPORT',
        entityType: 'StaffProfile',
        entityId: id,
        entityName: staff.full_name,
        notes: 'Generated staff ID card',
      });
      toast.success('ID card generated');
    } catch (err) {
      toast.error(err?.message || 'Failed to generate ID card');
    }
  };

  if (showLoader) return <PageLoader />;
  if (isError || timedOut) {
    return (
      <DataState
        title={timedOut ? 'Still loading profile' : 'Staff profile unavailable'}
        description={error?.message || 'The profile did not load in time.'}
        onRetry={refetch}
      />
    );
  }
  if (!staff) return <EmptyState title="Staff not found" description="This profile does not exist." action={() => navigate('/staff')} actionLabel="Back to Directory" />;

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const formatDate = (d) => d ? format(parseISO(d), 'MMM d, yyyy') : 'N/A';
  const bank = bankDetails[0];

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value || 'N/A'}</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/staff')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
      </Button>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <Avatar className="h-20 w-20 ring-4 ring-primary/20">
              <AvatarImage src={staff.profile_photo_url} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {getInitials(staff.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h2 className="text-2xl font-bold">{staff.full_name}</h2>
                <StatusBadge status={staff.employment_status || 'Active'} />
              </div>
              <p className="text-muted-foreground">{staff.role} • {staff.department}</p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {staff.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {staff.email}</span>}
                {staff.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {staff.phone}</span>}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {hasPermission('canExport') && (
                <Button variant="outline" onClick={handleGenerateIdCard}>
                  <IdCard className="w-4 h-4 mr-2" /> ID Card
                </Button>
              )}
              {hasPermission('canExport') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExportProfile('csv')}>Export as CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportProfile('pdf')}>Export as PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportProfile('docx')}>Export as DOCX</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {(isAdmin || hasPermission('canEditStaff')) && (
                <Button variant="outline" onClick={() => navigate(`/staff/new?edit=${staff.id}`)}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-2 -mx-2 px-2 md:mx-0 md:px-0">
          <TabsList className="bg-muted p-1 inline-flex w-max md:w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            {hasPermission('canViewSalary') && <TabsTrigger value="salary">Bank & Salary</TabsTrigger>}
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Date of Birth" value={formatDate(staff.date_of_birth)} />
                <InfoRow label="Address" value={staff.address} />
                <InfoRow label="Emergency Contact" value={staff.emergency_contact_name ? `${staff.emergency_contact_name} (${staff.emergency_contact_phone || 'N/A'})` : 'N/A'} />
                <InfoRow label="Next of Kin" value={staff.next_of_kin_name ? `${staff.next_of_kin_name} (${staff.next_of_kin_relationship || ''})` : 'N/A'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Employment Details</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Employment Type" value={staff.employment_type} />
                <InfoRow label="Work Mode" value={staff.work_mode} />
                <InfoRow label="Manager" value={staff.manager_name} />
                <InfoRow label="Date Joined" value={formatDate(staff.date_joined)} />
                <InfoRow label="Confirmation Status" value={staff.confirmation_status} />
                <InfoRow label="Confirmation Date" value={formatDate(staff.confirmation_date)} />
                <InfoRow label="Probation End" value={formatDate(staff.probation_end_date)} />
              </CardContent>
            </Card>
            {staff.staff_bio && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">Bio & Skills</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{staff.staff_bio}</p>
                  {staff.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {staff.skills.map((s, i) => (
                        <span key={i} className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">{s}</span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {staff.hr_notes && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">HR Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{staff.hr_notes}</p></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Documents</CardTitle>
              {(isAdmin || hasPermission('canEditDocuments')) && (
                <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Upload</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Document Type</Label>
                        <Select value={newDoc.document_type} onValueChange={v => setNewDoc(p => ({ ...p, document_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['CV', 'ID Card', 'Offer Letter', 'Appointment Letter', 'Confirmation Letter', 'NDA', 'Contract', 'Certificate', 'Other'].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Document Name</Label>
                        <Input value={newDoc.document_name} onChange={e => setNewDoc(p => ({ ...p, document_name: e.target.value }))} placeholder="e.g. John Doe CV 2026" />
                      </div>
                      <div className="space-y-2">
                        <Label>File</Label>
                        <Input type="file" onChange={e => {
                          if (e.target.files[0]) uploadDoc.mutate(e.target.files[0]);
                        }} />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet</p>
              ) : (
                <div className="space-y-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{doc.document_name || doc.document_type}</p>
                          <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        {doc.document_url && (
                          <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button>
                          </a>
                        )}
                        {(isAdmin || hasPermission('canEditDocuments')) && (
                          <Select defaultValue={doc.status} onValueChange={v => updateDocStatus.mutate({ docId: doc.id, status: v })}>
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['Pending', 'Submitted', 'Reviewed', 'Requires Update', 'Approved', 'Rejected'].map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {hasPermission('canViewSalary') && (
          <TabsContent value="salary" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Bank & Salary Information</CardTitle></CardHeader>
              <CardContent>
                {!bank ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No bank details recorded</p>
                ) : (
                  <div>
                    <InfoRow label="Bank Name" value={bank.bank_name} />
                    <InfoRow label="Account Number" value={bank.account_number} />
                    <InfoRow label="Account Name" value={bank.account_name} />
                    <InfoRow label="Salary Amount" value={bank.salary_amount ? `${bank.salary_currency || 'NGN'} ${bank.salary_amount.toLocaleString()}` : 'N/A'} />
                    <InfoRow label="Payment Frequency" value={bank.payment_frequency} />
                    <InfoRow label="Payment Date" value={bank.salary_payment_date ? `${bank.salary_payment_date}th of each month` : 'N/A'} />
                    {bank.finance_notes && <InfoRow label="Notes" value={bank.finance_notes} />}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Workflow Reports</CardTitle></CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No reports submitted yet</p>
              ) : (
                <div className="space-y-3">
                  {reports.map(r => (
                    <div key={r.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{r.assigned_task || 'Daily Report'}</p>
                        <div className="flex gap-2">
                          <StatusBadge status={r.status || 'In Progress'} />
                          <StatusBadge status={r.review_status || 'Pending Review'} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(r.report_date)} • {r.hours_worked ? `${r.hours_worked}h` : ''}</p>
                      {r.work_done && <p className="text-sm mt-2 text-muted-foreground">{r.work_done}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
