import React, { useState, useEffect, useMemo, useRef } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import useAuditLog from '@/lib/useAuditLog';
import useRoleAccess from '@/lib/useRoleAccess';
import supabase from '@/lib/supabase';

const DEPARTMENTS = ['Engineering', 'Finance', 'Operations', 'HR', 'IT', 'Marketing', 'Sales', 'Customer Support', 'Legal', 'Product', 'Executive'];
const CONFIRMATION_STATUSES = ['Pending', 'Confirmed', 'Extended', 'Not Applicable'];
const EMPLOYMENT_STATUSES = ['Active', 'Suspended', 'Resigned', 'Terminated', 'On Leave'];

const REQUEST_TIMEOUT_MS = 15000;
const SAVE_TOAST_ID = 'staff-form-save';
const RESERVED_SUPER_ADMIN_STAFF_ID = 'RP-0001';
const FALLBACK_FIRST_NON_SUPER_ADMIN_ID = 'RP-0002';

const withTimeout = (promise, timeoutMs) => (
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
    })
  ])
);

const stableStringify = (value) => {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value !== 'object') return JSON.stringify(value);
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

const pickFormFields = (record, keys) => (
  Object.fromEntries(keys.map((key) => [key, record?.[key]]))
);

const normalizeForDb = (record) => {
  const out = { ...(record || {}) };
  Object.keys(out).forEach((key) => {
    if (out[key] === '') out[key] = null;
  });
  return out;
};

const emptyForm = {
  full_name: '', email: '', phone: '', staff_id: '', department: '', role: '',
  system_role: '', employment_type: '', work_mode: '', address: '', emergency_contact_name: '',
  emergency_contact_phone: '', next_of_kin_name: '', next_of_kin_phone: '',
  next_of_kin_relationship: '', date_of_birth: '', date_joined: '',
  first_employment_date: '', confirmation_status: 'Pending', confirmation_date: '',
  probation_start_date: '', probation_end_date: '', employment_status: 'Active',
  manager_name: '', staff_bio: '', skills: [], responsibilities: '', hr_notes: ''
};

export default function StaffForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const { role: currentUserRole, isSuperAdmin, hasPermission } = useRoleAccess();
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  const formKeys = useMemo(() => Object.keys(emptyForm), []);

  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [cvFile, setCvFile] = useState(null);

  const isSavingRef = useRef(false);
  const lastSubmitAtRef = useRef(0);
  const cvFileRef = useRef(null);

  useEffect(() => {
    cvFileRef.current = cvFile;
  }, [cvFile]);

  const { data: existingStaff, isLoading } = useQuery({
    queryKey: ['staff-profile', editId],
    queryFn: () => entities.StaffProfile.filter({ id: editId }),
    enabled: !!editId,
  });

  const { data: userRole } = useQuery({
    queryKey: ['user-role', existingStaff?.[0]?.email],
    queryFn: async () => {
      if (!existingStaff?.[0]?.email) return null;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .ilike('email', existingStaff[0].email)
        .maybeSingle();
      return data?.role || null;
    },
    enabled: !!editId && !!existingStaff?.[0]?.email,
  });

  const { data: nextStaffId, isFetching: isFetchingNextStaffId } = useQuery({
    queryKey: ['staff-profiles', 'next-staff-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_profiles')
        .select('staff_id')
        .not('staff_id', 'is', null)
        .like('staff_id', 'RP-%')
        .order('staff_id', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNum = 1;
      const last = data?.[0]?.staff_id;
      if (last?.startsWith('RP-')) {
        const lastNum = parseInt(last.split('-')[1]);
        if (!Number.isNaN(lastNum)) nextNum = lastNum + 1;
      }

      if (nextNum === 1) nextNum = 2;
      return `RP-${nextNum.toString().padStart(4, '0')}`;
    },
    enabled: !editId,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (existingStaff && existingStaff[0]) {
      const merged = {
        ...pickFormFields(existingStaff[0], formKeys),
        system_role: userRole || '',
      };
      setForm(merged);
      setOriginalForm(merged);
      setFieldErrors({});
      setSaveError('');
      setSaveMessage('');
    }
  }, [existingStaff, userRole, formKeys]);

  const formComparable = useMemo(() => stableStringify(normalizeForDb(pickFormFields(form, formKeys))), [form, formKeys]);
  const originalComparable = useMemo(() => stableStringify(normalizeForDb(pickFormFields(originalForm, formKeys))), [originalForm, formKeys]);
  const hasUnsavedChanges = editId ? formComparable !== originalComparable : formComparable !== stableStringify(normalizeForDb(pickFormFields(emptyForm, formKeys)));

  useEffect(() => {
    const shouldWarn = hasUnsavedChanges && !isSaving;
    const handler = (e) => {
      if (!shouldWarn) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges, isSaving]);

  const confirmLeaveIfDirty = () => {
    if (!hasUnsavedChanges || isSaving) return true;
    return window.confirm('You have unsaved changes. Leave without saving?');
  };

  const uploadCvForStaff = async (staffRecord) => {
    const file = cvFileRef.current;
    if (!file || !staffRecord?.staff_id) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${staffRecord.staff_id}/cv-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('staff-documents')
      .upload(fileName, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('staff-documents').getPublicUrl(fileName);
    const existingCvDocs = await entities.StaffDocument.filter({ staff_id: staffRecord.staff_id, document_type: 'CV' });
    const existing = existingCvDocs?.[0];

    if (existing?.id) {
      await entities.StaffDocument.update(existing.id, {
        staff_id: staffRecord.staff_id,
        staff_name: staffRecord.full_name,
        document_type: 'CV',
        document_name: file.name,
        document_url: publicUrl,
        status: 'Submitted',
      });
      await logAction({
        actionType: 'UPDATE',
        entityType: 'StaffDocument',
        entityId: existing.id,
        entityName: staffRecord.full_name,
        notes: 'CV updated via staff form',
      });
    } else {
      const created = await entities.StaffDocument.create({
        staff_id: staffRecord.staff_id,
        staff_name: staffRecord.full_name,
        document_type: 'CV',
        document_name: file.name,
        document_url: publicUrl,
        status: 'Submitted',
      });
      await logAction({
        actionType: 'CREATE',
        entityType: 'StaffDocument',
        entityId: created?.id,
        entityName: staffRecord.full_name,
        notes: 'CV uploaded via staff form',
      });
    }

    setCvFile(null);
    cvFileRef.current = null;
    return publicUrl;
  };

  const isMissingCreatedAt = (error) =>
    error?.message?.includes('user_roles.created_at') || error?.message?.includes('created_at');

  async function insertUserRole(record) {
    const { error } = await supabase.from('user_roles').insert(record);
    if (!error) return;

    if (isMissingCreatedAt(error)) {
      const { created_at: _createdAt, ...legacyRecord } = record;
      const fallback = await supabase.from('user_roles').insert(legacyRecord);
      if (!fallback.error) return;
      throw fallback.error;
    }

    throw error;
  }

  async function setSystemRoleForEmail(email, nextRole, userId) {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return;

    const { data: existing, error: fetchError } = await supabase
      .from('user_roles')
      .select('id, role, assigned_at, user_id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (nextRole === 'super_admin' && !isSuperAdmin) {
      throw new Error('Only Super Admins can assign the Super Admin role');
    }
    if (existing?.role === 'super_admin' && !isSuperAdmin) {
      throw new Error('Only Super Admins can change a Super Admin role');
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('user_roles')
        .update({
          user_id: userId || existing.user_id || null,
          email: normalizedEmail,
          role: nextRole,
          assigned_by: currentUserRole,
          assigned_at: existing.assigned_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) throw error;
      return;
    }

    await insertUserRole({
      user_id: userId || null,
      email: normalizedEmail,
      role: nextRole,
      assigned_by: currentUserRole,
      assigned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const mutation = useMutation({
    mutationFn: async (data) => {
      const { system_role: desiredSystemRole, ...staffProfileData } = data || {};
      const normalizedStaffProfileData = normalizeForDb(staffProfileData);

      if (editId) {
        const before = normalizeForDb(pickFormFields(originalForm, formKeys));
        const after = normalizeForDb(pickFormFields({ ...originalForm, ...normalizedStaffProfileData, system_role: desiredSystemRole }, formKeys));
        const changes = {};
        formKeys.forEach((k) => {
          if (before[k] !== after[k]) changes[k] = { from: before[k], to: after[k] };
        });

        const updated = await withTimeout(
          entities.StaffProfile.update(editId, normalizedStaffProfileData),
          REQUEST_TIMEOUT_MS
        );

        await withTimeout(uploadCvForStaff(updated), REQUEST_TIMEOUT_MS);
        
        // Update system role if changed and user has permission
        if (hasPermission('canManageRoles') && desiredSystemRole && normalizedStaffProfileData.email) {
          await withTimeout(
            setSystemRoleForEmail(normalizedStaffProfileData.email, desiredSystemRole, normalizedStaffProfileData.user_id),
            REQUEST_TIMEOUT_MS
          );
        }
        
        await logAction({
          actionType: 'UPDATE', entityType: 'StaffProfile',
          entityId: editId, entityName: normalizedStaffProfileData.full_name,
          notes: 'Staff profile updated',
          changes,
        });
        return updated;
      } else {
        // Auto-generate Staff ID for new profiles
        const finalData = {
          ...normalizedStaffProfileData,
          staff_id: nextStaffId || FALLBACK_FIRST_NON_SUPER_ADMIN_ID
        };
        const result = await withTimeout(
          entities.StaffProfile.create(finalData),
          REQUEST_TIMEOUT_MS
        );

        await withTimeout(uploadCvForStaff(result), REQUEST_TIMEOUT_MS);
        
        // Assign system role if provided and user has permission
        if (hasPermission('canManageRoles') && desiredSystemRole && finalData.email) {
          await withTimeout(
            setSystemRoleForEmail(finalData.email, desiredSystemRole, finalData.user_id),
            REQUEST_TIMEOUT_MS
          );
        }
        
        await logAction({
          actionType: 'CREATE', entityType: 'StaffProfile',
          entityId: result?.id, entityName: finalData.full_name,
          notes: `New staff profile created with ID: ${finalData.staff_id}`
        });
        return result;
      }
    },
    onSuccess: (updatedRecord) => {
      toast.success(editId ? 'Staff profile updated' : 'Staff profile created', { id: SAVE_TOAST_ID });
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['staff-profiles', 'latest'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles-list'] });
      setSaveError('');
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 2500);

      if (editId && updatedRecord) {
        queryClient.setQueryData(['staff-profile', editId], [updatedRecord]);
        queryClient.setQueryData(['staff-profiles'], (current) => {
          const list = Array.isArray(current) ? current : [];
          return list.map(s => (s.id === updatedRecord.id ? { ...s, ...updatedRecord } : s));
        });
        queryClient.setQueryData(['staff-profiles-access'], (current) => {
          const list = Array.isArray(current) ? current : [];
          return list.map(s => (s.id === updatedRecord.id ? { ...s, ...updatedRecord } : s));
        });

        setForm(prev => ({ ...prev, ...updatedRecord }));
        setOriginalForm({ ...pickFormFields(updatedRecord, formKeys), system_role: form.system_role || '' });
        queryClient.invalidateQueries({ queryKey: ['staff-profile', editId] });
        if (updatedRecord.email) {
          queryClient.invalidateQueries({ queryKey: ['user-role', updatedRecord.email] });
        }
        return;
      }

      navigate('/staff');
    },
    onSettled: () => {
      setIsSaving(false);
      isSavingRef.current = false;
    },
    onError: (error) => {
      setSaveMessage('');
      setSaveError(error?.message || 'Failed to save staff profile');
      toast.error(error?.message || 'Failed to save staff profile', { id: SAVE_TOAST_ID });
    }
  });

  const validateAndSave = () => {
    if (isSavingRef.current) return;
    const now = Date.now();
    if (now - lastSubmitAtRef.current < 800) return;
    lastSubmitAtRef.current = now;

    const nextErrors = {};
    if (!form.full_name) nextErrors.full_name = 'Full name is required';
    if (!form.email) nextErrors.email = 'Email is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email address';
    if (!form.phone) nextErrors.phone = 'Phone number is required';
    if (!form.date_of_birth) nextErrors.date_of_birth = 'Date of birth is required';
    if (!form.department) nextErrors.department = 'Department is required';
    if (!form.role) nextErrors.role = 'Role/Position is required';
    if (!form.first_employment_date) nextErrors.first_employment_date = 'Date of employment is required';
    if (!form.confirmation_status) nextErrors.confirmation_status = 'Confirmation status is required';
    if (form.confirmation_status === 'Confirmed' && !form.confirmation_date) nextErrors.confirmation_date = 'Confirmation date is required';
    if (!form.employment_status) nextErrors.employment_status = 'Employment status is required';
    if (!editId && !cvFileRef.current) nextErrors.cv = 'CV is required';

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSaveMessage('');
      setSaveError('Please fix the highlighted fields');
      toast.error('Please fix the highlighted fields', { id: SAVE_TOAST_ID });
      const order = ['full_name', 'email', 'phone', 'date_of_birth', 'department', 'role', 'first_employment_date', 'confirmation_status', 'confirmation_date', 'employment_status', 'cv'];
      const first = order.find(k => nextErrors[k]);
      if (first) {
        requestAnimationFrame(() => {
          const el = document.getElementById(`field-${first}`);
          if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (el?.focus) el.focus();
        });
      }
      return;
    }

    if (editId && !hasUnsavedChanges) return;

    setSaveError('');
    setIsSaving(true);
    isSavingRef.current = true;
    mutation.reset();
    toast.loading('Saving...', { id: SAVE_TOAST_ID });
    mutation.mutate(form);
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setSaveError('');
    setSaveMessage('');
  };

  if (isLoading && editId) return <PageLoader />;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <Button
        variant="ghost"
        onClick={() => {
          if (!confirmLeaveIfDirty()) return;
          navigate(-1);
        }}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <form onSubmit={(e) => { e.preventDefault(); validateAndSave(); }} noValidate>
        <Tabs defaultValue="basic" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-2 px-2 md:mx-0 md:px-0">
            <TabsList className="bg-muted p-1 rounded-lg inline-flex w-max md:w-full">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="dates">Dates</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="basic">
            <Card>
              <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="field-full_name">Full Name *</Label>
                  <Input
                    id="field-full_name"
                    value={form.full_name || ''}
                    onChange={e => updateField('full_name', e.target.value)}
                    aria-invalid={!!fieldErrors.full_name}
                    className={fieldErrors.full_name ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    required
                  />
                  {fieldErrors.full_name && <p className="text-xs text-destructive">{fieldErrors.full_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Staff ID (Auto-generated)</Label>
                  <Input 
                    value={editId ? (form.staff_id || '') : (isFetchingNextStaffId ? 'Generating...' : (nextStaffId || 'Generating...'))} 
                    disabled 
                    className="bg-muted font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-email">Email *</Label>
                  <Input
                    id="field-email"
                    type="email"
                    value={form.email || ''}
                    onChange={e => updateField('email', e.target.value)}
                    aria-invalid={!!fieldErrors.email}
                    className={fieldErrors.email ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    required
                  />
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-phone">Phone Number *</Label>
                  <Input
                    id="field-phone"
                    value={form.phone || ''}
                    onChange={e => updateField('phone', e.target.value)}
                    aria-invalid={!!fieldErrors.phone}
                    className={fieldErrors.phone ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    required
                  />
                  {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="field-cv">CV *</Label>
                  <Input
                    id="field-cv"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    aria-invalid={!!fieldErrors.cv}
                    className={fieldErrors.cv ? 'border-destructive focus-visible:ring-destructive' : undefined}
                  />
                  {fieldErrors.cv && <p className="text-xs text-destructive">{fieldErrors.cv}</p>}
                  {editId && cvFile && <p className="text-xs text-muted-foreground">New CV selected: {cvFile.name}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employment">
            <Card>
              <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="field-department">Department *</Label>
                  <Select value={form.department || ''} onValueChange={v => updateField('department', v)}>
                    <SelectTrigger
                      id="field-department"
                      aria-invalid={!!fieldErrors.department}
                      className={fieldErrors.department ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    >
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                  {fieldErrors.department && <p className="text-xs text-destructive">{fieldErrors.department}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-role">Role/Position *</Label>
                  <Input
                    id="field-role"
                    value={form.role || ''}
                    onChange={e => updateField('role', e.target.value)}
                    aria-invalid={!!fieldErrors.role}
                    className={fieldErrors.role ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    required
                  />
                  {fieldErrors.role && <p className="text-xs text-destructive">{fieldErrors.role}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-employment_status">Employment Status *</Label>
                  <Select value={form.employment_status || ''} onValueChange={v => updateField('employment_status', v)}>
                    <SelectTrigger
                      id="field-employment_status"
                      aria-invalid={!!fieldErrors.employment_status}
                      className={fieldErrors.employment_status ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    >
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>{EMPLOYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  {fieldErrors.employment_status && <p className="text-xs text-destructive">{fieldErrors.employment_status}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-confirmation_status">Confirmation Status *</Label>
                  <Select value={form.confirmation_status || ''} onValueChange={v => updateField('confirmation_status', v)}>
                    <SelectTrigger
                      id="field-confirmation_status"
                      aria-invalid={!!fieldErrors.confirmation_status}
                      className={fieldErrors.confirmation_status ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    >
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>{CONFIRMATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  {fieldErrors.confirmation_status && <p className="text-xs text-destructive">{fieldErrors.confirmation_status}</p>}
                </div>
                {hasPermission('canManageRoles') && (
                  <div className="space-y-2">
                    <Label>System Role</Label>
                    <Select value={form.system_role} onValueChange={v => updateField('system_role', v)}>
                      <SelectTrigger><SelectValue placeholder="Assign a role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Staff (Default)</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="hr_admin">HR Admin</SelectItem>
                        <SelectItem value="finance_admin">Finance Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dates">
            <Card>
              <CardHeader><CardTitle>Important Dates</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="field-date_of_birth">Date of Birth *</Label>
                  <Input
                    id="field-date_of_birth"
                    type="date"
                    value={form.date_of_birth || ''}
                    onChange={e => updateField('date_of_birth', e.target.value)}
                    aria-invalid={!!fieldErrors.date_of_birth}
                    className={fieldErrors.date_of_birth ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    required
                  />
                  {fieldErrors.date_of_birth && <p className="text-xs text-destructive">{fieldErrors.date_of_birth}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-first_employment_date">Date of Employment *</Label>
                  <Input
                    id="field-first_employment_date"
                    type="date"
                    value={form.first_employment_date || ''}
                    onChange={e => updateField('first_employment_date', e.target.value)}
                    aria-invalid={!!fieldErrors.first_employment_date}
                    className={fieldErrors.first_employment_date ? 'border-destructive focus-visible:ring-destructive' : undefined}
                    required
                  />
                  {fieldErrors.first_employment_date && <p className="text-xs text-destructive">{fieldErrors.first_employment_date}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field-confirmation_date">Confirmation Date</Label>
                  <Input
                    id="field-confirmation_date"
                    type="date"
                    value={form.confirmation_date || ''}
                    onChange={e => updateField('confirmation_date', e.target.value)}
                    aria-invalid={!!fieldErrors.confirmation_date}
                    className={fieldErrors.confirmation_date ? 'border-destructive focus-visible:ring-destructive' : undefined}
                  />
                  {fieldErrors.confirmation_date && <p className="text-xs text-destructive">{fieldErrors.confirmation_date}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div
          className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-auto border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          role="region"
          aria-label="Profile actions"
        >
          <div className="max-w-4xl mx-auto px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6">
            {(saveError || saveMessage) && (
              <div className="mb-2">
                {saveError && <p className="text-sm font-medium text-destructive">{saveError}</p>}
                {!saveError && saveMessage && <p className="text-sm font-medium text-primary">{saveMessage}</p>}
              </div>
            )}
            {editId && !saveError && !saveMessage && (
              <div className="mb-2">
                <p className="text-sm font-medium text-muted-foreground">{hasUnsavedChanges ? 'Unsaved changes' : 'No changes to save'}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!confirmLeaveIfDirty()) return;
                  navigate(-1);
                }}
                disabled={isSaving}
                aria-label="Cancel and go back"
              >
                Cancel
              </Button>
              {!!saveError && !isSaving && (
                <Button type="button" variant="outline" onClick={validateAndSave} aria-label="Retry saving">
                  Retry
                </Button>
              )}
              <Button
                type="button"
                onClick={validateAndSave}
                disabled={isSaving || (editId && !hasUnsavedChanges)}
                className="gradient-primary text-primary-foreground w-full sm:w-auto pointer-events-auto"
                aria-label={editId ? 'Update profile' : 'Create profile'}
              >
                <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Saving...' : (editId ? 'Update Profile' : 'Create Profile')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
