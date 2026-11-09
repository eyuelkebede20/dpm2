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
  X,
  Boxes,
} from "lucide-react";
import { StepperInput } from "@/components/ui/stepper-input";
import { LineTallyVisualizer } from "./line-tally-visualizer";
import { calculateDailyTarget, calculateVariance } from "@/lib/target";
import { saveDailyReportEntryAction } from "@/actions/report-actions";
import {
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
    weeklyPlanned?: number;
    priorFinishedGood?: number;
    cumulativeProduced?: number;
    leftFromWeeklyPlanned?: number;
    dailyTarget?: number;
  } | null;
  entry: {
    finishedGood: number;
    rework: number;
    reject: number;
    scrap: number;
    wip: number;
    downtimeMinutes: number;
    issueNote: string | null;
    downtimeReasonId?: string | null;
  };
}

export interface DowntimeReasonTemplate {
  id: string;
  code: string;
  nameEn: string;
  nameAm?: string | null;
  category: string;
}

export interface SpecialDayInfo {
  nameEn: string;
  nameAm?: string | null;
  isWorkingDay: boolean;
  type: string;
}

interface DailyEntryClientProps {
  initialDate: string;
  factoryId: string;
  factoryName?: string;
  workingDays: number[];
  initialRows: GridRowData[];
  userRole: string;
  calendarSystem?: string;
  specialDay?: SpecialDayInfo | null;
  downtimeReasons?: DowntimeReasonTemplate[];
}

export function DailyEntryClient({
  initialDate,
  factoryId,
  factoryName = "Plant",
  workingDays,
  initialRows,
  userRole,
  calendarSystem,
  specialDay,
  downtimeReasons = [],
}: DailyEntryClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const isNextDayDisabled = selectedDate >= todayStr;
  const [rows, setRows] = useState<GridRowData[]>(initialRows);
  const [initialSnapshot, setInitialSnapshot] = useState<string>(
    JSON.stringify(initialRows)
  );
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
  const [groupMode, setGroupMode] = useState<"product" | "line">("product");
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
      if (gregIso > todayStr) {
        setToast({
          type: "error",
          message: "Cannot select future dates. Production entries are disabled for future dates.",
        });
        return;
      }
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

  const specialDaysList = useMemo(() => {
    if (!specialDay) return undefined;
    return [
      {
        date: selectedDate,
        isWorkingDay: specialDay.isWorkingDay,
        nameEn: specialDay.nameEn,
        nameAm: specialDay.nameAm,
      },
    ];
  }, [specialDay, selectedDate]);

  const handleSelectDowntimeReason = (idx: number, reasonId: string) => {
    if (!reasonId) {
      setRows((prev) => {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          entry: {
            ...copy[idx].entry,
            downtimeReasonId: null,
          },
        };
        return copy;
      });
      return;
    }

    const reason = downtimeReasons.find((r) => r.id === reasonId);
    if (!reason) return;

    const prefix = `[${reason.code}: ${reason.nameEn}]`;
    const currentNote = rows[idx]?.entry?.issueNote || "";

    let newNote = "";
    const existingPrefixRegex = /^\[[A-Za-z0-9-_]+:\s*[^\]]+\]\s*/;
    if (existingPrefixRegex.test(currentNote)) {
      const rest = currentNote.replace(existingPrefixRegex, "").trim();
      newNote = rest ? `${prefix} ${rest}` : `${prefix} `;
    } else if (currentNote.trim()) {
      newNote = `${prefix} ${currentNote.trim()}`;
    } else {
      newNote = `${prefix} `;
    }

    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        entry: {
          ...copy[idx].entry,
          issueNote: newNote,
          downtimeReasonId: reason.id,
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
    if (selectedDate > todayStr) {
      setToast({
        type: "error",
        message: "Cannot record production entries for future dates.",
      });
      return;
    }
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
          downtimeReasonId: row.entry.downtimeReasonId || null,
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

  // Available unique products in factory
  const availableProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku: string }>();
    rows.forEach((r) => {
      if (!map.has(r.productId)) {
        map.set(r.productId, { id: r.productId, name: r.productName, sku: r.sku });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Product performance breakdown for today
  const productSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        totalFG: number;
        totalTarget: number;
        hasTarget: boolean;
        netVariance: number;
        totalRework: number;
        totalReject: number;
        totalScrap: number;
        totalWIP: number;
        totalDowntime: number;
        linesCount: number;
      }
    >();

    rows.forEach((r) => {
      const existing = map.get(r.productId) || {
        productId: r.productId,
        productName: r.productName,
        sku: r.sku,
        totalFG: 0,
        totalTarget: 0,
        hasTarget: false,
        netVariance: 0,
        totalRework: 0,
        totalReject: 0,
        totalScrap: 0,
        totalWIP: 0,
        totalDowntime: 0,
        linesCount: 0,
      };

      existing.totalFG += r.entry.finishedGood || 0;
      existing.totalRework += r.entry.rework || 0;
      existing.totalReject += r.entry.reject || 0;
      existing.totalScrap += r.entry.scrap || 0;
      existing.totalWIP += r.entry.wip || 0;
      existing.totalDowntime += r.entry.downtimeMinutes || 0;
      existing.linesCount += 1;

      const targetRes = calculateDailyTarget(
        r.plan,
        selectedDate,
        workingDays,
        specialDaysList
      );
      if (targetRes.hasTarget) {
        existing.totalTarget += targetRes.dailyTarget;
        existing.hasTarget = true;
      }

      existing.netVariance = existing.hasTarget ? existing.totalFG - existing.totalTarget : 0;
      map.set(r.productId, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [rows, selectedDate, workingDays, specialDaysList]);

  // Filtered rows based on selected product
  const displayedRows = useMemo(() => {
    if (selectedProductFilter === "all") return rows;
    return rows.filter((r) => r.productId === selectedProductFilter);
  }, [rows, selectedProductFilter]);

  // Rows grouped by product for "By Product" display mode
  const productGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        product: { id: string; name: string; sku: string };
        summary: (typeof productSummaries)[0];
        items: { row: GridRowData; globalIndex: number }[];
      }
    >();

    rows.forEach((row, globalIndex) => {
      if (selectedProductFilter !== "all" && row.productId !== selectedProductFilter) {
        return;
      }

      if (!groups.has(row.productId)) {
        const sum = productSummaries.find((s) => s.productId === row.productId) || {
          productId: row.productId,
          productName: row.productName,
          sku: row.sku,
          totalFG: 0,
          totalTarget: 0,
          hasTarget: false,
          netVariance: 0,
          totalRework: 0,
          totalReject: 0,
          totalScrap: 0,
          totalWIP: 0,
          totalDowntime: 0,
          linesCount: 0,
        };

        groups.set(row.productId, {
          product: { id: row.productId, name: row.productName, sku: row.sku },
          summary: sum,
          items: [],
        });
      }

      groups.get(row.productId)!.items.push({ row, globalIndex });
    });

    return Array.from(groups.values());
  }, [rows, selectedProductFilter, productSummaries]);

  // Aggregated totals (reflects filtered rows when a product is selected)
  let totalFG = 0;
  let totalTarget = 0;
  let hasAnyTarget = false;
  let totalRework = 0;
  let totalReject = 0;
  let totalScrap = 0;
  let totalWIP = 0;
  let totalDowntime = 0;

  displayedRows.forEach((r) => {
    totalFG += r.entry.finishedGood || 0;
    totalRework += r.entry.rework || 0;
    totalReject += r.entry.reject || 0;
    totalScrap += r.entry.scrap || 0;
    totalWIP += r.entry.wip || 0;
    totalDowntime += r.entry.downtimeMinutes || 0;

    const targetRes = calculateDailyTarget(
      r.plan,
      selectedDate,
      workingDays,
      specialDaysList
    );
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

  const hasWeeklyPlan = useMemo(() => {
    return rows.some((r) => r.plan?.weeklyPlanned !== undefined);
  }, [rows]);

  const renderTableRow = (row: GridRowData, globalIndex: number) => {
    const targetRes = calculateDailyTarget(
      row.plan,
      selectedDate,
      workingDays,
      specialDaysList
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
          <div className="font-bold text-slate-900 leading-relaxed truncate max-w-[200px] sm:max-w-none">
            {row.lineName}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 leading-relaxed flex-wrap">
            <span className="font-medium text-slate-700 truncate max-w-[150px] sm:max-w-none">
              {row.productName}
            </span>
            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-600 border border-slate-200/50">
              {row.sku}
            </span>
          </div>
        </td>

        {/* Weekly Planned */}
        <td className="py-3 px-3">
          {row.plan?.weeklyPlanned !== undefined ? (
            <span className="font-mono font-bold tabular-nums text-slate-900">
              {row.plan.weeklyPlanned.toLocaleString()}
            </span>
          ) : (
            <span className="text-slate-300 font-mono text-xs">—</span>
          )}
        </td>

        {/* Left from Weekly Planned */}
        <td className="py-3 px-3">
          {row.plan?.weeklyPlanned !== undefined ? (
            (() => {
              const totalProduced =
                (row.plan.priorFinishedGood || 0) + row.entry.finishedGood;
              const left = Math.max(0, row.plan.weeklyPlanned - totalProduced);
              return (
                <div className="flex flex-col items-start gap-0.5 font-mono">
                  <span className="font-black tabular-nums text-slate-900 text-xs">
                    {left.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold tabular-nums">
                    {totalProduced.toLocaleString()} produced
                  </span>
                </div>
              );
            })()
          ) : (
            <span className="text-slate-300 font-mono text-xs">—</span>
          )}
        </td>

        {/* Daily Target */}
        <td className="py-3 px-3">
          {targetRes.hasTarget ? (
            <div>
              <span className="font-mono font-bold tabular-nums text-slate-900">
                {targetRes.displayTarget.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono tabular-nums">
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
        <td className="py-3 px-3 bg-emerald-50/20">
          <StepperInput
            value={row.entry.finishedGood}
            onChange={(val) =>
              updateRowField(globalIndex, "finishedGood", val)
            }
            quickAdds={[1, 5, 10, 50]}
            themeColor="emerald"
            size="md"
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
                <span className="text-[10px] font-bold font-mono tabular-nums text-slate-400">
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
              updateRowField(globalIndex, "rework", val)
            }
            quickAdds={[1, 5]}
            themeColor="slate"
            size="md"
            className="w-28"
          />
        </td>

        {/* Reject */}
        <td className="py-3 px-3">
          <StepperInput
            value={row.entry.reject}
            onChange={(val) =>
              updateRowField(globalIndex, "reject", val)
            }
            quickAdds={[1, 5]}
            themeColor="rose"
            size="md"
            className="w-28"
          />
        </td>

        {/* Scrap */}
        <td className="py-3 px-3">
          <StepperInput
            value={row.entry.scrap}
            onChange={(val) =>
              updateRowField(globalIndex, "scrap", val)
            }
            quickAdds={[1, 5]}
            themeColor="amber"
            size="md"
            className="w-28"
          />
        </td>

        {/* WIP */}
        <td className="py-3 px-3">
          <StepperInput
            value={row.entry.wip}
            onChange={(val) => updateRowField(globalIndex, "wip", val)}
            quickAdds={[5, 10, 25]}
            themeColor="blue"
            size="md"
            className="w-28"
          />
        </td>

        {/* Downtime (min) */}
        <td className="py-3 px-3">
          <StepperInput
            value={row.entry.downtimeMinutes}
            onChange={(val) =>
              updateRowField(globalIndex, "downtimeMinutes", val)
            }
            quickAdds={[5, 15, 30]}
            themeColor="amber"
            size="md"
            className="w-28"
          />
        </td>

        {/* Issue Notes */}
        <td className="py-3 px-4 min-w-[280px]">
          <div className="space-y-1.5">
            <input
              type="text"
              placeholder="Note stoppage or quality issue..."
              value={row.entry.issueNote || ""}
              onChange={(e) =>
                updateRowField(globalIndex, "issueNote", e.target.value)
              }
              className="input input-sm input-bordered w-full text-xs placeholder:text-slate-400 rounded-xl focus:outline-hidden focus:border-indigo-500 leading-relaxed"
            />
            {downtimeReasons && downtimeReasons.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <label
                  htmlFor={`downtime-template-${globalIndex}`}
                  className="text-[10px] font-bold text-slate-500 whitespace-nowrap leading-relaxed"
                >
                  OM Reason Template (የመዘግየት ምክንያት):
                </label>
                <select
                  id={`downtime-template-${globalIndex}`}
                  aria-label="OM Reason Template (የመዘግየት ምክንያት)"
                  value={row.entry.downtimeReasonId || ""}
                  onChange={(e) =>
                    handleSelectDowntimeReason(globalIndex, e.target.value)
                  }
                  className="select select-xs select-bordered w-full text-[11px] font-medium text-slate-700 rounded-lg bg-slate-50 focus:bg-white leading-relaxed"
                >
                  <option value="">Select reason template...</option>
                  {downtimeReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}: {r.nameEn} {r.nameAm ? `(${r.nameAm})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderCard = (row: GridRowData, globalIndex: number) => {
    const targetRes = calculateDailyTarget(
      row.plan,
      selectedDate,
      workingDays,
      specialDaysList
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
        className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 transition-all"
      >
        {/* Card Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-base text-slate-900 leading-relaxed truncate">
              {row.lineName}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-sm font-semibold text-slate-700 leading-relaxed truncate">
                {row.productName}
              </span>
              <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-600">
                {row.sku}
              </span>
            </div>
          </div>

          {/* Target & Variance Pill */}
          <div className="text-right shrink-0">
            <span className="text-xs text-slate-400 block font-mono tabular-nums">
              Target: {targetRes.hasTarget ? targetRes.displayTarget.toLocaleString() : "None"}
            </span>
            {varianceRes && (
              <span
                className={`text-xs font-black font-mono tabular-nums px-2 py-0.5 rounded-md inline-block mt-1 ${
                  varianceRes.isPositive
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}
              >
                {varianceRes.varianceFormatted}
              </span>
            )}
          </div>
        </div>

        {/* Visual Line Tally Progress Bar */}
        <LineTallyVisualizer
          compact={true}
          showQuickButtons={false}
          plannedQty={targetRes.hasTarget ? targetRes.dailyTarget : (row.plan?.plannedQty || 0)}
          finishedGood={row.entry.finishedGood}
          rework={row.entry.rework}
          reject={row.entry.reject}
          scrap={row.entry.scrap}
          wip={row.entry.wip}
          className="py-2 px-3 bg-slate-50/70"
        />

        {/* Mobile-Optimized Steppers Grid (touch targets >= 44x44) */}
        <div className="space-y-3">
          {/* Hero Finished Good Stepper */}
          <div className="bg-gradient-to-r from-emerald-50/70 via-indigo-50/30 to-emerald-50/50 p-3 rounded-2xl border border-emerald-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Finished Good (ጥሩ ምርት)</span>
              </label>
              <span className="text-[10px] font-bold text-emerald-700 font-mono">
                Primary Output
              </span>
            </div>
            <StepperInput
              value={row.entry.finishedGood}
              onChange={(val) => updateRowField(globalIndex, "finishedGood", val)}
              quickAdds={[1, 5, 10, 50]}
              themeColor="emerald"
              size="lg"
              className="w-full"
            />
          </div>

          {/* Secondary Numeric Inputs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
              <label className="text-[11px] font-extrabold text-slate-600 uppercase block mb-1 leading-relaxed">
                Rework (ድጋሚ)
              </label>
              <StepperInput
                value={row.entry.rework}
                onChange={(val) => updateRowField(globalIndex, "rework", val)}
                quickAdds={[1, 5]}
                themeColor="slate"
                size="lg"
                className="w-full"
              />
            </div>

            <div className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
              <label className="text-[11px] font-extrabold text-rose-800 uppercase block mb-1 leading-relaxed">
                Reject (ውድቅ)
              </label>
              <StepperInput
                value={row.entry.reject}
                onChange={(val) => updateRowField(globalIndex, "reject", val)}
                quickAdds={[1, 5]}
                themeColor="rose"
                size="lg"
                className="w-full"
              />
            </div>

            <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
              <label className="text-[11px] font-extrabold text-amber-800 uppercase block mb-1 leading-relaxed">
                Scrap (ቆሻሻ)
              </label>
              <StepperInput
                value={row.entry.scrap}
                onChange={(val) => updateRowField(globalIndex, "scrap", val)}
                quickAdds={[1, 5]}
                themeColor="amber"
                size="lg"
                className="w-full"
              />
            </div>

            <div className="bg-blue-50/40 p-2.5 rounded-xl border border-blue-100">
              <label className="text-[11px] font-extrabold text-blue-900 uppercase block mb-1 leading-relaxed">
                WIP (በሂደት)
              </label>
              <StepperInput
                value={row.entry.wip}
                onChange={(val) => updateRowField(globalIndex, "wip", val)}
                quickAdds={[5, 10]}
                themeColor="blue"
                size="lg"
                className="w-full"
              />
            </div>

            <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/80 col-span-2 sm:col-span-1">
              <label className="text-[11px] font-extrabold text-amber-900 uppercase block mb-1 leading-relaxed">
                Downtime (ደቂቃ)
              </label>
              <StepperInput
                value={row.entry.downtimeMinutes}
                onChange={(val) =>
                  updateRowField(globalIndex, "downtimeMinutes", val)
                }
                quickAdds={[5, 15]}
                themeColor="amber"
                size="lg"
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Issue Note & OM Reason */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-extrabold text-slate-600 uppercase block leading-relaxed">
            Issue Note & Reason (ማስታወሻና የመዘግየት ምክንያት)
          </label>
          <input
            type="text"
            placeholder="Note stoppage or quality issue..."
            value={row.entry.issueNote || ""}
            onChange={(e) =>
              updateRowField(globalIndex, "issueNote", e.target.value)
            }
            className="input input-sm sm:input-md input-bordered w-full text-xs sm:text-sm rounded-xl focus:outline-hidden focus:border-indigo-500 leading-relaxed"
          />
          {downtimeReasons && downtimeReasons.length > 0 && (
            <div className="flex flex-col gap-0.5 pt-0.5">
              <label
                htmlFor={`card-downtime-template-${globalIndex}`}
                className="text-[10px] font-bold text-slate-500 whitespace-nowrap leading-relaxed"
              >
                OM Reason Template (የመዘግየት ምክንያት):
              </label>
              <select
                id={`card-downtime-template-${globalIndex}`}
                aria-label="OM Reason Template (የመዘግየት ምክንያት)"
                value={row.entry.downtimeReasonId || ""}
                onChange={(e) =>
                  handleSelectDowntimeReason(globalIndex, e.target.value)
                }
                className="select select-sm select-bordered w-full text-xs font-medium text-slate-700 rounded-xl bg-slate-50 focus:bg-white leading-relaxed touch-target"
              >
                <option value="">Select reason template...</option>
                {downtimeReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code}: {r.nameEn} {r.nameAm ? `(${r.nameAm})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

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
              <span className="badge badge-neutral text-xs font-bold px-2.5 py-1 rounded-lg leading-relaxed font-sans">
                🇪🇹 {formatEthDate(ethDate, "full_am")}
              </span>
              <span className="text-xs text-slate-600 font-semibold leading-relaxed">
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

        {/* Product Filter & Date Selector & Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Product Filter Dropdown */}
          {availableProducts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <Boxes className="w-3.5 h-3.5 text-indigo-600 ml-1.5 shrink-0" />
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="select select-xs border-none bg-transparent font-bold text-slate-800 focus:outline-hidden text-xs pr-6"
                aria-label="Filter by Product"
              >
                <option value="all">All Products ({availableProducts.length})</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group Mode Toggle: By Product vs By Line */}
          <div className="join bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setGroupMode("product")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 min-h-[32px] px-2.5 touch-manipulation ${
                groupMode === "product"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Display Based on Product"
            >
              <Boxes className="w-3 h-3" />
              <span>By Product</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupMode("line")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 min-h-[32px] px-2.5 touch-manipulation ${
                groupMode === "line"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Flat Line View"
            >
              <span>By Line</span>
            </button>
          </div>

          {/* View Mode Switcher (Table View vs Cards View) */}
          <div className="join bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 min-h-[32px] px-2.5 touch-manipulation ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Table View"
              aria-label="Table View"
            >
              <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden xs:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 min-h-[32px] px-2.5 touch-manipulation ${
                viewMode === "cards"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Card View (Mobile Optimized)"
              aria-label="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden xs:inline">Cards</span>
            </button>
          </div>

          {/* Date Selector Bar */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            {isEth && ethDate && (
              <button
                type="button"
                onClick={() => setShowEthPicker(true)}
                className="btn btn-xs sm:btn-sm min-h-[32px] bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold gap-1 px-2.5 mr-0.5 leading-relaxed touch-manipulation"
                title="ቀን ምረጥ / Select Ethiopian Date"
              >
                <span>🇪🇹</span>
                <span className="leading-relaxed">
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
              className="btn btn-sm btn-ghost min-h-[32px] min-w-[32px] px-2 text-slate-600 hover:text-slate-900 touch-manipulation"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2">
              <CalendarIcon className="w-4 h-4 text-indigo-600 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => handleDateChange(e.target.value)}
                className="text-xs sm:text-sm font-bold font-mono text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
                aria-label="Select Gregorian Date"
              />
            </div>

            <button
              type="button"
              disabled={isNextDayDisabled}
              onClick={() =>
                !isNextDayDisabled &&
                handleDateChange(
                  format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd")
                )
              }
              className={`btn btn-sm btn-ghost min-h-[32px] min-w-[32px] px-2 touch-manipulation ${
                isNextDayDisabled
                  ? "opacity-30 cursor-not-allowed pointer-events-none text-slate-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title={isNextDayDisabled ? "Cannot navigate to future dates" : "Next Day"}
              aria-label="Next Day"
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
              className="btn btn-xs btn-ghost text-slate-600 rounded-lg text-[11px] font-bold min-h-[32px] px-2 touch-manipulation"
            >
              Yest
            </button>

            <button
              type="button"
              onClick={() => handleDateChange(format(new Date(), "yyyy-MM-dd"))}
              className="btn btn-xs btn-outline btn-neutral rounded-lg text-[11px] font-bold min-h-[32px] px-2 touch-manipulation"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Special Off-Day Holiday Banner */}
      {specialDay && !specialDay.isWorkingDay && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl flex items-center justify-between text-sm shadow-xs mb-4">
          <div className="flex items-center gap-2 font-semibold flex-wrap">
            <span className="text-lg">🎉</span>
            <span className="leading-relaxed">
              Special Off-Day: {specialDay.nameEn} {specialDay.nameAm ? `(${specialDay.nameAm})` : ""}
            </span>
            <span className="badge badge-sm badge-outline border-emerald-500 text-emerald-700 uppercase font-mono">
              {specialDay.type}
            </span>
          </div>
          <span className="text-xs bg-emerald-200/60 text-emerald-900 px-2.5 py-1 rounded-full font-mono font-bold shrink-0">
            Daily Target: 0
          </span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-6">
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
            Net Good: <b className="font-mono text-slate-700 tabular-nums">{netGoodOutput}</b> ({yieldPct}%)
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-4 rounded-2xl">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Target & Variance
          </span>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
              {hasAnyTarget
                ? Math.round(totalTarget).toLocaleString()
                : "No Target"}
            </span>
            {hasAnyTarget && (
              <span
                className={`text-xs font-black font-mono tabular-nums px-2 py-0.5 rounded-full flex items-center gap-1 ${
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
          <div className="flex items-baseline gap-2 mt-1 text-slate-700 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold">
              Rew: <b className="font-mono text-slate-900 tabular-nums">{totalRework}</b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs sm:text-sm font-semibold">
              Rej: <b className="font-mono text-rose-600 tabular-nums">{totalReject}</b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs sm:text-sm font-semibold">
              Scrap: <b className="font-mono text-amber-600 tabular-nums">{totalScrap}</b>
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total non-conforming: <b className="font-mono tabular-nums">{totalRework + totalFallout}</b>
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-4 rounded-2xl">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            WIP & Downtime
          </span>
          <div className="flex items-baseline gap-3 mt-1 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              WIP: <b className="font-mono text-slate-900 tabular-nums">{totalWIP}</b>
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              Down:{" "}
              <b
                className={`font-mono tabular-nums ${
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

      {/* Product Performance Strip */}
      {productSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-2xs mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-indigo-600" />
              <span>Product Performance Overview</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Click pill to filter views
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            {/* All Products Pill */}
            <button
              type="button"
              onClick={() => setSelectedProductFilter("all")}
              className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-all touch-manipulation ${
                selectedProductFilter === "all"
                  ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-2xs"
                  : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                All Products
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-black text-sm text-slate-900 tabular-nums">
                  {rows.reduce((sum, r) => sum + (r.entry.finishedGood || 0), 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">pcs</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                {productSummaries.length} active {productSummaries.length === 1 ? "product" : "products"}
              </div>
            </button>

            {/* Individual Product Pills */}
            {productSummaries.map((prod) => {
              const isSelected = selectedProductFilter === prod.productId;
              return (
                <button
                  key={prod.productId}
                  type="button"
                  onClick={() =>
                    setSelectedProductFilter(isSelected ? "all" : prod.productId)
                  }
                  className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-all touch-manipulation ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-2xs"
                      : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[140px] leading-relaxed">
                      {prod.productName}
                    </span>
                    <span className="text-[9px] font-mono font-bold bg-white px-1.5 py-0.2 rounded text-slate-600 border border-slate-200">
                      {prod.sku}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono font-black text-sm text-slate-900 tabular-nums">
                        {prod.totalFG.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">pcs</span>
                    </div>

                    {prod.hasTarget ? (
                      <span
                        className={`text-[10px] font-mono font-black tabular-nums px-1.5 py-0.2 rounded-md ${
                          prod.netVariance >= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {prod.netVariance >= 0 ? `+${prod.netVariance}` : `${prod.netVariance}`}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No target</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 gap-2 font-mono tabular-nums">
                    <span>
                      {prod.hasTarget
                        ? `Target: ${Math.round(prod.totalTarget).toLocaleString()}`
                        : "Ad-hoc"}
                    </span>
                    <span className="text-slate-400">
                      • {prod.linesCount} {prod.linesCount === 1 ? "line" : "lines"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entry Grid - Table View */}
      {viewMode === "table" ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">
                {groupMode === "product"
                  ? `Grouped By Product (${productGroups.length} ${productGroups.length === 1 ? "group" : "groups"})`
                  : `Active Production Lines (${displayedRows.length})`}
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
                  <th className="py-3 px-3 min-w-[130px]">Weekly Planned</th>
                  <th className="py-3 px-3 min-w-[150px]">Left from Weekly Planned</th>
                  <th className="py-3 px-3 min-w-[110px]">Daily Target</th>
                  <th className="py-3 px-3 min-w-[170px] bg-emerald-50/50 text-emerald-950 font-extrabold">
                    Finished Good
                  </th>
                  <th className="py-3 px-3 min-w-[110px]">Variance</th>
                  <th className="py-3 px-3 min-w-[140px]">Rework</th>
                  <th className="py-3 px-3 min-w-[140px]">Reject</th>
                  <th className="py-3 px-3 min-w-[140px]">Scrap</th>
                  <th className="py-3 px-3 min-w-[140px]">WIP</th>
                  <th className="py-3 px-3 min-w-[140px]">Downtime (min)</th>
                  <th className="py-3 px-4 min-w-[260px]">Issue Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-slate-400">
                      <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No active lines or products configured for this factory.
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-slate-400">
                      <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No production lines producing the selected product.
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedProductFilter("all")}
                          className="btn btn-xs btn-outline btn-neutral rounded-lg"
                        >
                          Show All Products
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : groupMode === "product" ? (
                  productGroups.map((group) => (
                    <React.Fragment key={`group_${group.product.id}`}>
                      {/* Product Group Header Banner Row */}
                      <tr className="bg-indigo-50/80 border-y-2 border-indigo-200">
                        <td colSpan={12} className="py-2.5 px-4 sticky left-0 z-10 bg-indigo-50/90">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <Boxes className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span className="font-black text-slate-900 text-sm leading-relaxed">
                                {group.product.name}
                              </span>
                              <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-900 shadow-2xs">
                                {group.product.sku}
                              </span>
                              <span className="badge badge-sm badge-neutral font-mono font-semibold">
                                {group.items.length} {group.items.length === 1 ? "line" : "lines"}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs flex-wrap">
                              <div className="flex items-baseline gap-1">
                                <span className="text-slate-500 font-medium">Output:</span>
                                <span className="font-mono font-extrabold text-slate-900 tabular-nums">
                                  {group.summary.totalFG.toLocaleString()} pcs
                                </span>
                              </div>
                              <span className="text-slate-300">•</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-slate-500 font-medium">Target:</span>
                                <span className="font-mono font-bold text-slate-700 tabular-nums">
                                  {group.summary.hasTarget
                                    ? group.summary.totalTarget.toLocaleString()
                                    : "None"}
                                </span>
                              </div>
                              <span className="text-slate-300">•</span>
                              {group.summary.hasTarget && (
                                <span
                                  className={`font-mono font-black tabular-nums px-2 py-0.5 rounded-md ${
                                    group.summary.netVariance >= 0
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {group.summary.netVariance >= 0
                                    ? `+${group.summary.netVariance}`
                                    : `${group.summary.netVariance}`}
                                </span>
                              )}
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">
                                Fallout: <b className="font-mono text-rose-600 tabular-nums">{group.summary.totalReject + group.summary.totalScrap}</b>
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {group.items.map(({ row, globalIndex }) =>
                        renderTableRow(row, globalIndex)
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  displayedRows.map((row) => {
                    const globalIndex = rows.findIndex(
                      (r) => r.lineId === row.lineId && r.productId === row.productId
                    );
                    return renderTableRow(row, globalIndex >= 0 ? globalIndex : 0);
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Mobile Card View Mode */
        <div className="space-y-4">
          {rows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
              <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No active lines or products configured for this factory.
            </div>
          ) : displayedRows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
              <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No production lines producing the selected product.
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductFilter("all")}
                  className="btn btn-xs btn-outline btn-neutral rounded-lg"
                >
                  Show All Products
                </button>
              </div>
            </div>
          ) : groupMode === "product" ? (
            productGroups.map((group) => (
              <div
                key={`card_group_${group.product.id}`}
                className="space-y-3 bg-slate-50/50 border border-indigo-100 rounded-3xl p-3 sm:p-4 shadow-2xs"
              >
                {/* Product Section Header Card */}
                <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-black text-slate-900 text-sm leading-relaxed">
                        {group.product.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[10px] font-bold bg-white px-1.5 py-0.2 rounded border border-indigo-200 text-indigo-900">
                          {group.product.sku}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          • {group.items.length} {group.items.length === 1 ? "line" : "lines"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-black text-slate-900 tabular-nums">
                      {group.summary.totalFG.toLocaleString()} pcs
                    </span>
                    {group.summary.hasTarget && (
                      <span
                        className={`font-mono font-bold text-[10px] tabular-nums px-1.5 py-0.2 rounded ${
                          group.summary.netVariance >= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {group.summary.netVariance >= 0
                          ? `+${group.summary.netVariance}`
                          : `${group.summary.netVariance}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards for each Line in this Product Group */}
                <div className="space-y-3">
                  {group.items.map(({ row, globalIndex }) =>
                    renderCard(row, globalIndex)
                  )}
                </div>
              </div>
            ))
          ) : (
            displayedRows.map((row) => {
              const globalIndex = rows.findIndex(
                (r) => r.lineId === row.lineId && r.productId === row.productId
              );
              return renderCard(row, globalIndex >= 0 ? globalIndex : 0);
            })
          )}
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
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-2.5 sm:py-3 shadow-xl pb-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate leading-relaxed">
              Date:{" "}
              {isEth && ethDate ? (
                <>
                  <b className="text-slate-900 font-bold leading-relaxed">
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
              <b className="text-emerald-700 font-mono font-black tabular-nums">
                {totalFG.toLocaleString()}
              </b>
            </span>
            {isDirty && (
              <span className="badge badge-warning badge-sm font-bold shadow-2xs">
                {modifiedRowCount} modified
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDirty && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="btn btn-sm sm:btn-md min-h-[44px] min-w-[44px] btn-ghost text-slate-500 hover:text-slate-800 rounded-xl font-bold touch-manipulation"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isPending || !isDirty}
              className={`btn btn-sm sm:btn-md min-h-[44px] px-4 sm:px-7 rounded-2xl font-black shadow-md transition-all flex items-center gap-2 touch-manipulation ${
                isDirty
                  ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border-none shadow-emerald-200 active:scale-95 cursor-pointer"
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
                  <Save className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  <span>Save Daily Numbers</span>
                  <span className="hidden lg:inline-flex items-center text-[10px] bg-emerald-700/80 px-1.5 py-0.5 rounded font-mono text-emerald-100 font-bold">
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
                  <h3 className="text-base font-black text-slate-900 leading-relaxed">
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
                <label className="text-xs font-bold text-slate-600 block mb-1 leading-relaxed">
                  ዓመት (Year)
                </label>
                <select
                  value={pickerYear}
                  onChange={(e) => setPickerYear(Number(e.target.value))}
                  className="select select-bordered select-sm w-full font-bold text-slate-800 rounded-xl leading-relaxed"
                >
                  {[2014, 2015, 2016, 2017, 2018, 2019, 2020].map((y) => (
                    <option key={y} value={y}>
                      {y} ዓ.ም
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1 leading-relaxed">
                  ወር (Month)
                </label>
                <select
                  value={pickerMonth}
                  onChange={(e) => setPickerMonth(Number(e.target.value))}
                  className="select select-bordered select-sm w-full font-bold text-slate-800 rounded-xl leading-relaxed"
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
                <label className="text-xs font-bold text-slate-600 leading-relaxed">
                  ቀን (Day: 1 - {daysInMonthEth(pickerYear, pickerMonth)})
                </label>
                <span className="text-xs font-extrabold text-indigo-600 font-mono leading-relaxed">
                  ተመርጧል: {pickerDay}
                </span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                {Array.from(
                  { length: daysInMonthEth(pickerYear, pickerMonth) },
                  (_, i) => i + 1
                ).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPickerDay(d)}
                    className={`btn btn-xs min-h-[36px] rounded-lg font-mono font-bold touch-manipulation ${
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
                className="btn btn-sm btn-ghost text-slate-600 font-bold leading-relaxed touch-manipulation"
              >
                ዛሬ (Today)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEthPicker(false)}
                  className="btn btn-sm min-h-[40px] btn-ghost rounded-xl leading-relaxed touch-manipulation"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyEthDate(pickerYear, pickerMonth, pickerDay)
                  }
                  className="btn btn-sm min-h-[40px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-4 leading-relaxed touch-manipulation"
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
