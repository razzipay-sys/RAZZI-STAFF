import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

function TrendBadge({ trend }) {
  if (trend === undefined || trend === null) return null;
  const num = typeof trend === 'number' ? trend : parseFloat(trend);
  if (isNaN(num)) return null;

  if (num > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400">
      <TrendingUp className="w-3 h-3" /> +{num}%
    </span>
  );
  if (num < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-400">
      <TrendingDown className="w-3 h-3" /> {num}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
      <Minus className="w-3 h-3" /> 0%
    </span>
  );
}

const StatCard = React.memo(function StatCard({
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
  accent,
}) {
  const isClickable = (!!to || !!onClick) && !disabled;

  const card = (
    <Card className={cn(
      'group transition-all duration-200 border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02]',
      isClickable && 'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer',
      disabled && 'opacity-60 cursor-not-allowed'
    )}>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{title}</p>
            {loading ? (
              <div className="mt-2 h-8 w-20 bg-muted/60 rounded animate-pulse" />
            ) : error ? (
              <p className="text-2xl font-bold text-destructive mt-1.5">—</p>
            ) : (
              <p className="text-3xl font-bold text-foreground mt-1.5 tabular-nums">{value}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {description && (
                <p className="text-xs text-muted-foreground truncate">{description}</p>
              )}
              {!loading && !error && <TrendBadge trend={trend} />}
            </div>
          </div>
          <div className={cn(
            'flex-shrink-0 p-3 rounded-xl transition-colors',
            accent ? `bg-${accent}/10 group-hover:bg-${accent}/20` : 'bg-primary/10 group-hover:bg-primary/20'
          )}>
            <Icon className={cn('w-5 h-5', accent ? `text-${accent}` : 'text-primary')} />
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
        className="w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        disabled={disabled}
      >
        {card}
      </button>
    );
  }

  return card;
});

export default StatCard;
