"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  RefreshCw,
  Home,
  Copy,
  CheckCheck,
  LifeBuoy,
  Terminal,
} from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log unexpected runtime exception for observability
    console.error("DPM Global Error Caught:", error);
  }, [error]);

  const copyDiagnosticInfo = () => {
    const diagnostic = `DPM 500 Error Diagnostic
Message: ${error.message}
Digest: ${error.digest || "N/A"}
Stack: ${error.stack || "N/A"}
Timestamp: ${new Date().toISOString()}`;

    navigator.clipboard.writeText(diagnostic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-rose-200/90 shadow-xl overflow-hidden text-center p-8 sm:p-12 space-y-8 animate-in fade-in duration-200">
        {/* Error Badge & Icon */}
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs font-black tracking-wider uppercase mb-5">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
            500 Error • System Exception
          </div>

          <div className="w-20 h-20 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner mb-2">
            <AlertOctagon className="w-10 h-10 stroke-[2.2]" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-4">
            Production System Interrupted
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
            An unexpected server or data transaction error occurred while executing this operation.
            You can attempt to recover the screen or return to the main dashboard.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-sm sm:btn-md btn-primary rounded-2xl bg-rose-600 hover:bg-rose-700 text-white border-none gap-2 font-bold shadow-md shadow-rose-100"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <Link
            href="/dashboard"
            className="btn btn-sm sm:btn-md btn-outline rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-700 gap-2 font-bold"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="btn btn-sm sm:btn-md btn-ghost rounded-2xl gap-2 font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <Terminal className="w-4 h-4" />
            {showDetails ? "Hide Diagnostics" : "View Diagnostics"}
          </button>
        </div>

        {/* Expandable Diagnostic Details */}
        {showDetails && (
          <div className="p-4 rounded-2xl bg-slate-900 text-left border border-slate-800 text-slate-200 text-xs font-mono space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-400">Technical Details & Trace</span>
              <button
                type="button"
                onClick={copyDiagnosticInfo}
                className="btn btn-xs btn-ghost text-slate-300 hover:text-white gap-1 rounded-lg"
              >
                {copied ? (
                  <>
                    <CheckCheck className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-sans text-[10px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="font-sans text-[10px]">Copy Diagnostics</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <span className="text-slate-500">Error Name:</span> {error.name || "Error"}
            </div>
            <div>
              <span className="text-slate-500">Message:</span>{" "}
              <span className="text-rose-400 font-bold">{error.message || "Unknown error"}</span>
            </div>
            {error.digest && (
              <div>
                <span className="text-slate-500">Digest Code:</span> {error.digest}
              </div>
            )}
            <div className="text-[11px] text-slate-500 pt-1">
              Provide this diagnostic information to your IT support administrator for debugging.
            </div>
          </div>
        )}

        {/* Footer Meta */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>STATUS: 500 INTERNAL_SERVER_ERROR</span>
          <Link href="/login" className="hover:text-indigo-600 font-medium">
            Emergency Re-Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
