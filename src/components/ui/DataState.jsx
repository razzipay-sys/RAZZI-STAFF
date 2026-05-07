import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DataState({
  title = 'Data unavailable',
  description = 'We could not load this data right now.',
  onRetry,
}) {
  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5">
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
