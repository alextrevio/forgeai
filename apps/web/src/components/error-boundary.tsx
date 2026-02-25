"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Production: could send to error tracking service (Sentry, etc.)
    if (process.env.NODE_ENV === "development") {
      console.error("Error boundary caught:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 p-8 bg-[#0A0A0A]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ef4444]/10">
            <AlertTriangle className="h-7 w-7 text-[#ef4444]" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-white mb-1">Something went wrong</h3>
            <p className="text-xs text-gray-400 max-w-[300px]">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 rounded-lg bg-[#6d5cff] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d5cff]/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
