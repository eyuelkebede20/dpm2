"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, subDays, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  Command,
  X,
} from "lucide-react";
import { StepperInput } from "@/components/ui/stepper-input";
import { calculateDailyTarget, calculateVariance } from "@/lib/target";
import { saveDailyReportEntryAction } from "@/actions/report-actions";
import {
  EthiopianDate,
  ETH_MONTH_NAMES_AM,
  ETH_MONTH_NAMES_EN,
  gregorianToEth,
  ethToGregorian,
  formatEthDate,
  daysInMonthEth,
} from "@/lib/ethiopian-calendar";

export interface GridRowData {
  lineId: string;
  lineName: string;
  productId: string;
  productName: string;
  sku: string;
  plan: {
    startDate: string;
    endDate: string;
    plannedQty: number;
  } | null;
  entry: {
    finishedGood: number;
    rework: number;
    reject: number;
    scrap: number;
    wip: number;
    downtimeMinutes: number;
    issueNote: string | null;
  };
}

interface DailyEntryClientProps {
  initialDate: string;
  factoryId: string;
  factoryName: string;
  workingDays: number[];
  initialRows: GridRowData[];
  userRole: string;
  calendarSystem?: string;
}

export function DailyEntryClient({
  initialDate,
  factoryId,
  factoryName,
  workingDays,
  initialRows,
  userRole,
  calendarSystem,
}: DailyEntryClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [rows, setRows] = useState<GridRowData[]>(initialRows);
  const [initialSnapshot, setInitialSnapshot] = useState<string>(
    JSON.stringify(initialRows)
  );
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Ethiopian date resolution & quick selector state
  const isEth = (calendarSystem || "ethiopian") === "ethiopian";
  const ethDate = useMemo(() => {
    try {
      return gregorianToEth(selectedDate);
    } catch {
      return null;
    }
  }, [selectedDate]);

  const [showEthPicker, setShowEthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(ethDate?.year || 2017);
  const [pickerMonth, setPickerMonth] = useState<number>(ethDate?.month || 2);
  const [pickerDay, setPickerDay] = useState<number>(ethDate?.day || 1);

  useEffect(() => {
    if (ethDate) {
      setPickerYear(ethDate.year);
      setPickerMonth(ethDate.month);
      setPickerDay(ethDate.day);
    }
  }, [ethDate]);

  const handleApplyEthDate = (y: number, m: number, d: number) => {
    try {
      const maxDays = daysInMonthEth(y, m);
      const safeDay = Math.min(Math.max(1, d), maxDays);
      const gregIso = ethToGregorian(y, m, safeDay);
      handleDateChange(gregIso);
      setShowEthPicker(false);
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Invalid Ethiopian date",
      });
    }
  };

  // Sync state if initialRows changes from server navigation
  useEffect(() => {
    setRows(initialRows);
    setInitialSnapshot(JSON.stringify(initialRows));
    setSelectedDate(initialDate);
  }, [initialRows, initialDate]);

  // Check if modified
  const isDirty = JSON.stringify(rows) !== initialSnapshot;

  // Modified row count
  const modifiedRowCount = useMemo(() => {
    try {
      const orig: GridRowData[] = JSON.parse(initialSnapshot);
      let count = 0;
      rows.forEach((r, idx) => {
        if (JSON.stringify(r.entry) !== JSON.stringify(orig[idx]?.entry)) {
          count++;
        }
      });
      return count;
    } catch {
      return 0;
    }
  }, [rows, initialSnapshot]);

  // Unsaved changes browser warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleSaveAllRef = useRef<() => void>(() => {});

  // Global Ctrl+S / Cmd+S shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isPending) {
          handleSaveAllRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isPending]);

  const handleDateChange = (newDateStr: string) => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        "You have unsaved production entries. Leave without saving?"
      );
      if (!confirmLeave) return;
    }
    router.push(`/entry?date=${newDateStr}`);
  };

  const updateRowField = (
    index: number,
    field: keyof GridRowData["entry"],
    value: any
  ) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        entry: {
          ...copy[index].entry,
          [field]: value,
        },
      };
      return copy;
    });
  };

  const handleReset = () => {
    setRows(JSON.parse(initialSnapshot));
    setToast(null);
  };

  const handleSaveAll = async () => {
    startTransition(async () => {
      let savedCount = 0;
      let errorMsg = null;

      for (const row of rows) {
        const res = await saveDailyReportEntryAction({
          date: selectedDate,
          lineId: row.lineId,
          productId: row.productId,
          finishedGood: row.entry.finishedGood,
          rework: row.entry.rework,
          reject: row.entry.reject,
          scrap: row.entry.scrap,
          wip: row.entry.wip,
          downtimeMinutes: row.entry.downtimeMinutes,
          issueNote: row.entry.issueNote || null,
        });

        if (res.success) {
          savedCount++;
        } else {
          errorMsg = res.error || "Failed to save entry";
          break;
        }
      }

      if (errorMsg) {
        setToast({ type: "error", message: errorMsg });
      } else {
        setToast({
          type: "success",
          message: `Saved ${savedCount} lines successfully. Store stock ledger synchronized.`,
        });
        setInitialSnapshot(JSON.stringify(rows));
        router.refresh();
      }

      setTimeout(() => setToast(null), 4000);
    });
  };
  handleSaveAllRef.current = handleSaveAll;

  // Aggregated totals
  let totalFG = 0;
  let totalTarget = 0;
  let hasAnyTarget = false;
  let totalRework = 0;
  let totalReject = 0;
  let totalScrap = 0;
  let totalWIP = 0;
  let totalDowntime = 0;

  rows.forEach((r) => {
    totalFG += r.entry.finishedGood || 0;
    totalRework += r.entry.rework || 0;
    totalReject += r.entry.reject || 0;
    totalScrap += r.entry.scrap || 0;
    totalWIP += r.entry.wip || 0;
    totalDowntime += r.entry.downtimeMinutes || 0;

    const targetRes = calculateDailyTarget(r.plan, selectedDate, workingDays);
    if (targetRes.hasTarget) {
      totalTarget += targetRes.dailyTarget;
      hasAnyTarget = true;
    }
  });

  const netVariance = hasAnyTarget ? totalFG - totalTarget : 0;
  const netVarianceFormatted =
    netVariance > 0
      ? `+${Math.round(netVariance)}`
      : `${Math.round(netVariance)}`;

  const totalFallout = totalReject + totalScrap;
  const netGoodOutput = Math.max(0, totalFG - totalFallout);
  const yieldPct =
    totalFG > 0 ? Math.round((netGoodOutput / totalFG) * 1000) / 10 : 100;

  const parsedDate = parseISO(selectedDate);
  const formattedFriendlyDate = format(parsedDate, "EEEE, MMMM d, yyyy");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-36">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>{factoryName}</span>
            <span>•</span>
            <span className="text-indigo-600 font-extrabold">
              Fast Production Grid
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Production Entry & Tracking
          </h1>
          {isEth && ethDate ? (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="badge badge-neutral text-xs font-bold px-2.5 py-1 rounded-lg">
                🇪🇹 {formatEthDate(ethDate, "full_am")}
              </span>
              <span className="text-xs text-slate-600 font-semibold">
                {formatEthDate(ethDate, "full_en")}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-400 font-mono">
                GC: {formattedFriendlyDate}
              </span>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {formattedFriendlyDate}
            </p>
          )}
        </div>

        {/* Date Selector & Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* View Mode Switcher */}
          <div className="join bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 ${
                viewMode === "cards"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Card View (Mobile Optimized)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          {/* Date Selector Bar */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            {isEth && ethDate && (
              <button
                type="button"
                onClick={() => setShowEthPicker(true)}
                className="btn btn-xs sm:btn-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold gap-1 px-2.5 mr-0.5"
                title="ቀን ምረጥ / Select Ethiopian Date"
              >
                <span>🇪🇹</span>
                <span>
                  {ethDate.day} {ETH_MONTH_NAMES_AM[ethDate.month]} {ethDate.year}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                handleDateChange(
                  format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd")
                )
              }
              className="btn btn-sm btn-ghost px-2 text-slate-600 hover:text-slate-900"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="text-xs sm:text-sm font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                handleDateChange(
                  format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd")
                )
              }
              className="btn btn-sm btn-ghost px-2 text-slate-600 hover:text-slate-900"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                handleDateChange(
                  format(subDays(new Date(), 1), "yyyy-MM-dd")
                )
              }
              className="btn btn-xs btn-ghost text-slate-600 rounded-lg text-[11px] font-bold"
            >
              Yest
            </button>

            <button
              type="button"
              onClick={() => handleDateChange(format(new Date(), "yyyy-MM-dd"))}
              className="btn btn-xs btn-outline btn-neutral rounded-lg text-[11px] font-bold"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
        <div className="card bg-white border border-slate-200/90 shadow-2xs p-4 rounded-2xl">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Total Finished Good
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
              {totalFG.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400">pcs</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Net Good: <b className="font-mono text-slate-700">{netGoodOutput}</b> ({yieldPct}%)
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-4 rounded-2xl">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Target & Variance
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
              {hasAnyTarget
                ? Math.round(totalTarget).toLocaleString()
                : "No Target"}
            </span>
            {hasAnyTarget && (
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  netVariance >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {netVariance >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {netVarianceFormatted}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {hasAnyTarget
              ? `${Math.round((totalFG / (totalTarget || 1)) * 100)}% of daily target`
              : "No active plans today"}
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-4 rounded-2xl">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Quality Fallout
          </span>
          <div className="flex items-baseline gap-2 mt-1 text-slate-700">
            <span className="text-xs sm:text-sm font-semibold">
              Rew: <b className="font-mono text-slate-900">{totalRework}</b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs sm:text-sm font-semibold">
              Rej: <b className="font-mono text-rose-600">{totalReject}</b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs sm:text-sm font-semibold">
              Scrap: <b className="font-mono text-amber-600">{totalScrap}</b>
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total non-conforming: <b className="font-mono">{totalRework + totalFallout}</b>
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-4 rounded-2xl">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            WIP & Downtime
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              WIP: <b className="font-mono text-slate-900">{totalWIP}</b>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              Down:{" "}
              <b
                className={`font-mono ${
                  totalDowntime > 0 ? "text-amber-600 font-bold" : "text-slate-900"
                }`}
              >
                {totalDowntime}m
              </b>
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalDowntime > 0
              ? `${(totalDowntime / 60).toFixed(1)} hrs lost`
              : "Zero line stoppages"}
          </div>
        </div>
      </div>

      {/* Entry Grid - Table View */}
      {viewMode === "table" ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">
                Active Production Lines & Products ({rows.length})
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                • Frozen line column • Tab/Enter jumps field • Ctrl+S to save
              </span>
            </div>
            {isDirty && (
              <span className="badge badge-warning text-xs font-bold gap-1 shadow-2xs">
                ● {modifiedRowCount} {modifiedRowCount === 1 ? "line" : "lines"} modified
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 min-w-[210px] sticky left-0 bg-slate-100 z-20 sticky-col-shadow">
                    Line & Product
                  </th>
                  <th className="py-3 px-3 min-w-[120px]">Target</th>
                  <th className="py-3 px-3 min-w-[170px] bg-indigo-50/50 text-indigo-900 font-extrabold">
                    Finished Good
                  </th>
                  <th className="py-3 px-3 min-w-[110px]">Variance</th>
                  <th className="py-3 px-3 min-w-[140px]">Rework</th>
                  <th className="py-3 px-3 min-w-[140px]">Reject</th>
                  <th className="py-3 px-3 min-w-[140px]">Scrap</th>
                  <th className="py-3 px-3 min-w-[140px]">WIP</th>
                  <th className="py-3 px-3 min-w-[140px]">Downtime (min)</th>
                  <th className="py-3 px-4 min-w-[220px]">Issue Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No active lines or products configured for this factory.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const targetRes = calculateDailyTarget(
                      row.plan,
                      selectedDate,
                      workingDays
                    );
                    const varianceRes = targetRes.hasTarget
                      ? calculateVariance(
                          row.entry.finishedGood,
                          targetRes.dailyTarget
                        )
                      : null;

                    return (
                      <tr
                        key={`${row.lineId}_${row.productId}`}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Frozen Line & Product Column */}
                        <td className="py-3 px-4 sticky left-0 bg-white z-10 sticky-col-shadow">
                          <div className="font-bold text-slate-900">
                            {row.lineName}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-medium text-slate-700">
                              {row.productName}
                            </span>
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-600 border border-slate-200/50">
                              {row.sku}
                            </span>
                          </div>
                        </td>

                        {/* Daily Target */}
                        <td className="py-3 px-3">
                          {targetRes.hasTarget ? (
                            <div>
                              <span className="font-mono font-bold tabular-nums text-slate-900">
                                {targetRes.displayTarget.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Plan: {row.plan?.plannedQty.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              {targetRes.reason === "non_working_day"
                                ? "Day Off"
                                : "No plan"}
                            </span>
                          )}
                        </td>

                        {/* Finished Good (Primary Entry) */}
                        <td className="py-3 px-3 bg-indigo-50/20">
                          <StepperInput
                            value={row.entry.finishedGood}
                            onChange={(val) =>
                              updateRowField(idx, "finishedGood", val)
                            }
                            quickAdds={[1, 5, 10, 50]}
                            className="w-36"
                          />
                        </td>

                        {/* Live Variance */}
                        <td className="py-3 px-3">
                          {varianceRes ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <span
                                className={`text-xs font-black font-mono tabular-nums px-2 py-0.5 rounded-md ${
                                  varianceRes.isPositive
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : "bg-rose-100 text-rose-800 border border-rose-200"
                                }`}
                              >
                                {varianceRes.varianceFormatted}
                              </span>
                              {varianceRes.percentOfTarget !== null && (
                                <span className="text-[10px] font-bold text-slate-400">
                                  {varianceRes.percentOfTarget}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-xs">
                              −
                            </span>
                          )}
                        </td>

                        {/* Rework */}
                        <td className="py-3 px-3">
                          <StepperInput
                            value={row.entry.rework}
                            onChange={(val) =>
                              updateRowField(idx, "rework", val)
                            }
                            quickAdds={[1, 5]}
                            className="w-28"
                          />
                        </td>

                        {/* Reject */}
                        <td className="py-3 px-3">
                          <StepperInput
                            value={row.entry.reject}
                            onChange={(val) =>
                              updateRowField(idx, "reject", val)
                            }
                            quickAdds={[1, 5]}
                            className="w-28"
                          />
                        </td>

                        {/* Scrap */}
                        <td className="py-3 px-3">
                          <StepperInput
                            value={row.entry.scrap}
                            onChange={(val) =>
                              updateRowField(idx, "scrap", val)
                            }
                            quickAdds={[1, 5]}
                            className="w-28"
                          />
                        </td>

                        {/* WIP */}
                        <td className="py-3 px-3">
                          <StepperInput
                            value={row.entry.wip}
                            onChange={(val) => updateRowField(idx, "wip", val)}
                            quickAdds={[5, 10, 25]}
                            className="w-28"
                          />
                        </td>

                        {/* Downtime (min) */}
                        <td className="py-3 px-3">
                          <StepperInput
                            value={row.entry.downtimeMinutes}
                            onChange={(val) =>
                              updateRowField(idx, "downtimeMinutes", val)
                            }
                            quickAdds={[5, 15, 30]}
                            className="w-28"
                          />
                        </td>

                        {/* Issue Notes */}
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="Note stoppage or quality issue..."
                            value={row.entry.issueNote || ""}
                            onChange={(e) =>
                              updateRowField(idx, "issueNote", e.target.value)
                            }
                            className="input input-sm input-bordered w-full text-xs placeholder:text-slate-400 rounded-xl focus:outline-hidden focus:border-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Mobile Card View Mode */
        <div className="space-y-4">
          {rows.map((row, idx) => {
            const targetRes = calculateDailyTarget(
              row.plan,
              selectedDate,
              workingDays
            );
            const varianceRes = targetRes.hasTarget
              ? calculateVariance(
                  row.entry.finishedGood,
                  targetRes.dailyTarget
                )
              : null;

            return (
              <div
                key={`card_${row.lineId}_${row.productId}`}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <div className="font-extrabold text-base text-slate-900">
                      {row.lineName}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-semibold text-slate-700">
                        {row.productName}
                      </span>
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-600">
                        {row.sku}
                      </span>
                    </div>
                  </div>

                  {/* Target & Variance Pill */}
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">
                      Target: {targetRes.hasTarget ? targetRes.displayTarget : "None"}
                    </span>
                    {varianceRes && (
                      <span
                        className={`text-xs font-black font-mono px-2 py-0.5 rounded-md inline-block mt-1 ${
                          varianceRes.isPositive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {varianceRes.varianceFormatted}
                      </span>
                    )}
                  </div>
                </div>

                {/* Steppers Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-indigo-50/30 p-2.5 rounded-xl border border-indigo-100">
                    <label className="text-[11px] font-extrabold text-indigo-900 uppercase block mb-1">
                      Finished Good
                    </label>
                    <StepperInput
                      value={row.entry.finishedGood}
                      onChange={(val) => updateRowField(idx, "finishedGood", val)}
                      quickAdds={[1, 5, 10]}
                    />
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">
                      Rework
                    </label>
                    <StepperInput
                      value={row.entry.rework}
                      onChange={(val) => updateRowField(idx, "rework", val)}
                      quickAdds={[1, 5]}
                    />
                  </div>

                  <div className="bg-rose-50/40 p-2.5 rounded-xl border border-rose-100">
                    <label className="text-[11px] font-extrabold text-rose-800 uppercase block mb-1">
                      Reject
                    </label>
                    <StepperInput
                      value={row.entry.reject}
                      onChange={(val) => updateRowField(idx, "reject", val)}
                      quickAdds={[1, 5]}
                    />
                  </div>

                  <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-100">
                    <label className="text-[11px] font-extrabold text-amber-800 uppercase block mb-1">
                      Scrap
                    </label>
                    <StepperInput
                      value={row.entry.scrap}
                      onChange={(val) => updateRowField(idx, "scrap", val)}
                      quickAdds={[1, 5]}
                    />
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">
                      WIP
                    </label>
                    <StepperInput
                      value={row.entry.wip}
                      onChange={(val) => updateRowField(idx, "wip", val)}
                      quickAdds={[5, 10]}
                    />
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1">
                      Downtime (min)
                    </label>
                    <StepperInput
                      value={row.entry.downtimeMinutes}
                      onChange={(val) =>
                        updateRowField(idx, "downtimeMinutes", val)
                      }
                      quickAdds={[5, 15]}
                    />
                  </div>
                </div>

                {/* Issue Note */}
                <div>
                  <input
                    type="text"
                    placeholder="Add issue note or stoppage remark..."
                    value={row.entry.issueNote || ""}
                    onChange={(e) =>
                      updateRowField(idx, "issueNote", e.target.value)
                    }
                    className="input input-sm input-bordered w-full text-xs rounded-xl"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div className="toast toast-top toast-end z-50">
          <div
            className={`alert ${
              toast.type === "success" ? "alert-success" : "alert-error"
            } shadow-lg text-white font-medium text-sm flex items-center justify-between gap-3 rounded-2xl`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <AlertCircle className="w-5 h-5 text-white" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="btn btn-ghost btn-xs btn-circle text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-3 shadow-xl pb-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              Date:{" "}
              {isEth && ethDate ? (
                <>
                  <b className="text-slate-900 font-bold">
                    {formatEthDate(ethDate, "full_am")}
                  </b>
                  <span className="text-xs text-slate-400 font-mono ml-1.5 hidden md:inline">
                    ({selectedDate} GC)
                  </span>
                </>
              ) : (
                <b className="text-slate-900 font-mono">{selectedDate}</b>
              )}
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              Total FG:{" "}
              <b className="text-indigo-600 font-mono font-black tabular-nums">
                {totalFG.toLocaleString()}
              </b>
            </span>
            {isDirty && (
              <span className="badge badge-warning badge-sm font-bold shadow-2xs">
                {modifiedRowCount} modified
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isDirty && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="btn btn-sm btn-ghost text-slate-500 hover:text-slate-800 rounded-xl"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isPending || !isDirty}
              className={`btn btn-sm sm:btn-md px-5 sm:px-7 rounded-2xl font-black shadow-md transition-all flex items-center gap-2 ${
                isDirty
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white border-none active:scale-95"
                  : "btn-disabled opacity-40 bg-slate-200 text-slate-400 border-none"
              }`}
            >
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Save Daily Numbers</span>
                  <span className="hidden lg:inline-flex items-center text-[10px] bg-indigo-700/60 px-1.5 py-0.5 rounded font-mono text-indigo-100">
                    Ctrl+S
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Ethiopian Date Picker Modal */}
      {showEthPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🇪🇹</span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    ቀን ምረጥ (Select Ethiopian Date)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    13-Month Ethiopian Production Calendar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEthPicker(false)}
                className="btn btn-ghost btn-sm btn-circle text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Year & Month Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  ዓመት (Year)
                </label>
                <select
                  value={pickerYear}
                  onChange={(e) => setPickerYear(Number(e.target.value))}
                  className="select select-bordered select-sm w-full font-bold text-slate-800 rounded-xl"
                >
                  {[2014, 2015, 2016, 2017, 2018, 2019, 2020].map((y) => (
                    <option key={y} value={y}>
                      {y} ዓ.ም
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  ወር (Month)
                </label>
                <select
                  value={pickerMonth}
                  onChange={(e) => setPickerMonth(Number(e.target.value))}
                  className="select select-bordered select-sm w-full font-bold text-slate-800 rounded-xl"
                >
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}. {ETH_MONTH_NAMES_AM[m]} ({ETH_MONTH_NAMES_EN[m]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Day Selection Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-600">
                  ቀን (Day: 1 - {daysInMonthEth(pickerYear, pickerMonth)})
                </label>
                <span className="text-xs font-extrabold text-indigo-600">
                  ተመርጧል: {pickerDay}
                </span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-100">
                {Array.from(
                  { length: daysInMonthEth(pickerYear, pickerMonth) },
                  (_, i) => i + 1
                ).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPickerDay(d)}
                    className={`btn btn-xs rounded-lg font-mono font-bold ${
                      pickerDay === d
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "btn-ghost text-slate-700 hover:bg-white"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  try {
                    const todayEth = gregorianToEth(new Date());
                    setPickerYear(todayEth.year);
                    setPickerMonth(todayEth.month);
                    setPickerDay(todayEth.day);
                  } catch {}
                }}
                className="btn btn-xs btn-ghost text-slate-500 font-bold"
              >
                ዛሬ (Today)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEthPicker(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyEthDate(pickerYear, pickerMonth, pickerDay)
                  }
                  className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-4"
                >
                  አረጋግጥ (Apply)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
