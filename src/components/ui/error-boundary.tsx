"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { toUserMessage } from "@/lib/errors";
import { Button } from "./button";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; reset: () => void }) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  title?: string;
  description?: string;
  isolate?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    } else {
      console.error("[ErrorBoundary caught an error]:", error, errorInfo);
    }
  }

  reset = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // 1. Custom function or node fallback
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          reset: this.reset,
        });
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 2. Default standard accessible fallback
      const userMessage = toUserMessage(this.state.error);
      const isIsolated = this.props.isolate ?? true;

      return (
        <div
          role="alert"
          aria-live="assertive"
          className={
            isIsolated
              ? "p-6 rounded-2xl border border-rose-200 bg-rose-50/40 text-slate-900 shadow-2xs flex flex-col items-center justify-center text-center my-4"
              : "p-4 text-center text-slate-800"
          }
        >
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>

          <h3 className="text-sm font-bold text-slate-900 mb-1">
            {this.props.title || "Unable to display this section"}
          </h3>

          <p className="text-xs text-slate-600 max-w-md mb-4 leading-relaxed">
            {this.props.description || userMessage}
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={this.reset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
