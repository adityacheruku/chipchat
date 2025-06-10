
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
    // You could also log the error to an external error reporting service here
  }

  private handleResetError = () => {
    this.setState({ hasError: false, error: null });
    // Attempt to reload or redirect, depending on the desired recovery strategy
    // For a simple reset, just clearing the error state might be enough if
    // the children can recover. Often, a page reload is a safer bet.
    // window.location.reload(); // Example: force a reload
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-4 text-center bg-destructive/10 border border-destructive rounded-lg">
          <h1 className="text-2xl font-semibold text-destructive mb-2">
            Oops! Something went wrong.
          </h1>
          <p className="text-destructive/80 mb-4">
            {this.props.fallbackMessage || "We're sorry for the inconvenience. Please try refreshing the page, or click the button below to attempt a reset."}
          </p>
          {this.state.error && (
            <pre className="mb-4 p-2 text-xs bg-destructive/20 text-destructive-foreground rounded overflow-auto max-w-full">
              {this.state.error.message}
            </pre>
          )}
          <Button onClick={this.handleResetError} variant="destructive" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            Try to Reset
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
