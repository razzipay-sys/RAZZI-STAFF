import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { Users, FileText, Cake, ShieldAlert, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import { DashCard, DashListRow, EmptyNote } from './DashboardShared';
import { format, parseISO, isAfter, addDays } from 'date-fns';

export default function HRAdminDashboard() {
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 500),
  });

  const now = new Date();
  const next30Days = addDays(now, 30);
  
  const upcomingBirthdays = staffList.filter(s => {
    if (!s.date_of_birth) return false;
    const dob = parseISO(s.date_of_birth);
    const thisYearDob = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
    return isAfter(thisYearDob, now) && isAfter(next30Days, thisYearDob);
  });

  const missingCVs = staffList.filter(s => s.employment_status === 'Active' && !s.profile_photo_url); // Placeholder logic for missing docs

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">HR Console</h2>
          <p className="text-muted-foreground">Onboarding, records, and staff engagement.</p>
        </div>
        <Link to="/staff/new"><Button size="sm"><UserPlus className="w-4 h-4 mr-2" /> New Hire</Button></Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Staff" value={staffList.length} icon={Users} />
        <StatCard title="Upcoming Birthdays" value={upcomingBirthdays.length} icon={Cake} />
        <StatCard title="Missing Documents" value={missingCVs.length} icon={FileText} />
        <StatCard title="Probation Ends" value={staffList.filter(s => s.employment_type === 'Probation').length} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard title="Birthday Reminders" icon={Cake} to="/calendar">
          {upcomingBirthdays.length === 0 ? <EmptyNote text="No birthdays in next 30 days" /> : 
            upcomingBirthdays.map(s => <DashListRow key={s.id} name={s.full_name} sub={s.department} right={format(parseISO(s.date_of_birth), 'MMM d')} />)
          }
        </DashCard>

        <DashCard title="Onboarding Checklist" icon={ShieldAlert}>
          <DashListRow name="Incomplete Profiles" right={staffList.filter(s => (s.profile_completion_percentage || 0) < 100).length} />
          <DashListRow name="Missing CVs" right={missingCVs.length} />
        </DashCard>
      </div>
    </div>
  );
}
