import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DataState({
  title = 'Data unavailable',
  description = 'We could not load this data right now.',
  onRetry,
  variant = 'warning',
}) {
  const config = {
    warning: {
      icon: AlertTriangle,
      card: 'border-amber-500/20 bg-amber-500/5',
      icon_color: 'text-amber-400',
    },
    error: {
      icon: WifiOff,
      card: 'border-red-500/20 bg-red-500/5',
      icon_color: 'text-red-400',
    },
  }[variant] || {
    icon: AlertTriangle,
    card: 'border-amber-500/20 bg-amber-500/5',
    icon_color: 'text-amber-400',
  };

  const IconComp = config.icon;

  return (
    <Card className={config.card}>
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 px-5">
        <div className="flex gap-3 items-start">
          <IconComp className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.icon_color}`} />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
