import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const DashCard = ({ title, icon: Icon, children, to }) => (
  <Card className="hover:shadow-md transition-shadow border-white/5 bg-white/5 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-semibold flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        {title}
      </CardTitle>
      {to && (
        <Link to={to}>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      )}
    </CardHeader>
    <CardContent className="space-y-3">
      {children}
    </CardContent>
  </Card>
);

export const DashListRow = ({ name, sub, right }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium truncate">{name}</p>
      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
    <div className="ml-4 shrink-0">
      {typeof right === 'string' || typeof right === 'number' ? (
        <span className="text-sm font-semibold">{right}</span>
      ) : right}
    </div>
  </div>
);

export const EmptyNote = ({ text }) => (
  <p className="text-xs text-muted-foreground text-center py-4">{text}</p>
);
