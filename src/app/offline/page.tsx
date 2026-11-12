"use client";

import React, { useState } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, LayoutDashboard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const [reconnecting, setReconnecting] = useState(false);

  const handleReconnect = () => {
    setReconnecting(true);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Offline Icon Emblem */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-inner">
          <WifiOff className="w-10 h-10 animate-pulse" />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
            PWA Offline Mode / ከመስመር ውጭ
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            You&apos;re Currently Offline
          </h1>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Homicho Ammunition Engineering Industry platform is running in local PWA cache. Cached views and product catalogs remain accessible.
          </p>
        </div>

        {/* Security / Cache Status Note */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">Data Protection Guaranteed</p>
            <p>
              Your local records are safe. Once network connectivity is restored, newly entered daily metrics and inspections will synchronize.
            </p>
          </div>
        </div>

        {/* Interactive Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleReconnect}
            loading={reconnecting}
            className="w-full sm:flex-1 justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Reconnecting</span>
          </Button>

          <Link
            href="/dashboard"
            className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors min-h-[44px]"
          >
            <LayoutDashboard className="w-4 h-4 text-slate-600" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
