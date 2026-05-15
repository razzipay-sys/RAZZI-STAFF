import React from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { Cake, UserCheck, CalendarDays, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';

export default function HRCalendar() {
  const { data: staffList = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 5000),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  if (showLoader) return <PageLoader />;

  const now = new Date();
  const activeStaff = staffList.filter(s => s.employment_status === 'Active');

  const upcomingBirthdays = activeStaff.filter(s => {
    if (!s.date_of_birth) return false;
    const bday = parseISO(s.date_of_birth);
    const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    return isAfter(thisYear, addDays(now, -1)) && isBefore(thisYear, addDays(now, 60));
  }).sort((a, b) => {
    const aD = parseISO(a.date_of_birth);
    const bD = parseISO(b.date_of_birth);
    const aThis = new Date(now.getFullYear(), aD.getMonth(), aD.getDate());
    const bThis = new Date(now.getFullYear(), bD.getMonth(), bD.getDate());
    return aThis - bThis;
  });

  const dueForConfirmation = activeStaff.filter(s => {
    if (s.confirmation_status !== 'Pending') return false;
    if (!s.probation_end_date) return false;
    return isBefore(parseISO(s.probation_end_date), addDays(now, 90));
  });

  const workAnniversaries = activeStaff.filter(s => {
    if (!s.date_joined) return false;
    const joined = parseISO(s.date_joined);
    const anniversary = new Date(now.getFullYear(), joined.getMonth(), joined.getDate());
    return isAfter(anniversary, addDays(now, -1)) && isBefore(anniversary, addDays(now, 60));
  });

  const incompleteProfiles = activeStaff.filter(s => {
    const fields = [s.phone, s.department, s.role, s.date_of_birth, s.date_joined, s.address, s.emergency_contact_name];
    return fields.filter(Boolean).length < 5;
  });

  const sections = [
    {
      title: 'Upcoming Birthdays',
      icon: Cake,
      items: upcomingBirthdays,
      render: (s) => ({
        name: s.full_name,
        sub: s.department,
        detail: s.date_of_birth ? format(parseISO(s.date_of_birth), 'MMM d') : 'N/A'
      })
    },
    {
      title: 'Confirmation Due',
      icon: UserCheck,
      items: dueForConfirmation,
      render: (s) => ({
        name: s.full_name,
        sub: s.department,
        detail: s.probation_end_date ? format(parseISO(s.probation_end_date), 'MMM d, yyyy') : 'N/A'
      })
    },
    {
      title: 'Work Anniversaries',
      icon: CalendarDays,
      items: workAnniversaries,
      render: (s) => ({
        name: s.full_name,
        sub: s.department,
        detail: s.date_joined ? format(parseISO(s.date_joined), 'MMM d, yyyy') : 'N/A'
      })
    },
    {
      title: 'Incomplete Profiles',
      icon: Clock,
      items: incompleteProfiles,
      render: (s) => ({
        name: s.full_name,
        sub: `${s.department || 'No dept'} • ${s.role || 'No role'}`,
        detail: ''
      })
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {(isError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading HR calendar' : 'HR calendar unavailable'}
          description={error?.message || 'Showing empty calendar sections for now.'}
          onRetry={refetch}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map(section => (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <section.icon className="w-5 h-5 text-primary" />
                {section.title}
                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{section.items.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {section.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nothing to show</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {section.items.map(item => {
                    const { name, sub, detail } = section.render(item);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                        <div>
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                        {detail && <p className="text-xs text-muted-foreground font-medium">{detail}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
