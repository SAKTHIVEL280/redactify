import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-black" role="alert" aria-live="assertive">
          <div className="max-w-md p-8 bg-zinc-900 rounded-2xl border border-white/10">
            <h1 className="text-2xl font-bold text-red-500 mb-4" id="error-title">Something went wrong</h1>
            <p className="text-zinc-400 mb-4" id="error-description">
              We encountered an unexpected error. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              onKeyDown={(e) => e.key === 'Enter' && window.location.reload()}
              className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-900"
              aria-describedby="error-description"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
