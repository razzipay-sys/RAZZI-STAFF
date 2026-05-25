import React, { useMemo } from 'react';
import { entities } from '@/lib/supabaseEntities';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isAfter, isBefore, addDays, differenceInYears } from 'date-fns';
import { Cake, UserCheck, CalendarDays, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import DataState from '@/components/ui/DataState';
import useTimedLoading from '@/hooks/useTimedLoading';

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function daysUntil(dateStr, now) {
  const d = parseISO(dateStr);
  const target = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (target < now) target.setFullYear(now.getFullYear() + 1);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function SectionCard({ title, icon: Icon, items, renderItem, emptyText, color = 'text-primary' }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3 pt-5 px-5">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${color}`} />
            {title}
          </span>
          <span className="text-xs font-normal bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
              <Icon className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {items.map(item => renderItem(item))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HRCalendar() {
  const { data: staffList = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: () => entities.StaffProfile.list('-created_at', 5000),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { showLoader, timedOut } = useTimedLoading(isLoading);

  const now = useMemo(() => new Date(), []);

  const { upcomingBirthdays, dueForConfirmation, workAnniversaries, incompleteProfiles } = useMemo(() => {
    const active = staffList.filter(s => s.employment_status === 'Active');

    const upcomingBirthdays = active
      .filter(s => {
        if (!s.date_of_birth) return false;
        const d = parseISO(s.date_of_birth);
        const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        return isAfter(thisYear, addDays(now, -1)) && isBefore(thisYear, addDays(now, 61));
      })
      .sort((a, b) => {
        const aD = parseISO(a.date_of_birth);
        const bD = parseISO(b.date_of_birth);
        return new Date(now.getFullYear(), aD.getMonth(), aD.getDate()) -
               new Date(now.getFullYear(), bD.getMonth(), bD.getDate());
      });

    const dueForConfirmation = active
      .filter(s => s.confirmation_status === 'Pending' && s.probation_end_date &&
        isBefore(parseISO(s.probation_end_date), addDays(now, 91)))
      .sort((a, b) => parseISO(a.probation_end_date) - parseISO(b.probation_end_date));

    const workAnniversaries = active
      .filter(s => {
        if (!s.date_joined) return false;
        const j = parseISO(s.date_joined);
        const ann = new Date(now.getFullYear(), j.getMonth(), j.getDate());
        return isAfter(ann, addDays(now, -1)) && isBefore(ann, addDays(now, 61)) &&
          differenceInYears(now, j) >= 1;
      })
      .sort((a, b) => {
        const aJ = parseISO(a.date_joined);
        const bJ = parseISO(b.date_joined);
        return new Date(now.getFullYear(), aJ.getMonth(), aJ.getDate()) -
               new Date(now.getFullYear(), bJ.getMonth(), bJ.getDate());
      });

    const incompleteProfiles = active.filter(s => {
      const fields = [s.phone, s.department, s.role, s.date_of_birth, s.date_joined, s.address, s.emergency_contact_name];
      return fields.filter(Boolean).length < 5;
    });

    return { upcomingBirthdays, dueForConfirmation, workAnniversaries, incompleteProfiles };
  }, [staffList, now]);

  if (showLoader) return <PageLoader message="Loading HR calendar..." />;

  const renderBirthday = (s) => {
    const days = daysUntil(s.date_of_birth, now);
    const age = differenceInYears(now, parseISO(s.date_of_birth)) + 1;
    return (
      <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border hover:bg-muted/60 transition-colors">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-pink-500/10 text-pink-400 text-xs font-bold">
            {getInitials(s.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{s.full_name}</p>
          <p className="text-xs text-muted-foreground">{s.department || 'No department'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold text-pink-400">
            {days === 0 ? '🎂 Today!' : `in ${days}d`}
          </p>
          <p className="text-xs text-muted-foreground">Turns {age}</p>
        </div>
      </div>
    );
  };

  const renderConfirmation = (s) => {
    const daysLeft = Math.ceil((parseISO(s.probation_end_date) - now) / (1000 * 60 * 60 * 24));
    const isOverdue = daysLeft < 0;
    return (
      <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border hover:bg-muted/60 transition-colors">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-amber-500/10 text-amber-400 text-xs font-bold">
            {getInitials(s.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{s.full_name}</p>
          <p className="text-xs text-muted-foreground">{s.department || 'No department'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-xs font-semibold ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
            {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </p>
          <p className="text-xs text-muted-foreground">
            {s.probation_end_date ? format(parseISO(s.probation_end_date), 'MMM d') : ''}
          </p>
        </div>
      </div>
    );
  };

  const renderAnniversary = (s) => {
    const years = differenceInYears(now, parseISO(s.date_joined));
    const days = daysUntil(s.date_joined, now);
    return (
      <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border hover:bg-muted/60 transition-colors">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-blue-500/10 text-blue-400 text-xs font-bold">
            {getInitials(s.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{s.full_name}</p>
          <p className="text-xs text-muted-foreground">{s.department || 'No department'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold text-blue-400">
            {days === 0 ? '🎉 Today!' : `in ${days}d`}
          </p>
          <p className="text-xs text-muted-foreground">{years} yr{years !== 1 ? 's' : ''}</p>
        </div>
      </div>
    );
  };

  const renderIncomplete = (s) => {
    const filled = [s.phone, s.department, s.role, s.date_of_birth, s.date_joined, s.address, s.emergency_contact_name].filter(Boolean).length;
    const pct = Math.round((filled / 7) * 100);
    return (
      <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border hover:bg-muted/60 transition-colors">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-slate-500/10 text-slate-400 text-xs font-bold">
            {getInitials(s.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{s.full_name}</p>
          <p className="text-xs text-muted-foreground">{s.role || 'No role'} • {s.department || 'No dept'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <StatusBadge status={pct >= 70 ? 'In Progress' : 'Pending'} />
          <p className="text-xs text-muted-foreground mt-0.5">{pct}% done</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {(isError || timedOut) && (
        <DataState
          title={timedOut ? 'Still loading HR calendar' : 'HR calendar unavailable'}
          description={error?.message || 'Showing empty calendar sections for now.'}
          onRetry={refetch}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard
          title="Upcoming Birthdays"
          icon={Cake}
          items={upcomingBirthdays}
          renderItem={renderBirthday}
          emptyText="No birthdays in the next 60 days"
          color="text-pink-400"
        />
        <SectionCard
          title="Confirmation Due"
          icon={UserCheck}
          items={dueForConfirmation}
          renderItem={renderConfirmation}
          emptyText="No confirmations due in the next 90 days"
          color="text-amber-400"
        />
        <SectionCard
          title="Work Anniversaries"
          icon={CalendarDays}
          items={workAnniversaries}
          renderItem={renderAnniversary}
          emptyText="No anniversaries in the next 60 days"
          color="text-blue-400"
        />
        <SectionCard
          title="Incomplete Profiles"
          icon={AlertCircle}
          items={incompleteProfiles}
          renderItem={renderIncomplete}
          emptyText="All active staff profiles are complete"
          color="text-slate-400"
        />
      </div>
    </div>
  );
}
