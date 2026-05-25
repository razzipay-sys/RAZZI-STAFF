import React from 'react';
import { FileX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function EmptyState({
  icon: Icon = FileX,
  title = 'No data found',
  description = "There's nothing here yet.",
  action,
  actionLabel,
  className,
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-4 text-center',
      className
    )}>
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
          <Icon className="w-9 h-9 text-muted-foreground/60" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl -z-10 scale-125" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">{description}</p>
      {action && actionLabel && (
        <Button onClick={action} size="sm" className="gradient-primary text-primary-foreground">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
