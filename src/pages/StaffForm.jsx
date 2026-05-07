import React, { useState, useEffect } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import useAuditLog from '@/lib/useAuditLog';
import useRoleAccess from '@/lib/useRoleAccess';

const DEPARTMENTS = ['Engineering', 'Finance', 'Operations', 'HR', 'Marketing', 'Sales', 'Customer Support', 'Legal', 'Product', 'Executive'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern', 'Probation'];
const WORK_MODES = ['On-site', 'Remote', 'Hybrid'];
const CONFIRMATION_STATUSES = ['Pending', 'Confirmed', 'Extended', 'Not Applicable'];
const EMPLOYMENT_STATUSES = ['Active', 'Suspended', 'Resigned', 'Terminated', 'On Leave'];

const emptyForm = {
  full_name: '', email: '', phone: '', staff_id: '', department: '', role: '',
  employment_type: '', work_mode: '', address: '', emergency_contact_name: '',
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
  const { isAdmin } = useRoleAccess();
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');

  const [form, setForm] = useState(emptyForm);
  const [skillInput, setSkillInput] = useState('');

  const { data: existingStaff, isLoading } = useQuery({
    queryKey: ['staff-profile', editId],
    queryFn: () => entities.StaffProfile.filter({ id: editId }),
    enabled: !!editId,
  });

  useEffect(() => {
    if (existingStaff && existingStaff[0]) {
      setForm(existingStaff[0]);
    }
  }, [existingStaff]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (editId) {
        await entities.StaffProfile.update(editId, data);
        await logAction({
          actionType: 'UPDATE', entityType: 'StaffProfile',
          entityId: editId, entityName: data.full_name,
          notes: 'Staff profile updated'
        });
      } else {
        const result = await entities.StaffProfile.create(data);
        await logAction({
          actionType: 'CREATE', entityType: 'StaffProfile',
          entityId: result?.id, entityName: data.full_name,
          notes: 'New staff profile created'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
      toast.success(editId ? 'Staff profile updated' : 'Staff profile created');
      navigate('/staff');
    },
    onError: (error) => {
      toast.error('Failed to save staff profile');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.department || !form.role || !form.employment_status) {
      toast.error('Please fill in all required fields');
      return;
    }
    mutation.mutate(form);
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      setForm(prev => ({ ...prev, skills: [...(prev.skills || []), skillInput.trim()] }));
      setSkillInput('');
    }
  };

  const removeSkill = (index) => {
    setForm(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  };

  if (isLoading && editId) return <PageLoader />;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-lg">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="company">Company Profile</TabsTrigger>
            <TabsTrigger value="emergency">Emergency</TabsTrigger>
            <TabsTrigger value="dates">Important Dates</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card>
              <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={e => updateField('full_name', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Staff ID</Label>
                  <Input value={form.staff_id} onChange={e => updateField('staff_id', e.target.value)} placeholder="e.g. RP-001" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => updateField('phone', e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Residential Address</Label>
                  <Textarea value={form.address} onChange={e => updateField('address', e.target.value)} rows={2} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employment">
            <Card>
              <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department *</Label>
                  <Select value={form.department} onValueChange={v => updateField('department', v)}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role/Position *</Label>
                  <Input value={form.role} onChange={e => updateField('role', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Employment Type</Label>
                  <Select value={form.employment_type} onValueChange={v => updateField('employment_type', v)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Mode</Label>
                  <Select value={form.work_mode} onValueChange={v => updateField('work_mode', v)}>
                    <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                    <SelectContent>{WORK_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Employment Status *</Label>
                  <Select value={form.employment_status} onValueChange={v => updateField('employment_status', v)}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>{EMPLOYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Confirmation Status</Label>
                  <Select value={form.confirmation_status} onValueChange={v => updateField('confirmation_status', v)}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>{CONFIRMATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reporting Manager</Label>
                  <Input value={form.manager_name} onChange={e => updateField('manager_name', e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader><CardTitle>Company Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Staff Bio/Summary</Label>
                  <Textarea value={form.staff_bio} onChange={e => updateField('staff_bio', e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Skills & Competencies</Label>
                  <div className="flex gap-2">
                    <Input value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="Add a skill" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); }}} />
                    <Button type="button" variant="outline" onClick={addSkill}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(form.skills || []).map((skill, i) => (
                      <span key={i} className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => removeSkill(i)}>
                        {skill} ×
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Job Responsibilities</Label>
                  <Textarea value={form.responsibilities} onChange={e => updateField('responsibilities', e.target.value)} rows={4} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emergency">
            <Card>
              <CardHeader><CardTitle>Emergency Contacts & Next of Kin</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Emergency Contact Name</Label>
                  <Input value={form.emergency_contact_name} onChange={e => updateField('emergency_contact_name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Phone</Label>
                  <Input value={form.emergency_contact_phone} onChange={e => updateField('emergency_contact_phone', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Next of Kin Name</Label>
                  <Input value={form.next_of_kin_name} onChange={e => updateField('next_of_kin_name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Next of Kin Phone</Label>
                  <Input value={form.next_of_kin_phone} onChange={e => updateField('next_of_kin_phone', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Input value={form.next_of_kin_relationship} onChange={e => updateField('next_of_kin_relationship', e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dates">
            <Card>
              <CardHeader><CardTitle>Important Dates</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date Joined</Label>
                  <Input type="date" value={form.date_joined} onChange={e => updateField('date_joined', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>First Employment Date</Label>
                  <Input type="date" value={form.first_employment_date} onChange={e => updateField('first_employment_date', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Confirmation Date</Label>
                  <Input type="date" value={form.confirmation_date} onChange={e => updateField('confirmation_date', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Probation Start Date</Label>
                  <Input type="date" value={form.probation_start_date} onChange={e => updateField('probation_start_date', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Probation End Date</Label>
                  <Input type="date" value={form.probation_end_date} onChange={e => updateField('probation_end_date', e.target.value)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card>
              <CardHeader><CardTitle>HR Notes & Remarks</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={form.hr_notes} onChange={e => updateField('hr_notes', e.target.value)} rows={6} placeholder="Add management or HR notes here..." />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} className="gradient-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" /> {editId ? 'Update Profile' : 'Create Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}