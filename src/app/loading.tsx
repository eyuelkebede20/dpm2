import React from "react";
import { PageContainer } from "@/components/ui/page-container";

/**
 * Root Loading Skeleton (Next.js Instant Route Transition)
 *
 * Rendered immediately by Next.js App Router when navigating between pages,
 * providing zero-latency feedback and eliminating perceived navigation lag.
 * Adheres to DESIGN.md tokens and supports prefers-reduced-motion.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading page content" className="w-full relative">
      {/* Top Instant Navigation Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-100 z-50 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 w-1/2 rounded-full animate-[shimmer_1.5s_infinite]"
          style={{
            animation: "indeterminate 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>

      <PageContainer className="animate-pulse">
        {/* Header Skeleton */}
        <div className="mb-6 sm:mb-8 pb-5 border-b border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="h-5 w-24 bg-slate-200 rounded-full" />
              <div className="h-8 w-64 sm:w-80 bg-slate-300 rounded-xl" />
              <div className="h-4 w-48 sm:w-96 bg-slate-200 rounded-lg" />
            </div>
            <div className="h-10 w-32 bg-slate-200 rounded-xl hidden sm:block" />
          </div>
        </div>

        {/* Metric Cards Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 bg-slate-200 rounded-md" />
                <div className="w-8 h-8 bg-slate-100 rounded-xl" />
              </div>
              <div className="h-7 w-28 bg-slate-300 rounded-lg" />
              <div className="h-3 w-36 bg-slate-200 rounded-md" />
            </div>
          ))}
        </div>

        {/* Content Body Skeleton Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="h-6 w-44 bg-slate-200 rounded-lg" />
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-slate-100 rounded-xl" />
              <div className="h-9 w-24 bg-slate-100 rounded-xl" />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center px-4 justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-slate-200 rounded-full" />
                  <div className="h-4 w-32 bg-slate-200 rounded-md" />
                </div>
                <div className="h-4 w-20 bg-slate-200 rounded-md" />
                <div className="h-4 w-16 bg-slate-200 rounded-md hidden sm:block" />
              </div>
            ))}
          </div>
        </div>

        <span className="sr-only">Loading page data, please wait...</span>
      </PageContainer>
    </div>
  );
}
