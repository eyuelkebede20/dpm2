"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Critical Root Layout Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans antialiased">
        <div className="w-full max-w-lg bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center font-black text-2xl border border-rose-500/30">
            ⚠️
          </div>

          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-950/60 px-3 py-1 rounded-full border border-rose-800">
              Critical System Crash
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-4">
              Daily Production Manager
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              The root layout encountered an unrecoverable rendering failure.
              Click the button below to restart the application shell.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left font-mono text-xs text-rose-300">
            <div>
              <span className="text-slate-500">Error:</span> {error.message || "Root error"}
            </div>
            {error.digest && (
              <div className="mt-1">
                <span className="text-slate-500">Digest:</span> {error.digest}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full py-3 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Restart Application
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/login";
                }
              }}
              className="w-full py-3 px-4 rounded-xl font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
