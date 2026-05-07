import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error }) {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
          <p className="text-muted-foreground">
            The page failed to load due to a runtime error. This might be a temporary connection issue.
          </p>
          {import.meta.env.DEV && (
            <div className="mt-4 p-4 bg-muted rounded-lg text-left overflow-auto max-h-40">
              <code className="text-xs text-red-400">{error?.toString()}</code>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Reload Page
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline" className="gap-2">
            <Home className="w-4 h-4" /> Dashboard
          </Button>
          <Button onClick={() => logout()} variant="ghost" className="col-span-2 gap-2 text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" /> Sign Out and Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
