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
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
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
              "p-3 rounded-xl bg-primary/10",
              iconClassName
            )}>
              <Icon className="w-6 h-6 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}