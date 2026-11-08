"use client";

import Link from "next/link";
import {
  ShieldAlert,
  Home,
  ArrowLeft,
  UserCheck,
  Lock,
} from "lucide-react";

export default function ForbiddenPage() {
  const handleGoBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-rose-200/90 shadow-xl overflow-hidden text-center p-8 sm:p-12 space-y-8 animate-in fade-in duration-200">
        {/* Badge & Icon */}
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black tracking-wider uppercase mb-5">
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            403 Forbidden • Access Denied
          </div>

          <div className="w-20 h-20 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner mb-2">
            <ShieldAlert className="w-10 h-10 stroke-[2.2]" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-4">
            Restricted Plant Operations Area
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
            Your current user account does not possess the required RBAC role permissions
            to access or execute actions in this area of the Daily Production Manager.
          </p>
        </div>

        {/* Role Permissions Callout */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Role Permission Scopes:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span><b>Sys Admin:</b> Profile, OMs, and impersonation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span><b>Operation Mgr:</b> Plants, teams & QA matrix</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span><b>Factory Mgr:</b> Lines, plans, daily grid & store</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span><b>QA Inspector:</b> Quality audits & defect logging</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleGoBack}
            className="btn btn-sm sm:btn-md btn-ghost rounded-2xl gap-2 font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>

          <Link
            href="/dashboard"
            className="btn btn-sm sm:btn-md btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-2 font-bold shadow-md shadow-indigo-100"
          >
            <Home className="w-4 h-4" />
            Your Dashboard
          </Link>

          <Link
            href="/login"
            className="btn btn-sm sm:btn-md btn-outline rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-700 gap-2 font-bold"
          >
            <UserCheck className="w-4 h-4" />
            Switch Account
          </Link>
        </div>

        {/* Footer Meta */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>STATUS: 403 FORBIDDEN</span>
          <span>DPM RBAC Security Subsystem</span>
        </div>
      </div>
    </div>
  );
}
