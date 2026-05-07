import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function StatCard({ 
  title, 
  value, 
  icon: Icon,
  description,
  trend,
  loading = false,
  error = false
}) {
  return (
    <Card className="group hover:shadow-lg transition-all border-white/5 hover:border-primary/30 bg-gradient-to-br from-white/5 to-white/[0.02]">
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
}