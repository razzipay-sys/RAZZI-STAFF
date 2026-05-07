import React from 'react';
import { AlertCircle, RotateCcw, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorCount = (this.state.errorCount || 0) + 1;
    this.setState({ error, errorInfo, errorCount });

    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught error:', error);
      console.error('Error info:', errorInfo);
      console.error('Error count:', errorCount);
    }

    if (import.meta.env.PROD && window.errorLogger) {
      window.errorLogger({
        message: error.toString(),
        stack: errorInfo?.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.toString() || 'Unknown error';

      return (
        <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 z-50 overflow-auto">
          <div className="max-w-2xl w-full mx-4 my-8 space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600/20 to-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500 animate-pulse" />
              </div>
            </div>

            <div className="text-center space-y-3">
              <h1 className="text-3xl font-bold text-white">Something went wrong</h1>
              <p className="text-base text-slate-300">
                We encountered an unexpected error loading this page. Please try one of the options below to recover.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="bg-red-950/40 border border-red-700/50 rounded-lg p-4 space-y-2 overflow-auto max-h-64">
                <h3 className="text-sm font-semibold text-red-300">Error Details</h3>
                <div className="text-xs text-red-200 font-mono whitespace-pre-wrap break-words">
                  {errorMessage}
                </div>
                {this.state.errorInfo?.componentStack && (
                  <>
                    <h3 className="text-sm font-semibold text-red-300 mt-3">Component Stack</h3>
                    <div className="text-xs text-red-200 font-mono whitespace-pre-wrap break-words">
                      {this.state.errorInfo.componentStack}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="border-slate-600 text-slate-200 hover:bg-slate-800 px-6 py-2.5 flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Button>
              {import.meta.env.DEV && (
                <Button
                  onClick={this.resetError}
                  variant="outline"
                  className="border-slate-600 text-slate-200 hover:bg-slate-800 px-6 py-2.5 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </Button>
              )}
            </div>

            {this.state.errorCount > 2 && (
              <div className="bg-yellow-950/40 border border-yellow-700/50 rounded-lg p-3">
                <p className="text-sm text-yellow-300">
                  Multiple errors detected. If the problem persists, please clear your browser cache or contact support.
                </p>
              </div>
            )}

            <div className="border-t border-slate-700/50 pt-4 text-center">
              <p className="text-xs text-slate-500">
                Error ID: {Date.now()}-{Math.random().toString(36).substring(2, 9).toUpperCase()}
              </p>
              {import.meta.env.DEV && (
                <p className="text-xs text-slate-500 mt-1">
                  Page: {window.location.pathname}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
