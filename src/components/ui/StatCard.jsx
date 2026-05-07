import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendLabel,
  className,
  iconClassName 
}) {
  const isPositive = trend > 0;
  
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 md:space-y-2 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">{title}</p>
            <p className="text-xl md:text-3xl font-bold text-foreground">{value}</p>
            {trend !== undefined && (
              <p className={cn(
                "text-xs font-medium flex items-center gap-1",
                isPositive ? "text-emerald-500" : "text-red-500"
              )}>
                <span>{isPositive ? '↑' : '↓'} {Math.abs(trend)}%</span>
                {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "p-2 md:p-3 rounded-xl bg-primary/10 shrink-0",
              iconClassName
            )}>
              <Icon className="w-4 h-4 md:w-6 md:h-6 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}