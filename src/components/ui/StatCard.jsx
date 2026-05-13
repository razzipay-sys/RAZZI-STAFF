import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function StatCard({ 
  title, 
  value, 
  icon: Icon,
  description,
  trend,
  loading = false,
  error = false,
  to,
  onClick,
  disabled = false,
}) {
  const isClickable = (!!to || !!onClick) && !disabled;

  const card = (
    <Card className={`group transition-all border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02] ${isClickable ? 'hover:shadow-lg hover:border-primary/30' : ''}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="mt-2 h-8 w-16 bg-muted rounded animate-pulse" />
            ) : error ? (
              <p className="text-lg font-bold text-destructive mt-1">—</p>
            ) : (
              <p className="text-3xl font-bold text-white mt-2">{value}</p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-2">{description}</p>
            )}
          </div>
          <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
      >
        {card}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        className="w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:opacity-60"
        disabled={disabled}
      >
        {card}
      </button>
    );
  }

  return (
    card
  );
}
