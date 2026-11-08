"use client";

import Link from "next/link";
import {
  KeyRound,
  LogIn,
  Home,
  ShieldCheck,
  Clock,
  Boxes,
} from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-amber-200/90 shadow-xl overflow-hidden text-center p-8 sm:p-12 space-y-8 animate-in fade-in duration-200">
        {/* Badge & Icon */}
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black tracking-wider uppercase mb-5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            401 Unauthorized • Session Inactive
          </div>

          <div className="w-20 h-20 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner mb-2">
            <KeyRound className="w-10 h-10 stroke-[2.2]" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-4">
            Authentication Required
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
            Your login session has expired or you attempted to view a secure operational route
            without an active session. Please authenticate to continue your workflow.
          </p>
        </div>

        {/* Security Notice Box */}
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-left flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <b>Enterprise Security Policy:</b> All daily manufacturing numbers, stock ledger records,
            and batch quality inspections are encrypted and restricted to authenticated personnel.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-100">
          <Link
            href="/login"
            className="btn btn-sm sm:btn-md btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-2 font-bold shadow-md shadow-indigo-100 px-6"
          >
            <LogIn className="w-4 h-4" />
            Sign In with Credentials
          </Link>

          <Link
            href="/"
            className="btn btn-sm sm:btn-md btn-ghost rounded-2xl gap-2 font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <Home className="w-4 h-4" />
            Landing Page
          </Link>
        </div>

        {/* Footer Meta */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>STATUS: 401 UNAUTHORIZED</span>
          <span>Argon2id & Better Auth Security</span>
        </div>
      </div>
    </div>
  );
}
