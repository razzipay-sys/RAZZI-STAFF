import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  // Employment status
  Active:             { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', pulse: true },
  Suspended:          { dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  Resigned:           { dot: 'bg-slate-500',   badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  Terminated:         { dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'On Leave':         { dot: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },

  // Document status
  Pending:            { dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  Submitted:          { dot: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  Reviewed:           { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  'Requires Update':  { dot: 'bg-orange-500',  badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  Approved:           { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  Rejected:           { dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400 border-red-500/20' },

  // Task status
  'Not Started':      { dot: 'bg-slate-500',   badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  'In Progress':      { dot: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', pulse: true },
  Completed:          { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  'Pending Review':   { dot: 'bg-purple-500',  badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  Blocked:            { dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'Carried Forward':  { dot: 'bg-orange-500',  badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  'Needs Correction': { dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },

  // Priority
  Low:                { dot: 'bg-slate-500',   badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  Medium:             { dot: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  High:               { dot: 'bg-orange-500',  badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  Urgent:             { dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400 border-red-500/20', pulse: true },

  // Compliance
  Compliant:          { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  Late:               { dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  Absent:             { dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'Incomplete Report':{ dot: 'bg-orange-500',  badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },

  // Confirmation
  Confirmed:          { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  Extended:           { dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  'Not Applicable':   { dot: 'bg-slate-500',   badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },

  // Work mode
  Remote:             { dot: 'bg-purple-500',  badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  'On-site':          { dot: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  Hybrid:             { dot: 'bg-cyan-500',    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },

  // Employment type
  'Full-time':        { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  'Part-time':        { dot: 'bg-blue-500',    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  Contract:           { dot: 'bg-purple-500',  badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  Intern:             { dot: 'bg-cyan-500',    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  Probation:          { dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },

  // Review status
  Approved_Review:    { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const FALLBACK = { dot: 'bg-slate-500', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };

export default function StatusBadge({ status, showDot = true, className }) {
  if (!status) return null;
  const config = STATUS_CONFIG[status] || FALLBACK;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.badge,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
            config.dot,
            config.pulse && 'animate-pulse'
          )}
        />
      )}
      {status}
    </span>
  );
}
