"use client";

import Link from "next/link";
import { SessionUser } from "@/lib/authz";
import { gregorianToEth, formatEthDate } from "@/lib/ethiopian-calendar";
import {
  Building2,
  Users,
  Target,
  TrendingUp,
  AlertOctagon,
  Boxes,
  PenTool,
  Calendar,
  Warehouse,
  ClipboardCheck,
  ChevronRight,
  Shield,
  Layers,
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

interface DashboardViewProps {
  user: SessionUser;
  adminData?: any;
  omData?: any;
  fmData?: any;
  qaData?: any;
  factoryName?: string;
  calendarSystem?: string;
}

export function DashboardView({
  user,
  adminData,
  omData,
  fmData,
  qaData,
  factoryName,
  calendarSystem = "ethiopian",
}: DashboardViewProps) {
  const isEth = calendarSystem === "ethiopian";
  const ethToday = isEth ? gregorianToEth(new Date()) : null;

  return (
    <div className="space-y-8 pb-16">
      {/* Welcome Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="badge badge-sm uppercase text-[10px] font-black tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
              {user.role}
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {isEth && ethToday ? (
                <>
                  <span className="font-bold text-slate-800">
                    🇪🇹 {formatEthDate(ethToday, "full_am")}
                  </span>
                  <span className="text-slate-400 font-medium hidden sm:inline">
                    ({formatEthDate(ethToday, "full_en")})
                  </span>
                </>
              ) : (
                new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              )}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Welcome back, {user.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            {factoryName ? `Managing ${factoryName}` : "Operational overview and real-time plant KPIs"}
          </p>
        </div>

        {/* Quick action buttons per role */}
        <div className="flex flex-wrap items-center gap-2">
          {user.role === "fm" && (
            <>
              <Link
                href="/entry"
                className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl border-none shadow-xs font-bold gap-1.5"
              >
                <PenTool className="w-4 h-4" />
                Daily Entry
              </Link>
              <Link
                href="/calendar"
                className="btn btn-sm btn-outline rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 font-bold gap-1.5"
              >
                <Calendar className="w-4 h-4" />
                Calendar
              </Link>
              <Link
                href="/fm/store"
                className="btn btn-sm btn-ghost rounded-xl text-slate-600 hover:text-slate-900 font-bold gap-1.5"
              >
                <Warehouse className="w-4 h-4" />
                Store
              </Link>
            </>
          )}

          {user.role === "om" && (
            <>
              <Link
                href="/om"
                className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl border-none shadow-xs font-bold gap-1.5"
              >
                <Building2 className="w-4 h-4" />
                Manage Plants
              </Link>
              <Link
                href="/calendar"
                className="btn btn-sm btn-outline rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 font-bold gap-1.5"
              >
                <Calendar className="w-4 h-4" />
                Calendar
              </Link>
            </>
          )}

          {user.role === "qa" && (
            <Link
              href="/qa"
              className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl border-none shadow-xs font-bold gap-1.5"
            >
              <ClipboardCheck className="w-4 h-4" />
              New Inspection
            </Link>
          )}

          {user.role === "sys_admin" && (
            <Link
              href="/admin"
              className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl border-none shadow-xs font-bold gap-1.5"
            >
              <Shield className="w-4 h-4" />
              Admin Portal
            </Link>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. SYS ADMIN DASHBOARD                                        */}
      {/* ------------------------------------------------------------- */}
      {user.role === "sys_admin" && adminData && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Operating Plants
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {adminData.stats.activeFactories}{" "}
                <span className="text-xs font-normal text-slate-400">
                  / {adminData.stats.totalFactories} total
                </span>
              </div>
              <p className="text-xs text-emerald-600 mt-2 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active industrial plants
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Operation Managers
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {adminData.stats.totalOMs}
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Executive factory leaders
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Factory Managers
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {adminData.stats.totalFMs}
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Plant floor supervisors
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                QA Inspectors
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {adminData.stats.totalQAs}
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Quality control personnel
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
              <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>Industry Profile Summary</span>
                <span className="badge badge-sm badge-ghost text-xs font-mono">Profile #1</span>
              </h2>
              <dl className="divide-y divide-slate-100 text-sm mt-3">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500 font-medium">Company Name</dt>
                  <dd className="font-bold text-slate-900">{adminData.profile.companyName}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500 font-medium">Standard Unit</dt>
                  <dd className="font-bold text-slate-900 uppercase font-mono">{adminData.profile.units}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500 font-medium">Working Days / Week</dt>
                  <dd className="font-bold text-slate-900 font-mono">
                    {adminData.profile.workingDays?.length || 6} days
                  </dd>
                </div>
              </dl>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <Link
                  href="/admin"
                  className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center gap-1 group"
                >
                  Configure in Admin Portal <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
              <h2 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
                Registered Factory Facilities
              </h2>
              <div className="divide-y divide-slate-100 text-sm mt-3">
                {((adminData as any).recentFactories || (adminData as any).omsList || []).map((f: any) => (
                  <div key={f.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">{f.name || f.companyName || f.email || "Facility"}</div>
                      <div className="text-[11px] text-slate-400 font-mono">ID: {f.id ? f.id.slice(0, 8) : ""}...</div>
                    </div>
                    <span className="badge badge-sm bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. OPERATION MANAGER DASHBOARD                                */}
      {/* ------------------------------------------------------------- */}
      {user.role === "om" && omData && (
        <div className="space-y-8">
          {/* MTD Aggregate Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Month-to-Date Output
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {omData.totalOMOutput.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-400">pcs</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Combined finished goods across all factories
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Monthly Planned Target
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {omData.totalOMTarget.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-400">pcs</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Total monthly plan quota
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Overall Plan Achievement
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {omData.overallPerformance !== null ? `${omData.overallPerformance}%` : "—"}
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    (omData.overallPerformance || 0) >= 100
                      ? "bg-emerald-500"
                      : (omData.overallPerformance || 0) >= 80
                      ? "bg-indigo-600"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, omData.overallPerformance || 0)}%` }}
                />
              </div>
              <p
                className={`text-xs mt-2 font-bold ${
                  (omData.overallPerformance || 0) >= 100
                    ? "text-emerald-700"
                    : "text-indigo-700"
                }`}
              >
                {(omData.overallPerformance || 0) >= 100 ? "Ahead of schedule" : "Pacing target"}
              </p>
            </div>
          </div>

          {/* Factories Comparison Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
            <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Factory Performance Comparison
                </h2>
                <p className="text-xs text-slate-500">
                  Breakdown by manufacturing facility for {omData.startOfMonth} → {omData.endOfMonth}
                </p>
              </div>
              <Link
                href="/om"
                className="btn btn-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl font-bold"
              >
                Configure Facilities
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              {((omData as any).factories || (omData as any).factoryCards || []).length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No factories assigned to your account.
                </div>
              ) : (
                <table className="table w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs font-extrabold uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                      <th>Factory Plant</th>
                      <th>MTD Output</th>
                      <th>MTD Target</th>
                      <th>Progress %</th>
                      <th>Rework</th>
                      <th>Reject</th>
                      <th>Scrap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {((omData as any).factories || (omData as any).factoryCards || []).map((f: any) => (
                      <tr key={f.factoryId || f.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="font-bold text-slate-900">
                          {f.factoryName || f.name}
                        </td>
                        <td className="font-extrabold text-slate-900 font-mono tabular-nums">
                          {(f.mtdOutput ?? 0).toLocaleString()}
                        </td>
                        <td className="font-mono tabular-nums text-slate-600">
                          {(f.mtdTarget ?? 0).toLocaleString()}
                        </td>
                        <td>
                          {(f.performance ?? f.targetProgress) !== null && (f.performance ?? f.targetProgress) !== undefined ? (
                            <span
                              className={`badge badge-sm font-mono font-bold ${
                                f.performance >= 100
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : f.performance >= 80
                                  ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                                  : "bg-rose-100 text-rose-800 border-rose-200"
                              }`}
                            >
                              {f.performance}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">No plan</span>
                          )}
                        </td>
                        <td className="text-amber-700 font-mono font-semibold">{f.mtdRework}</td>
                        <td className="text-rose-700 font-mono font-semibold">{f.mtdReject}</td>
                        <td className="text-slate-500 font-mono">{f.mtdScrap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. FACTORY MANAGER DASHBOARD                                  */}
      {/* ------------------------------------------------------------- */}
      {user.role === "fm" && fmData && (() => {
        const lineBreakdowns = fmData.lineBreakdowns || [];
        const todaySafe = fmData.todayStr || new Date().toISOString().split("T")[0];
        const dateDisplay = isEth ? formatEthDate(gregorianToEth(todaySafe), "full_am") : todaySafe;

        return (
        <div className="space-y-8">
          {/* Today's Submission Status Callout */}
          {lineBreakdowns.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Today&apos;s Daily Report is Pending
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    No production counts submitted yet for {dateDisplay}. Enter today&apos;s numbers to update inventory.
                  </p>
                </div>
              </div>
              <Link
                href="/entry"
                className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-2xl px-5 font-bold shadow-xs whitespace-nowrap"
              >
                <PenTool className="w-4 h-4 mr-1" />
                Enter Today&apos;s Numbers
              </Link>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Today&apos;s Numbers Submitted & Synced
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {lineBreakdowns.length} production lines recorded for {dateDisplay}. Store stock ledger updated.
                  </p>
                </div>
              </div>
              <Link
                href="/entry"
                className="btn btn-sm btn-outline border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-2xl px-5 font-bold"
              >
                <PenTool className="w-4 h-4 mr-1" />
                Review / Edit
              </Link>
            </div>
          )}

          {/* Today's Target vs Actual Hero Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Today&apos;s Finished Output
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {fmData.todayActual.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-400">pcs</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`badge badge-sm font-mono font-black ${
                    fmData.todayVariance >= 0
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-rose-100 text-rose-800 border-rose-200"
                  }`}
                >
                  {fmData.todayVariance >= 0
                    ? `+${fmData.todayVariance}`
                    : `${fmData.todayVariance}`}{" "}
                  vs Target ({fmData.todayTarget})
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Month-to-Date Output
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {fmData.mtdActual.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-400">pcs</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono font-medium">
                Target: {fmData.mtdTarget.toLocaleString()} pcs
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Today&apos;s Losses (Rew / Rej / Scrap)
              </span>
              <div className="text-2xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                <span className="text-amber-600">{fmData.todayRework}</span> /{" "}
                <span className="text-rose-600">{fmData.todayReject}</span> /{" "}
                <span className="text-slate-500">{fmData.todayScrap}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono">
                MTD: {fmData.mtdRework} rew, {fmData.mtdReject} rej
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Current Work-in-Progress (WIP)
              </span>
              <div className="text-3xl font-black text-indigo-600 mt-2 font-mono tabular-nums">
                {fmData.todayWip.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-400">pcs</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">
                Active units in line queues
              </p>
            </div>
          </div>

          {/* Today's Line-by-Line Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Today&apos;s Line Production Breakdown ({fmData.todayStr})
                </h2>
                <p className="text-xs text-slate-500">
                  Detailed entries submitted for today
                </p>
              </div>
              <Link
                href="/entry"
                className="btn btn-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-xl font-bold"
              >
                Go to Entry Grid
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              {fmData.lineBreakdowns.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No production numbers submitted for today yet.{" "}
                  <Link href="/entry" className="text-indigo-600 font-bold underline">
                    Enter today&apos;s report now.
                  </Link>
                </div>
              ) : (
                <table className="table w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs font-extrabold uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                      <th>Line</th>
                      <th>Product</th>
                      <th>Finished Good</th>
                      <th>Rework</th>
                      <th>Reject</th>
                      <th>Scrap</th>
                      <th>WIP</th>
                      <th>Downtime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fmData.lineBreakdowns.map((row: any) => (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="font-bold text-slate-900">{row.lineName}</td>
                        <td>
                          <span className="font-medium text-slate-800">{row.productName}</span>{" "}
                          <span className="text-xs font-mono text-slate-400">({row.productSku})</span>
                        </td>
                        <td className="font-black text-emerald-700 font-mono tabular-nums">
                          {row.finishedGood.toLocaleString()}
                        </td>
                        <td className="text-amber-700 font-mono font-bold">{row.rework}</td>
                        <td className="text-rose-700 font-mono font-bold">{row.reject}</td>
                        <td className="text-slate-500 font-mono">{row.scrap}</td>
                        <td className="font-mono text-indigo-600 font-bold">{row.wip}</td>
                        <td className="text-slate-500 font-mono">{row.downtimeMinutes}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* ------------------------------------------------------------- */}
      {/* 4. QA INSPECTOR DASHBOARD                                     */}
      {/* ------------------------------------------------------------- */}
      {user.role === "qa" && qaData && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Today&apos;s Defect Rate
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {qaData.defectRate}%
              </div>
              <span
                className={`badge badge-sm font-bold mt-2 ${
                  qaData.defectRate === 0
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : qaData.defectRate <= 2.5
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-rose-100 text-rose-800 border-rose-200"
                }`}
              >
                {qaData.defectRate <= 2.5 ? "Quality within spec" : "Action required"}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Inspections Logged Today
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {qaData.inspectionCount}
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">Audit batches completed</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Total Samples Checked
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2 font-mono tabular-nums">
                {qaData.totalChecked.toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">Units audited</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Defective Units Found
              </span>
              <div className="text-3xl font-black text-rose-600 mt-2 font-mono tabular-nums">
                {qaData.totalDefects}
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">Failed quality audit</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Today&apos;s Quality Inspection Reports
                </h2>
                <p className="text-xs text-slate-500">
                  Sample records submitted on {qaData.todayStr}
                </p>
              </div>
              <Link
                href="/qa"
                className="btn btn-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-xl font-bold"
              >
                New Inspection Form
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              {((qaData as any).recentInspections || (qaData as any).inspections || []).length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No inspections logged yet today.{" "}
                  <Link href="/qa" className="text-indigo-600 font-bold underline">
                    Log an inspection now.
                  </Link>
                </div>
              ) : (
                <table className="table w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs font-extrabold uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                      <th>Time</th>
                      <th>Product</th>
                      <th>Line</th>
                      <th>Checked</th>
                      <th>Defects</th>
                      <th>Defect Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {((qaData as any).recentInspections || (qaData as any).inspections || []).map((insp: any) => {
                      const rate =
                        insp.checked > 0
                          ? Math.round((insp.defects / insp.checked) * 1000) / 10
                          : 0;
                      return (
                        <tr key={insp.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="text-xs text-slate-400 font-mono">
                            {new Date(insp.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="font-bold text-slate-900">{insp.productName}</td>
                          <td className="text-slate-700 font-medium">{insp.lineName}</td>
                          <td className="font-mono text-slate-800 font-semibold">{insp.checked}</td>
                          <td className="font-mono text-rose-600 font-bold">{insp.defects}</td>
                          <td>
                            <span
                              className={`badge badge-sm font-mono font-bold ${
                                rate === 0
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : rate <= 2.5
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-rose-100 text-rose-800 border-rose-200"
                              }`}
                            >
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
