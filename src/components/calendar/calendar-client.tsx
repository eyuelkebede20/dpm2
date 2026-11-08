"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PenTool,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Globe,
  Grid as GridIcon,
  List as ListIcon,
  CalendarDays,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  ChevronDown,
} from "lucide-react";
import { calculateDailyTarget, calculateVariance, isWorkingDay } from "@/lib/target";
import {
  EthiopianDate,
  ETH_MONTH_NAMES_AM,
  ETH_MONTH_NAMES_EN,
  ETH_WEEKDAYS_AM,
  ETH_WEEKDAYS_EN,
  daysInMonthEth,
  ethToGregorian,
  gregorianToEth,
  formatEthDate,
  getEthDayOfWeek,
} from "@/lib/ethiopian-calendar";

export interface CalendarEntry {
  id: string;
  date: string; // ISO YYYY-MM-DD
  lineId: string;
  lineName: string;
  productId: string;
  productName: string;
  finishedGood: number;
  rework: number;
  reject: number;
  scrap: number;
  wip: number;
  downtimeMinutes: number;
  issueNote: string | null;
}

export interface CalendarPlan {
  lineId: string;
  productId: string;
  startDate: string;
  endDate: string;
  plannedQty: number;
}

interface CalendarClientProps {
  factoryId: string;
  factoryName: string;
  workingDays: number[];
  calendarType: "ethiopian" | "gregorian";
  ethiopianYear: number;
  ethiopianMonth: number;
  gregorianMonthStr: string; // YYYY-MM
  startDateStr: string;
  endDateStr: string;
  entries: CalendarEntry[];
  plans: CalendarPlan[];
}

export function CalendarClient({
  factoryId,
  factoryName,
  workingDays,
  calendarType: initialCalType,
  ethiopianYear: initialEthYear,
  ethiopianMonth: initialEthMonth,
  gregorianMonthStr: initialGregMonthStr,
  startDateStr,
  endDateStr,
  entries,
  plans,
}: CalendarClientProps) {
  const router = useRouter();

  // State
  const [calType, setCalType] = useState<"ethiopian" | "gregorian">(initialCalType);
  const [ethYear, setEthYear] = useState<number>(initialEthYear);
  const [ethMonth, setEthMonth] = useState<number>(initialEthMonth);
  const [language, setLanguage] = useState<"am" | "en">("am");
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>("all");
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
  const [activeDayDateStr, setActiveDayDateStr] = useState<string | null>(null);
  const [showMonthJumper, setShowMonthJumper] = useState<boolean>(false);
  const [calendarViewMode, setCalendarViewMode] = useState<"compact" | "grid" | "list">("grid");

  // Today in both calendars
  const todayGC = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const todayEC = useMemo(() => gregorianToEth(todayGC), [todayGC]);

  // Set initial view mode based on screen width and set default active day to today
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) {
        setCalendarViewMode("compact");
      }
    }
    // Set active day to today if in range, otherwise first day
    setActiveDayDateStr(todayGC);
  }, [todayGC]);

  // Handle Calendar Switch
  const toggleCalendarType = (newType: "ethiopian" | "gregorian") => {
    setCalType(newType);
    if (newType === "ethiopian") {
      router.push(`/calendar?cal=ethiopian&ey=${ethYear}&em=${ethMonth}`);
    } else {
      router.push(`/calendar?cal=gregorian&month=${initialGregMonthStr}`);
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (calType === "ethiopian") {
      let nextM = ethMonth - 1;
      let nextY = ethYear;
      if (nextM < 1) {
        nextM = 13;
        nextY--;
      }
      setEthMonth(nextM);
      setEthYear(nextY);
      router.push(`/calendar?cal=ethiopian&ey=${nextY}&em=${nextM}`);
    } else {
      const nextDate = subMonths(parseISO(`${initialGregMonthStr}-01`), 1);
      const nextStr = format(nextDate, "yyyy-MM");
      router.push(`/calendar?cal=gregorian&month=${nextStr}`);
    }
  };

  const handleNextMonth = () => {
    if (calType === "ethiopian") {
      let nextM = ethMonth + 1;
      let nextY = ethYear;
      if (nextM > 13) {
        nextM = 1;
        nextY++;
      }
      setEthMonth(nextM);
      setEthYear(nextY);
      router.push(`/calendar?cal=ethiopian&ey=${nextY}&em=${nextM}`);
    } else {
      const nextDate = addMonths(parseISO(`${initialGregMonthStr}-01`), 1);
      const nextStr = format(nextDate, "yyyy-MM");
      router.push(`/calendar?cal=gregorian&month=${nextStr}`);
    }
  };

  const handleToday = () => {
    if (calType === "ethiopian") {
      setEthYear(todayEC.year);
      setEthMonth(todayEC.month);
      router.push(`/calendar?cal=ethiopian&ey=${todayEC.year}&em=${todayEC.month}`);
    } else {
      const nowStr = format(new Date(), "yyyy-MM");
      router.push(`/calendar?cal=gregorian&month=${nowStr}`);
    }
  };

  const jumpToEthMonth = (year: number, month: number) => {
    setEthYear(year);
    setEthMonth(month);
    setShowMonthJumper(false);
    router.push(`/calendar?cal=ethiopian&ey=${year}&em=${month}`);
  };

  // Filter dropdowns
  const availableLines = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => map.set(e.lineId, e.lineName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const availableProducts = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => map.set(e.productId, e.productName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedLineFilter !== "all" && e.lineId !== selectedLineFilter) return false;
      if (selectedProductFilter !== "all" && e.productId !== selectedProductFilter) return false;
      return true;
    });
  }, [entries, selectedLineFilter, selectedProductFilter]);

  // Days to render in Grid
  interface GridDayItem {
    gregorianDateStr: string; // YYYY-MM-DD
    primaryNumber: number;    // Ethiopian day if EC, Gregorian day if GC
    secondaryLabel: string;   // Gregorian date if EC, Ethiopian date if GC
    dayOfWeek: number;        // 0 = Sun, 1 = Mon ...
    isWorkDay: boolean;
    isCurrentToday: boolean;
  }

  const gridDays: GridDayItem[] = useMemo(() => {
    if (calType === "ethiopian") {
      const totalDays = daysInMonthEth(ethYear, ethMonth);
      const list: GridDayItem[] = [];

      for (let d = 1; d <= totalDays; d++) {
        const gregStr = ethToGregorian(ethYear, ethMonth, d);
        const dow = getEthDayOfWeek(ethYear, ethMonth, d);
        const isWork = isWorkingDay(gregStr, workingDays);
        const isCurr = gregStr === todayGC;
        const gregDate = parseISO(gregStr);
        const secLabel = format(gregDate, "MMM d");

        list.push({
          gregorianDateStr: gregStr,
          primaryNumber: d,
          secondaryLabel: secLabel,
          dayOfWeek: dow,
          isWorkDay: isWork,
          isCurrentToday: isCurr,
        });
      }
      return list;
    } else {
      const start = parseISO(startDateStr);
      const end = parseISO(endDateStr);
      const rawDays = eachDayOfInterval({ start, end });

      return rawDays.map((d) => {
        const gregStr = format(d, "yyyy-MM-dd");
        const ethDate = gregorianToEth(gregStr);
        const dow = d.getDay();
        const isWork = isWorkingDay(d, workingDays);
        const isCurr = isToday(d);
        const mName = language === "am" ? ETH_MONTH_NAMES_AM[ethDate.month] : ETH_MONTH_NAMES_EN[ethDate.month];
        const secLabel = `${mName} ${ethDate.day}`;

        return {
          gregorianDateStr: gregStr,
          primaryNumber: d.getDate(),
          secondaryLabel: secLabel,
          dayOfWeek: dow,
          isWorkDay: isWork,
          isCurrentToday: isCurr,
        };
      });
    }
  }, [calType, ethYear, ethMonth, startDateStr, endDateStr, workingDays, todayGC, language]);

  // Grid start alignment offset: Standard Monday start (Mon=0, Tue=1, ..., Sun=6)
  const firstDayDow = gridDays.length > 0 ? gridDays[0].dayOfWeek : 1;
  const leadingBlanks = (firstDayDow + 6) % 7;

  // Day summaries map for fast lookup
  const daySummaryMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalFG: number;
        totalTarget: number;
        hasTarget: boolean;
        netVariance: number;
        entries: CalendarEntry[];
      }
    >();

    gridDays.forEach((item) => {
      const dayEntries = filteredEntries.filter((e) => e.date === item.gregorianDateStr);

      let dayTotalFG = 0;
      let dayTotalTarget = 0;
      let dayHasTarget = false;

      dayEntries.forEach((e) => {
        dayTotalFG += e.finishedGood;
        const matchingPlan = plans.find(
          (p) => p.lineId === e.lineId && p.productId === e.productId
        );
        const t = calculateDailyTarget(matchingPlan, item.gregorianDateStr, workingDays);
        if (t.hasTarget) {
          dayTotalTarget += t.dailyTarget;
          dayHasTarget = true;
        }
      });

      map.set(item.gregorianDateStr, {
        totalFG: dayTotalFG,
        totalTarget: dayTotalTarget,
        hasTarget: dayHasTarget,
        netVariance: dayHasTarget ? dayTotalFG - dayTotalTarget : 0,
        entries: dayEntries,
      });
    });

    return map;
  }, [gridDays, filteredEntries, plans, workingDays]);

  // Month-wide Totals
  const monthTotals = useMemo(() => {
    let output = 0;
    let target = 0;
    let daysWithTarget = 0;
    let workingDaysCount = 0;
    let recordedDaysCount = 0;

    gridDays.forEach((d) => {
      if (d.isWorkDay) workingDaysCount++;
      const s = daySummaryMap.get(d.gregorianDateStr);
      if (s) {
        output += s.totalFG;
        if (s.hasTarget) {
          target += s.totalTarget;
          daysWithTarget++;
        }
        if (s.entries.length > 0) {
          recordedDaysCount++;
        }
      }
    });

    const netVar = daysWithTarget > 0 ? output - target : 0;
    const completionPct = target > 0 ? Math.round((output / target) * 100) : null;

    return {
      output,
      target,
      netVar,
      completionPct,
      workingDaysCount,
      recordedDaysCount,
    };
  }, [gridDays, daySummaryMap]);

  // Active day details for inspection drawer / inline card
  const activeDaySummary = activeDayDateStr ? daySummaryMap.get(activeDayDateStr) : null;
  const activeDayItem = activeDayDateStr
    ? gridDays.find((g) => g.gregorianDateStr === activeDayDateStr)
    : null;

  // Header Title
  const headerTitle = useMemo(() => {
    if (calType === "ethiopian") {
      const mName = language === "am" ? ETH_MONTH_NAMES_AM[ethMonth] : ETH_MONTH_NAMES_EN[ethMonth];
      const amSuffix = language === "am" ? "ዓ.ም" : "EC";
      return `${mName} ${ethYear} ${amSuffix}`;
    } else {
      return format(parseISO(`${initialGregMonthStr}-01`), "MMMM yyyy");
    }
  }, [calType, ethYear, ethMonth, language, initialGregMonthStr]);

  const headerSubrange = useMemo(() => {
    const s = parseISO(startDateStr);
    const e = parseISO(endDateStr);
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  }, [startDateStr, endDateStr]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
      {/* Top Header & Executive Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>{factoryName}</span>
            <span>•</span>
            <span className="text-indigo-600 font-extrabold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {calType === "ethiopian" ? "የኢትዮጵያ ካላንደር (13 ወራት)" : "Gregorian Calendar"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-600 shrink-0" />
            <span>Calendar & Performance</span>
          </h1>
        </div>

        {/* Calendar Switcher & Fast Controls */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
          {/* Dual Calendar Mode Toggle */}
          <div className="join w-full sm:w-auto border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
            <button
              type="button"
              onClick={() => toggleCalendarType("ethiopian")}
              className={`btn btn-sm join-item flex-1 sm:flex-initial text-xs font-extrabold ${
                calType === "ethiopian"
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 border-none"
                  : "btn-ghost text-slate-600"
              }`}
            >
              🇪🇹 Ethiopian
            </button>
            <button
              type="button"
              onClick={() => toggleCalendarType("gregorian")}
              className={`btn btn-sm join-item flex-1 sm:flex-initial text-xs font-extrabold ${
                calType === "gregorian"
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 border-none"
                  : "btn-ghost text-slate-600"
              }`}
            >
              🌐 Gregorian
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Language Toggle for Amharic Fidel vs English */}
            {calType === "ethiopian" && (
              <button
                type="button"
                onClick={() => setLanguage((l) => (l === "am" ? "en" : "am"))}
                className="btn btn-sm btn-outline rounded-xl text-xs font-bold shrink-0"
                title="Toggle Amharic / English Labels"
              >
                {language === "am" ? "ፊደል (አማ)" : "English"}
              </button>
            )}

            {/* Month Switcher */}
            <div className="join flex-1 sm:flex-initial border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white justify-between sm:justify-start">
              <button
                onClick={handlePrevMonth}
                className="btn btn-sm btn-ghost join-item px-2.5 text-slate-600 hover:text-slate-900"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => calType === "ethiopian" && setShowMonthJumper(true)}
                className="join-item px-3 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
              >
                <span className="truncate">{headerTitle}</span>
                {calType === "ethiopian" && (
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                    13M
                  </span>
                )}
              </button>

              <button
                onClick={handleNextMonth}
                className="btn btn-sm btn-ghost join-item px-2.5 text-slate-600 hover:text-slate-900"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleToday}
              className="btn btn-sm btn-outline btn-neutral rounded-xl text-xs font-bold shrink-0"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Performance KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 my-4 sm:my-5">
        <div className="card bg-white border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 rounded-2xl">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Month Total Output
          </span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tabular-nums">
              {monthTotals.output.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate">
            {monthTotals.recordedDaysCount} production days logged
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 rounded-2xl">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Month Target & Variance
          </span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1 flex-wrap">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tabular-nums">
              {monthTotals.target > 0 ? Math.round(monthTotals.target).toLocaleString() : "No Plan"}
            </span>
            {monthTotals.target > 0 && (
              <span
                className={`text-[11px] sm:text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  monthTotals.netVar >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {monthTotals.netVar >= 0 ? "+" : ""}
                {Math.round(monthTotals.netVar).toLocaleString()}
              </span>
            )}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate">
            {monthTotals.completionPct !== null ? `${monthTotals.completionPct}% of planned target` : "No targets set"}
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 rounded-2xl">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Working Days in Month
          </span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tabular-nums">
              {monthTotals.workingDaysCount}
            </span>
            <span className="text-xs font-bold text-slate-400">days</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate">
            {gridDays.length - monthTotals.workingDaysCount} scheduled days off
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 rounded-2xl">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            Coverage Status
          </span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black text-indigo-600 font-mono tabular-nums">
              {Math.round((monthTotals.recordedDaysCount / (monthTotals.workingDaysCount || 1)) * 100)}%
            </span>
            <span className="text-xs font-bold text-slate-400">logged</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate">
            {monthTotals.recordedDaysCount} of {monthTotals.workingDaysCount} active work days
          </div>
        </div>
      </div>

      {/* Filter and View Bar (Fully Responsive Toolbar) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Range:
          </span>
          <span className="text-xs font-extrabold text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60">
            {headerSubrange}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Line Filter */}
          {availableLines.length > 0 && (
            <select
              value={selectedLineFilter}
              onChange={(e) => setSelectedLineFilter(e.target.value)}
              className="select select-sm select-bordered rounded-xl text-xs font-semibold h-8 min-h-0"
            >
              <option value="all">All Lines</option>
              {availableLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {/* Product Filter */}
          {availableProducts.length > 0 && (
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="select select-sm select-bordered rounded-xl text-xs font-semibold h-8 min-h-0"
            >
              <option value="all">All Products</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Clear Filters Button */}
          {(selectedLineFilter !== "all" || selectedProductFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSelectedLineFilter("all");
                setSelectedProductFilter("all");
              }}
              className="btn btn-xs btn-ghost text-rose-600 rounded-lg text-[11px] font-bold"
            >
              Reset
            </button>
          )}

          {/* View Mode Switcher: Compact, Grid, List (Visible on ALL Viewports!) */}
          <div className="join bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setCalendarViewMode("compact")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 ${
                calendarViewMode === "compact"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "btn-ghost text-slate-600"
              }`}
              title="Compact View (Recommended on mobile/tablet)"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compact</span>
            </button>

            <button
              type="button"
              onClick={() => setCalendarViewMode("grid")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 ${
                calendarViewMode === "grid"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "btn-ghost text-slate-600"
              }`}
              title="Month Grid View"
            >
              <GridIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setCalendarViewMode("list")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 ${
                calendarViewMode === "list"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "btn-ghost text-slate-600"
              }`}
              title="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* 13-Month Quick Jumper Modal */}
      {showMonthJumper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {language === "am" ? "የኢትዮጵያ ወር እና ዓመት ይምረጡ" : "Select Ethiopian Month & Year"}
                </h3>
                <span className="text-xs text-slate-500">
                  13 Ethiopian Months (30 days + Pagume 5/6)
                </span>
              </div>
              <button
                onClick={() => setShowMonthJumper(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Year Selector Strip */}
            <div className="my-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Year (ዓ.ም)
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[2015, 2016, 2017, 2018, 2019, 2020].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setEthYear(y)}
                    className={`btn btn-xs rounded-xl font-mono font-bold ${
                      ethYear === y
                        ? "bg-indigo-600 text-white border-none"
                        : "btn-outline text-slate-600"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* 13 Months Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 my-4">
              {Array.from({ length: 13 }).map((_, idx) => {
                const m = idx + 1;
                const isSelected = ethMonth === m;
                const mNameAm = ETH_MONTH_NAMES_AM[m];
                const mNameEn = ETH_MONTH_NAMES_EN[m];

                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => jumpToEthMonth(ethYear, m)}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 font-extrabold shadow-xs"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                    }`}
                  >
                    <div className="text-sm font-bold">{mNameAm}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{mNameEn}</div>
                    {m === 13 && (
                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block">
                        Pagume
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* VIEW MODE 1: COMPACT CALENDAR + INLINE INSPECTION (MOBILE UX)  */}
      {/* ============================================================= */}
      {calendarViewMode === "compact" && (
        <div className="space-y-5">
          {/* Compact 7-Day Month Grid */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Tap any day to inspect daily production numbers
              </span>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Ahead
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  Behind
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                  No Plan
                </span>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] sm:text-xs font-black uppercase text-slate-500 mb-2">
              <div>{language === "am" ? "ሰኞ" : "Mon"}</div>
              <div>{language === "am" ? "ማክ" : "Tue"}</div>
              <div>{language === "am" ? "ረቡ" : "Wed"}</div>
              <div>{language === "am" ? "ሐሙ" : "Thu"}</div>
              <div>{language === "am" ? "አርብ" : "Fri"}</div>
              <div>{language === "am" ? "ቅዳ" : "Sat"}</div>
              <div className="text-slate-400">{language === "am" ? "እሁድ" : "Sun"}</div>
            </div>

            {/* Compact Day Cells */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: leadingBlanks }).map((_, idx) => (
                <div key={`cblank_${idx}`} className="aspect-square rounded-xl bg-slate-50/40" />
              ))}

              {gridDays.map((item) => {
                const summary = daySummaryMap.get(item.gregorianDateStr);
                const isSelected = activeDayDateStr === item.gregorianDateStr;
                const hasEntries = summary && summary.entries.length > 0;
                const hasTarget = summary?.hasTarget;
                const netVar = summary?.netVariance || 0;
                const isPositive = netVar >= 0;

                return (
                  <button
                    key={`c_${item.gregorianDateStr}`}
                    type="button"
                    onClick={() => setActiveDayDateStr(item.gregorianDateStr)}
                    className={`aspect-square min-h-[46px] sm:min-h-[58px] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-1 relative transition-all active:scale-95 ${
                      isSelected
                        ? "bg-indigo-600 text-white font-black shadow-md ring-2 ring-indigo-400"
                        : item.isCurrentToday
                        ? "border-2 border-indigo-400 bg-white text-slate-900"
                        : item.isWorkDay
                        ? "bg-white border border-slate-200/80 hover:border-indigo-300 text-slate-800"
                        : "bg-slate-100/70 border border-slate-200/50 text-slate-400"
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold font-mono tabular-nums leading-none">
                      {item.primaryNumber}
                    </span>

                    {/* Secondary micro label on tablet/desktop */}
                    <span
                      className={`text-[9px] font-mono leading-none mt-0.5 hidden sm:inline ${
                        isSelected ? "text-indigo-200" : "text-slate-400"
                      }`}
                    >
                      {item.secondaryLabel}
                    </span>

                    {/* Indicator Dot */}
                    {hasEntries && (
                      <div className="mt-1 flex items-center justify-center">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected
                              ? "bg-white"
                              : hasTarget
                              ? isPositive
                                ? "bg-emerald-500"
                                : "bg-rose-500"
                              : "bg-slate-400"
                          }`}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline Active Day Details Card */}
          {activeDayDateStr && activeDaySummary && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Selected Date Inspection
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                    {formatEthDate(gregorianToEth(activeDayDateStr), "full_am")}
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">
                    {format(parseISO(activeDayDateStr), "EEEE, MMMM d, yyyy")}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/entry?date=${activeDayDateStr}`)}
                    className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs font-bold gap-1.5"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Edit / Enter Report</span>
                  </button>
                </div>
              </div>

              {/* Day Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Total Finished Output
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums mt-0.5">
                    {activeDaySummary.totalFG.toLocaleString()} <span className="text-xs font-normal text-slate-400">pcs</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Daily Plan Target
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-700 font-mono tabular-nums mt-0.5">
                    {activeDaySummary.hasTarget
                      ? `${Math.round(activeDaySummary.totalTarget).toLocaleString()} pcs`
                      : "No plan"}
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Daily Variance
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {activeDaySummary.hasTarget ? (
                      <span
                        className={`text-sm sm:text-base font-black font-mono tabular-nums px-2.5 py-0.5 rounded-lg ${
                          activeDaySummary.netVariance >= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {activeDaySummary.netVariance >= 0 ? "+" : ""}
                        {Math.round(activeDaySummary.netVariance)} pcs
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400 font-mono">None</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Line & Product Detailed Breakdown */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
                  Production Lines Recorded ({activeDaySummary.entries.length})
                </h3>

                {activeDaySummary.entries.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                    No production report submitted for this date.
                    <div className="mt-3">
                      <button
                        onClick={() => router.push(`/entry?date=${activeDayDateStr}`)}
                        className="btn btn-sm bg-indigo-600 text-white rounded-xl font-bold"
                      >
                        Create Report for this Date
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeDaySummary.entries.map((entry) => {
                      const plan = plans.find(
                        (p) =>
                          p.lineId === entry.lineId &&
                          p.productId === entry.productId
                      );
                      const target = calculateDailyTarget(
                        plan,
                        activeDayDateStr,
                        workingDays
                      );
                      const variance = target.hasTarget
                        ? calculateVariance(entry.finishedGood, target.dailyTarget)
                        : null;

                      return (
                        <div
                          key={`inline_${entry.id}`}
                          className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-extrabold text-slate-900 text-sm">
                                {entry.lineName}
                              </div>
                              <div className="text-xs text-slate-600 font-medium mt-0.5">
                                {entry.productName}
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-base font-black font-mono text-slate-900 tabular-nums">
                                {entry.finishedGood.toLocaleString()} pcs
                              </span>
                              {variance && (
                                <div className="text-xs font-bold font-mono">
                                  <span
                                    className={
                                      variance.isPositive
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }
                                  >
                                    {variance.varianceFormatted}
                                  </span>
                                  {variance.percentOfTarget !== null && (
                                    <span className="text-slate-400 font-normal ml-1">
                                      ({variance.percentOfTarget}%)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Fallout metrics */}
                          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-center text-xs">
                            <div className="bg-white p-1.5 rounded-xl border border-slate-200/50">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                Rew
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {entry.rework}
                              </span>
                            </div>
                            <div className="bg-white p-1.5 rounded-xl border border-slate-200/50">
                              <span className="text-[10px] text-rose-800 block uppercase font-bold">
                                Rej
                              </span>
                              <span className="font-mono font-bold text-rose-700">
                                {entry.reject}
                              </span>
                            </div>
                            <div className="bg-white p-1.5 rounded-xl border border-slate-200/50">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                WIP
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {entry.wip}
                              </span>
                            </div>
                            <div className="bg-white p-1.5 rounded-xl border border-slate-200/50">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                Down
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  entry.downtimeMinutes > 0
                                    ? "text-amber-600"
                                    : "text-slate-800"
                                }`}
                              >
                                {entry.downtimeMinutes}m
                              </span>
                            </div>
                          </div>

                          {entry.issueNote && (
                            <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 p-2 rounded-xl flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>{entry.issueNote}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* VIEW MODE 2: MONTH GRID VIEW (WITH HORIZONTAL SCROLL SHIELD)   */}
      {/* ============================================================= */}
      {calendarViewMode === "grid" && (
        <div className="overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="min-w-[700px] lg:min-w-0">
            {/* Weekday Column Headers (Mon -> Sun) */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold uppercase tracking-wider text-slate-500 my-2">
              <div className="py-1">{language === "am" ? "ሰኞ" : "Mon"}</div>
              <div className="py-1">{language === "am" ? "ማክሰኞ" : "Tue"}</div>
              <div className="py-1">{language === "am" ? "ረቡዕ" : "Wed"}</div>
              <div className="py-1">{language === "am" ? "ሐሙስ" : "Thu"}</div>
              <div className="py-1">{language === "am" ? "አርብ" : "Fri"}</div>
              <div className="py-1">{language === "am" ? "ቅዳሜ" : "Sat"}</div>
              <div className="py-1 text-slate-400">
                {language === "am" ? "እሁድ (እረፍት)" : "Sun (Off)"}
              </div>
            </div>

            {/* Calendar Month Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Leading blanks */}
              {Array.from({ length: leadingBlanks }).map((_, idx) => (
                <div
                  key={`blank_${idx}`}
                  className="min-h-[110px] rounded-2xl bg-slate-50/50 border border-transparent"
                />
              ))}

              {/* Day Tiles */}
              {gridDays.map((item) => {
                const summary = daySummaryMap.get(item.gregorianDateStr);
                const isSelected = activeDayDateStr === item.gregorianDateStr;
                const hasTarget = summary?.hasTarget;
                const netVar = summary?.netVariance || 0;
                const isPositive = netVar >= 0;
                const varFormatted = isPositive ? `+${Math.round(netVar)}` : `${Math.round(netVar)}`;
                const hasEntries = summary && summary.entries.length > 0;

                return (
                  <div
                    key={item.gregorianDateStr}
                    onClick={() => setActiveDayDateStr(item.gregorianDateStr)}
                    className={`min-h-[115px] p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                      isSelected
                        ? "ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50/30 shadow-md"
                        : item.isCurrentToday
                        ? "border-indigo-400 bg-white shadow-2xs"
                        : item.isWorkDay
                        ? "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-2xs"
                        : "bg-slate-100/60 border-slate-200 text-slate-400"
                    }`}
                  >
                    {/* Day Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className={`text-sm sm:text-base font-black font-mono tabular-nums inline-block leading-none ${
                            item.isCurrentToday
                              ? "text-indigo-600 font-extrabold"
                              : "text-slate-900 group-hover:text-indigo-600"
                          }`}
                        >
                          {item.primaryNumber}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          {item.secondaryLabel}
                        </span>
                      </div>

                      {!item.isWorkDay ? (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 px-1 py-0.5 rounded">
                          Off
                        </span>
                      ) : item.isCurrentToday ? (
                        <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                          Today
                        </span>
                      ) : null}
                    </div>

                    {/* Production Number & Variance Badge */}
                    <div className="my-1">
                      {hasEntries ? (
                        <>
                          <div className="text-sm sm:text-base font-black text-slate-900 font-mono tabular-nums tracking-tight leading-tight">
                            {summary.totalFG.toLocaleString()}
                            <span className="text-[10px] font-normal text-slate-400 ml-1">
                              pcs
                            </span>
                          </div>

                          {/* Variance Badge */}
                          {hasTarget ? (
                            <div className="mt-1 flex items-center">
                              <span
                                className={`text-[11px] font-black font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                                  isPositive
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {varFormatted}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              No plan
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-slate-300 font-mono">
                          {item.isWorkDay ? "−" : ""}
                        </div>
                      )}
                    </div>

                    {/* Bottom Micro Action */}
                    <div className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Inspect →
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* VIEW MODE 3: AGENDA / DAY LIST VIEW (CLEAN VERTICAL SCROLL)    */}
      {/* ============================================================= */}
      {calendarViewMode === "list" && (
        <div className="space-y-3">
          {gridDays.map((item) => {
            const summary = daySummaryMap.get(item.gregorianDateStr);
            const isSelected = activeDayDateStr === item.gregorianDateStr;
            const hasTarget = summary?.hasTarget;
            const netVar = summary?.netVariance || 0;
            const isPositive = netVar >= 0;
            const hasEntries = summary && summary.entries.length > 0;

            return (
              <div
                key={`list_${item.gregorianDateStr}`}
                onClick={() => setActiveDayDateStr(item.gregorianDateStr)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                  isSelected
                    ? "ring-2 ring-indigo-600 bg-indigo-50/40 border-indigo-600"
                    : item.isCurrentToday
                    ? "border-indigo-400 bg-white"
                    : "bg-white border-slate-200 hover:border-indigo-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex flex-col items-center justify-center font-mono shrink-0">
                    <span className="text-base font-black text-slate-900 leading-tight">
                      {item.primaryNumber}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase leading-none font-bold">
                      {item.secondaryLabel}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm sm:text-base font-bold text-slate-900">
                      {hasEntries
                        ? `${summary.totalFG.toLocaleString()} pcs output`
                        : item.isWorkDay
                        ? "No report recorded"
                        : "Non-working scheduled day"}
                    </div>
                    {hasTarget && (
                      <div className="text-xs text-slate-400 font-mono">
                        Daily Target: {Math.round(summary.totalTarget).toLocaleString()} pcs
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasEntries && hasTarget && (
                    <span
                      className={`text-xs font-black font-mono px-2.5 py-1 rounded-xl ${
                        isPositive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {isPositive ? `+${Math.round(netVar)}` : Math.round(netVar)}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================= */}
      {/* SLIDE-OVER DRAWER / BOTTOM SHEET (FOR GRID & LIST VIEW MODES)  */}
      {/* ============================================================= */}
      {calendarViewMode !== "compact" && activeDayDateStr && activeDaySummary && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveDayDateStr(null)}
          />

          {/* Drawer Container (Desktop: right slide-over, Mobile: bottom sheet) */}
          <div className="fixed bottom-0 left-0 right-0 max-h-[88vh] rounded-t-3xl sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-full sm:w-[500px] sm:rounded-none bg-white shadow-2xl flex flex-col z-10 overflow-y-auto border-t sm:border-t-0 sm:border-l border-slate-200 pb-safe">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />

            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-white/95 backdrop-blur z-20 flex items-center justify-between sticky top-0">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{factoryName}</span>
                  <span>•</span>
                  <span className="text-indigo-600">Daily Inspection</span>
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                  {formatEthDate(gregorianToEth(activeDayDateStr), "full_am")}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {format(parseISO(activeDayDateStr), "EEEE, MMMM d, yyyy")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/entry?date=${activeDayDateStr}`)}
                  className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs font-bold"
                >
                  <PenTool className="w-3.5 h-3.5 mr-1" />
                  Edit Report
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDayDateStr(null)}
                  className="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-5 space-y-6">
              {/* Day Performance Card */}
              <div className="card bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Total Output
                    </span>
                    <div className="text-2xl font-black text-slate-900 font-mono mt-0.5 tabular-nums">
                      {activeDaySummary.totalFG.toLocaleString()} pcs
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Target & Variance
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-lg font-bold text-slate-700 font-mono tabular-nums">
                        {activeDaySummary.hasTarget
                          ? Math.round(activeDaySummary.totalTarget).toLocaleString()
                          : "None"}
                      </span>
                      {activeDaySummary.hasTarget && (
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            activeDaySummary.netVariance >= 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {activeDaySummary.netVariance >= 0 ? "+" : ""}
                          {Math.round(activeDaySummary.netVariance)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Line & Product Detailed Breakdown */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Line Breakdown ({activeDaySummary.entries.length} recorded)
                </h4>

                {activeDaySummary.entries.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                    No production report recorded for this date.
                    <div className="mt-3">
                      <button
                        onClick={() => router.push(`/entry?date=${activeDayDateStr}`)}
                        className="btn btn-sm bg-indigo-600 text-white rounded-xl font-bold"
                      >
                        Enter Report for this Date
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeDaySummary.entries.map((entry) => {
                      const plan = plans.find(
                        (p) =>
                          p.lineId === entry.lineId &&
                          p.productId === entry.productId
                      );
                      const target = calculateDailyTarget(
                        plan,
                        activeDayDateStr,
                        workingDays
                      );
                      const variance = target.hasTarget
                        ? calculateVariance(entry.finishedGood, target.dailyTarget)
                        : null;

                      return (
                        <div
                          key={entry.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-slate-900 text-sm">
                                {entry.lineName}
                              </div>
                              <div className="text-xs text-slate-500 font-medium">
                                {entry.productName}
                              </div>
                            </div>

                            {/* Output & Variance */}
                            <div className="text-right">
                              <span className="text-base font-black font-mono text-slate-900 tabular-nums">
                                {entry.finishedGood.toLocaleString()} pcs
                              </span>
                              {variance && (
                                <div className="text-xs font-bold font-mono">
                                  <span
                                    className={
                                      variance.isPositive
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }
                                  >
                                    {variance.varianceFormatted}
                                  </span>
                                  {variance.percentOfTarget !== null && (
                                    <span className="text-slate-400 font-normal ml-1">
                                      ({variance.percentOfTarget}%)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quality Fallout Metrics */}
                          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                            <div className="bg-slate-50 p-1.5 rounded-xl">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                Rework
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {entry.rework}
                              </span>
                            </div>
                            <div className="bg-rose-50/50 p-1.5 rounded-xl border border-rose-100">
                              <span className="text-[10px] text-rose-800 block uppercase font-bold">
                                Reject
                              </span>
                              <span className="font-mono font-bold text-rose-700">
                                {entry.reject}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded-xl">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                WIP
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {entry.wip}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded-xl">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">
                                Downtime
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  entry.downtimeMinutes > 0
                                    ? "text-amber-600"
                                    : "text-slate-800"
                                }`}
                              >
                                {entry.downtimeMinutes}m
                              </span>
                            </div>
                          </div>

                          {/* Issue Notes */}
                          {entry.issueNote && (
                            <div className="text-xs text-slate-600 bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>{entry.issueNote}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
