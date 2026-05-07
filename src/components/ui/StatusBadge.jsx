import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  // Employment status
  'Active': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Suspended': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Resigned': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  'Terminated': 'bg-red-500/10 text-red-500 border-red-500/20',
  'On Leave': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  
  // Document status
  'Pending': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Submitted': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Reviewed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Requires Update': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'Approved': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Rejected': 'bg-red-500/10 text-red-500 border-red-500/20',
  
  // Task status
  'Not Started': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  'In Progress': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Completed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Pending Review': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'Blocked': 'bg-red-500/10 text-red-500 border-red-500/20',
  'Carried Forward': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'Needs Correction': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  
  // Priority
  'Low': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  'Medium': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'High': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'Urgent': 'bg-red-500/10 text-red-500 border-red-500/20',
  
  // Compliance
  'Compliant': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Late': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Absent': 'bg-red-500/10 text-red-500 border-red-500/20',
  'Incomplete Report': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  
  // Confirmation status
  'Confirmed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Extended': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Not Applicable': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  
  // Work mode
  'Remote': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'On-site': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Hybrid': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  
  // Employment type
  'Full-time': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Part-time': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Contract': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'Intern': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  'Probation': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

export default function StatusBadge({ status, className }) {
  const style = statusStyles[status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';
  
  return (
    <Badge 
      variant="outline" 
      className={cn('font-medium border', style, className)}
    >
      {status}
    </Badge>
  );
}