import Link from "next/link";
import {
  FileQuestion,
  Home,
  PenTool,
  Calendar,
  Warehouse,
  LifeBuoy,
} from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-center p-8 sm:p-12 space-y-8 animate-in fade-in duration-200">
        {/* 404 Badge & Icon Header */}
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black tracking-wider uppercase mb-5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
            404 Error • Page Not Found
          </div>

          <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner mb-2">
            <FileQuestion className="w-10 h-10 stroke-[2.2]" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-4">
            Plant Location Not Found
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-2 max-w-lg mx-auto leading-relaxed">
            The production report, plant configuration, or screen you are looking for
            could not be located. It may have been relocated, renamed, or you may have entered an outdated link.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-100">
          <Link
            href="/dashboard"
            className="btn btn-sm sm:btn-md btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-2 font-bold shadow-md shadow-indigo-100"
          >
            <Home className="w-4 h-4" />
            Main Dashboard
          </Link>

          <Link
            href="/entry"
            className="btn btn-sm sm:btn-md btn-outline rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-700 gap-2 font-bold"
          >
            <PenTool className="w-4 h-4" />
            Daily Entry
          </Link>
        </div>

        {/* Quick Navigation Cards */}
        <div className="pt-6 border-t border-slate-100 text-left">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-3 text-center sm:text-left">
            Frequently Visited Manufacturing Portals
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/calendar"
              className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-200 transition-all flex items-center gap-3 group"
            >
              <div className="p-2 rounded-xl bg-white text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Production Calendar</div>
                <div className="text-[10px] text-slate-400 font-medium">Monthly schedule & targets</div>
              </div>
            </Link>

            <Link
              href="/fm/store"
              className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-200 transition-all flex items-center gap-3 group"
            >
              <div className="p-2 rounded-xl bg-white text-teal-600 shadow-2xs group-hover:scale-105 transition-transform">
                <Warehouse className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Stock Ledger</div>
                <div className="text-[10px] text-slate-400 font-medium">Store finished goods</div>
              </div>
            </Link>

            <Link
              href="/login"
              className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-200 transition-all flex items-center gap-3 group"
            >
              <div className="p-2 rounded-xl bg-white text-amber-600 shadow-2xs group-hover:scale-105 transition-transform">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Account Access</div>
                <div className="text-[10px] text-slate-400 font-medium">Sign in or switch role</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>STATUS: 404 NOT_FOUND</span>
          <span>DPM Industrial v2.0</span>
        </div>
      </div>
    </div>
  );
}
