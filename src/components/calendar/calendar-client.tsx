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
  Sparkles,
  Grid as GridIcon,
  List as ListIcon,
  CalendarDays,
  AlertTriangle,
  Globe,
  ChevronDown,
  PartyPopper,
  CheckCircle2,
} from "lucide-react";
import { calculateDailyTarget, calculateVariance, isWorkingDay } from "@/lib/target";
import {
  EthiopianDate,
  ETH_MONTH_NAMES_AM,
  ETH_MONTH_NAMES_EN,
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

export interface CalendarSpecialDay {
  id: string;
  date: string; // YYYY-MM-DD
  nameEn: string;
  nameAm: string;
  type: string;
  isWorkingDay: boolean;
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
  products?: { id: string; name: string }[];
  specialDays?: CalendarSpecialDay[];
}

// Responsive weekday definitions with Ethiopic and Gregorian scripts
const WEEKDAY_HEADERS = [
  { amFull: "ሰኞ", amShort: "ሰኞ", amMini: "ሰ", enFull: "Monday", enShort: "Mon", enMini: "M", isWeekend: false },
  { amFull: "ማክሰኞ", amShort: "ማክ", amMini: "ማ", enFull: "Tuesday", enShort: "Tue", enMini: "T", isWeekend: false },
  { amFull: "ረቡዕ", amShort: "ረቡ", amMini: "ረ", enFull: "Wednesday", enShort: "Wed", enMini: "W", isWeekend: false },
  { amFull: "ሐሙስ", amShort: "ሐሙ", amMini: "ሐ", enFull: "Thursday", enShort: "Thu", enMini: "T", isWeekend: false },
  { amFull: "አርብ", amShort: "አር", amMini: "አ", enFull: "Friday", enShort: "Fri", enMini: "F", isWeekend: false },
  { amFull: "ቅዳሜ", amShort: "ቅዳ", amMini: "ቅ", enFull: "Saturday", enShort: "Sat", enMini: "S", isWeekend: false },
  { amFull: "እሁድ", amShort: "እሁ", amMini: "እ", enFull: "Sunday", enShort: "Sun", enMini: "S", isWeekend: true },
];

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
  products = [],
  specialDays = [],
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

  // Keep state synchronized with incoming server navigation props
  useEffect(() => {
    setCalType(initialCalType);
  }, [initialCalType]);

  useEffect(() => {
    setEthYear(initialEthYear);
    setEthMonth(initialEthMonth);
  }, [initialEthYear, initialEthMonth]);

  // Today in both calendars
  const todayGC = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const currentGregMonthStr = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const todayEC = useMemo(() => gregorianToEth(todayGC), [todayGC]);

  // Disable future months navigation
  const isNextMonthDisabled = useMemo(() => {
    if (calType === "ethiopian") {
      return ethYear > todayEC.year || (ethYear === todayEC.year && ethMonth >= todayEC.month);
    } else {
      return initialGregMonthStr >= currentGregMonthStr;
    }
  }, [calType, ethYear, ethMonth, todayEC, initialGregMonthStr, currentGregMonthStr]);

  // Is the currently active / inspected day in the future?
  const isSelectedDayFuture = useMemo(() => {
    if (!activeDayDateStr) return false;
    return activeDayDateStr > todayGC;
  }, [activeDayDateStr, todayGC]);

  // Set default active day to today
  useEffect(() => {
    setActiveDayDateStr(todayGC);
  }, [todayGC]);

  // Handle Seamless Calendar Switch
  const toggleCalendarType = (newType: "ethiopian" | "gregorian") => {
    setCalType(newType);
    if (newType === "ethiopian") {
      router.push(`/calendar?cal=ethiopian&ey=${ethYear}&em=${ethMonth}`);
    } else {
      const midGreg = ethToGregorian(ethYear, ethMonth, 15).slice(0, 7);
      router.push(`/calendar?cal=gregorian&month=${midGreg || initialGregMonthStr}`);
    }
  };

  // Month navigation (Ethiopian 13 months with Meskerem 1 <-> Pagume 13 wrap)
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
    if (isNextMonthDisabled) return;
    if (calType === "ethiopian") {
      let nextM = ethMonth + 1;
      let nextY = ethYear;
      if (nextM > 13) {
        nextM = 1;
        nextY++;
      }
      if (nextY > todayEC.year || (nextY === todayEC.year && nextM > todayEC.month)) {
        return;
      }
      setEthMonth(nextM);
      setEthYear(nextY);
      router.push(`/calendar?cal=ethiopian&ey=${nextY}&em=${nextM}`);
    } else {
      const nextDate = addMonths(parseISO(`${initialGregMonthStr}-01`), 1);
      const nextStr = format(nextDate, "yyyy-MM");
      if (nextStr > currentGregMonthStr) {
        return;
      }
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
    if (year > todayEC.year || (year === todayEC.year && month > todayEC.month)) {
      return;
    }
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
    isFuture: boolean;
    specialDay?: CalendarSpecialDay;
  }

  const gridDays: GridDayItem[] = useMemo(() => {
    if (calType === "ethiopian") {
      const totalDays = daysInMonthEth(ethYear, ethMonth);
      const list: GridDayItem[] = [];

      for (let d = 1; d <= totalDays; d++) {
        const gregStr = ethToGregorian(ethYear, ethMonth, d);
        const dow = getEthDayOfWeek(ethYear, ethMonth, d);
        const isWork = isWorkingDay(gregStr, workingDays, specialDays);
        const isCurr = gregStr === todayGC;
        const isFut = gregStr > todayGC;
        const gregDate = parseISO(gregStr);
        const secLabel = format(gregDate, "MMM d");
        const sDay = specialDays.find((sd) => sd.date === gregStr);

        list.push({
          gregorianDateStr: gregStr,
          primaryNumber: d,
          secondaryLabel: secLabel,
          dayOfWeek: dow,
          isWorkDay: isWork,
          isCurrentToday: isCurr,
          isFuture: isFut,
          specialDay: sDay,
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
        const isWork = isWorkingDay(d, workingDays, specialDays);
        const isCurr = isToday(d);
        const isFut = gregStr > todayGC;
        const mName = language === "am" ? ETH_MONTH_NAMES_AM[ethDate.month] : ETH_MONTH_NAMES_EN[ethDate.month];
        const secLabel = `${mName} ${ethDate.day}`;
        const sDay = specialDays.find((sd) => sd.date === gregStr);

        return {
          gregorianDateStr: gregStr,
          primaryNumber: d.getDate(),
          secondaryLabel: secLabel,
          dayOfWeek: dow,
          isWorkDay: isWork,
          isCurrentToday: isCurr,
          isFuture: isFut,
          specialDay: sDay,
        };
      });
    }
  }, [calType, ethYear, ethMonth, startDateStr, endDateStr, workingDays, todayGC, language, specialDays]);

  // Standard Monday start alignment (Mon=0, Tue=1, ..., Sun=6)
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
        const t = calculateDailyTarget(matchingPlan, item.gregorianDateStr, workingDays, specialDays);
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
  }, [gridDays, filteredEntries, plans, workingDays, specialDays]);

  // Month-wide Performance Totals
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

  // Header Title with proper leading for Ge'ez script
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
    <div className="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-5 pb-24">
      {/* ============================================================= */}
      {/* 1. TOP HEADER & EXECUTIVE ACTION BAR (IMPECCABLY RESPONSIVE) */}
      {/* ============================================================= */}
      <div className="space-y-3 pb-4 border-b border-slate-200">
        {/* Row A: Factory Brand + Title + Direct Emerald Entry Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 leading-relaxed">
              <span className="font-extrabold text-slate-700">{factoryName}</span>
              <span>•</span>
              <span className="text-emerald-700 font-extrabold flex items-center gap-1 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5" />
                {calType === "ethiopian" ? "የኢትዮጵያ ካላንደር (13 ወራት)" : "Gregorian Calendar"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight mt-0.5 flex items-center gap-2 leading-relaxed">
              <CalendarIcon className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>Calendar & Production</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isSelectedDayFuture}
              onClick={() => {
                if (!isSelectedDayFuture) {
                  router.push(`/entry?date=${activeDayDateStr || todayGC}`);
                }
              }}
              className={`btn btn-sm w-full sm:w-auto font-bold rounded-xl shadow-xs border-none gap-1.5 transition-all min-h-[44px] ${
                isSelectedDayFuture
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
              }`}
              title={isSelectedDayFuture ? "Cannot input numbers for future dates" : "Enter Daily Numbers"}
            >
              <PenTool className="w-4 h-4" />
              <span>{isSelectedDayFuture ? "Input Disabled (Future)" : "Enter Daily Numbers"}</span>
            </button>
          </div>
        </div>

        {/* Row B: Responsive Controls Ribbon (Wraps cleanly on mobile: flex-wrap sm:flex-nowrap gap-2) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-1">
          {/* Calendar System Switcher & Language Switcher */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Dual Calendar Mode Toggle */}
            <div className="join border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
              <button
                type="button"
                onClick={() => toggleCalendarType("ethiopian")}
                className={`btn btn-sm join-item text-xs font-extrabold min-h-[40px] px-3.5 ${
                  calType === "ethiopian"
                    ? "bg-slate-900 text-white hover:bg-black border-none"
                    : "btn-ghost text-slate-600"
                }`}
              >
                🇪🇹 Ethiopian
              </button>
              <button
                type="button"
                onClick={() => toggleCalendarType("gregorian")}
                className={`btn btn-sm join-item text-xs font-extrabold min-h-[40px] px-3.5 ${
                  calType === "gregorian"
                    ? "bg-slate-900 text-white hover:bg-black border-none"
                    : "btn-ghost text-slate-600"
                }`}
              >
                🌐 Gregorian
              </button>
            </div>

            {/* Language Toggle for Amharic Fidel vs English */}
            {calType === "ethiopian" && (
              <button
                type="button"
                onClick={() => setLanguage((l) => (l === "am" ? "en" : "am"))}
                className="btn btn-sm btn-outline rounded-xl text-xs font-bold shrink-0 min-h-[40px] leading-relaxed"
                title="Toggle Amharic / English Labels"
              >
                {language === "am" ? "ፊደል (አማ)" : "English"}
              </button>
            )}

            <button
              onClick={handleToday}
              className="btn btn-sm btn-outline rounded-xl text-xs font-bold shrink-0 min-h-[40px]"
            >
              Today
            </button>
          </div>

          {/* Month Stepper & Jumper */}
          <div className="join w-full sm:w-auto border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white flex items-center justify-between">
            <button
              onClick={handlePrevMonth}
              className="btn btn-sm btn-ghost join-item px-3 text-slate-600 hover:text-slate-900 min-h-[42px] min-w-[44px] flex items-center justify-center touch-manipulation"
              title="Previous Month"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => calType === "ethiopian" && setShowMonthJumper(true)}
              className="join-item px-3 sm:px-4 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black text-slate-900 hover:bg-slate-50 transition-colors flex-1 sm:flex-initial min-h-[42px] leading-relaxed"
            >
              <span className="truncate leading-relaxed">{headerTitle}</span>
              {calType === "ethiopian" ? (
                <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold shrink-0 flex items-center gap-0.5 leading-relaxed">
                  13M
                  <ChevronDown className="w-3 h-3 text-emerald-700" />
                </span>
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              )}
            </button>

            <button
              onClick={handleNextMonth}
              disabled={isNextMonthDisabled}
              className={`btn btn-sm btn-ghost join-item px-3 text-slate-600 hover:text-slate-900 min-h-[42px] min-w-[44px] flex items-center justify-center transition-all touch-manipulation ${
                isNextMonthDisabled
                  ? "opacity-30 cursor-not-allowed pointer-events-none text-slate-300"
                  : ""
              }`}
              title={isNextMonthDisabled ? "Next Month (Disabled - Future)" : "Next Month"}
              aria-label="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 2. MONTH PERFORMANCE KPI RIBBON (COMPACT & RESPONSIVE)        */}
      {/* ============================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 my-3 sm:my-4">
        {/* KPI 1: Output */}
        <div className="card bg-white border border-slate-200/90 shadow-2xs p-3 sm:p-4 rounded-2xl">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
            Month Total Output
          </span>
          <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
            <span className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tabular-nums leading-tight">
              {monthTotals.output.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
            {monthTotals.recordedDaysCount} days logged
          </div>
        </div>

        {/* KPI 2: Target & Variance */}
        <div className="card bg-white border border-slate-200/90 shadow-2xs p-3 sm:p-4 rounded-2xl">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
            Plan & Variance
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5 sm:mt-1 flex-wrap">
            <span className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tabular-nums leading-tight">
              {monthTotals.target > 0 ? Math.round(monthTotals.target).toLocaleString() : "No Plan"}
            </span>
            {monthTotals.target > 0 && (
              <span
                className={`text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 rounded-full flex items-center leading-none ${
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
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
            {monthTotals.completionPct !== null ? `${monthTotals.completionPct}% completed` : "No targets set"}
          </div>
        </div>

        {/* KPI 3: Working Days */}
        <div className="card bg-white border border-slate-200/90 shadow-2xs p-3 sm:p-4 rounded-2xl">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
            Working Days
          </span>
          <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
            <span className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 font-mono tabular-nums leading-tight">
              {monthTotals.workingDaysCount}
            </span>
            <span className="text-[11px] font-bold text-slate-400">days</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
            {gridDays.length - monthTotals.workingDaysCount} scheduled off / holidays
          </div>
        </div>

        {/* KPI 4: Coverage Logged */}
        <div className="card bg-white border border-slate-200/90 shadow-2xs p-3 sm:p-4 rounded-2xl">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
            Coverage Status
          </span>
          <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
            <span className="text-lg sm:text-2xl lg:text-3xl font-black text-emerald-700 font-mono tabular-nums leading-tight">
              {Math.round((monthTotals.recordedDaysCount / (monthTotals.workingDaysCount || 1)) * 100)}%
            </span>
            <span className="text-[11px] font-bold text-slate-400">logged</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
            {monthTotals.recordedDaysCount} of {monthTotals.workingDaysCount} active work days
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 3. RESPONSIVE FILTER & VIEW MODE TOOLBAR                      */}
      {/* ============================================================= */}
      <div className="flex flex-wrap sm:flex-nowrap items-stretch sm:items-center justify-between gap-2.5 mb-3 sm:mb-4 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Date Range & Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="hidden sm:inline font-bold uppercase tracking-wider text-[11px]">Range:</span>
            <span className="font-extrabold text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60 text-[11px] sm:text-xs">
              {headerSubrange}
            </span>
          </div>

          {availableLines.length > 0 && (
            <select
              value={selectedLineFilter}
              onChange={(e) => setSelectedLineFilter(e.target.value)}
              className="select select-xs sm:select-sm select-bordered rounded-xl text-xs font-semibold h-8 min-h-0 flex-1 sm:flex-initial"
            >
              <option value="all">All Lines</option>
              {availableLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {availableProducts.length > 0 && (
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="select select-xs sm:select-sm select-bordered rounded-xl text-xs font-semibold h-8 min-h-0 flex-1 sm:flex-initial"
            >
              <option value="all">All Products</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

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
        </div>

        {/* View Switcher: Compact, Grid, List (Cleanly wrapped on mobile) */}
        <div className="join bg-slate-100 p-0.5 rounded-xl border border-slate-200 w-full sm:w-auto grid grid-cols-3 sm:flex">
          <button
            type="button"
            onClick={() => setCalendarViewMode("compact")}
            className={`btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 flex items-center justify-center min-h-[36px] sm:min-h-[32px] ${
              calendarViewMode === "compact"
                ? "bg-white text-emerald-800 shadow-2xs"
                : "btn-ghost text-slate-600"
            }`}
            title="Compact View (Single screen UX)"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Compact</span>
          </button>

          <button
            type="button"
            onClick={() => setCalendarViewMode("grid")}
            className={`btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 flex items-center justify-center min-h-[36px] sm:min-h-[32px] ${
              calendarViewMode === "grid"
                ? "bg-white text-emerald-800 shadow-2xs"
                : "btn-ghost text-slate-600"
            }`}
            title="Month Grid View (Fluid 7-day layout)"
          >
            <GridIcon className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>

          <button
            type="button"
            onClick={() => setCalendarViewMode("list")}
            className={`btn btn-xs sm:btn-sm join-item rounded-lg font-bold gap-1 flex items-center justify-center min-h-[36px] sm:min-h-[32px] ${
              calendarViewMode === "list"
                ? "bg-white text-emerald-800 shadow-2xs"
                : "btn-ghost text-slate-600"
            }`}
            title="Agenda List View (Vertical feed)"
          >
            <ListIcon className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 4. 13-MONTH QUICK JUMPER MODAL (MESKEREM - PAGUME)            */}
      {/* ============================================================= */}
      {showMonthJumper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-relaxed">
                  {language === "am" ? "የኢትዮጵያ ወር እና ዓመት ይምረጡ" : "Select Ethiopian Month & Year"}
                </h3>
                <span className="text-xs text-slate-500 leading-relaxed">
                  13 Ethiopian Months (12 × 30 days + Pagume 5/6)
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
            <div className="my-3 sm:my-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 leading-relaxed">
                Year (ዓ.ም)
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[2015, 2016, 2017, 2018, 2019, 2020].map((y) => {
                  const isFutureYear = y > todayEC.year;
                  return (
                    <button
                      key={y}
                      type="button"
                      disabled={isFutureYear}
                      onClick={() => !isFutureYear && setEthYear(y)}
                      className={`btn btn-xs sm:btn-sm rounded-xl font-mono font-bold flex-1 min-h-[36px] ${
                        isFutureYear
                          ? "opacity-30 cursor-not-allowed bg-slate-100 text-slate-400 border-none"
                          : ethYear === y
                          ? "bg-emerald-600 text-white border-none shadow-xs"
                          : "btn-outline text-slate-600"
                      }`}
                      title={isFutureYear ? "Future Year (Disabled)" : undefined}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 13 Months Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 my-3">
              {Array.from({ length: 13 }).map((_, idx) => {
                const m = idx + 1;
                const isSelected = ethMonth === m;
                const isFutureMonth = ethYear > todayEC.year || (ethYear === todayEC.year && m > todayEC.month);
                const mNameAm = ETH_MONTH_NAMES_AM[m];
                const mNameEn = ETH_MONTH_NAMES_EN[m];

                return (
                  <button
                    key={m}
                    type="button"
                    disabled={isFutureMonth}
                    onClick={() => !isFutureMonth && jumpToEthMonth(ethYear, m)}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all min-h-[64px] flex flex-col items-center justify-center ${
                      isFutureMonth
                        ? "border-slate-200 bg-slate-100/70 text-slate-400 opacity-40 cursor-not-allowed pointer-events-none"
                        : isSelected
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-extrabold shadow-xs"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                    }`}
                    title={isFutureMonth ? `${mNameEn} (Disabled - Future Month)` : mNameEn}
                  >
                    <div className="text-sm sm:text-base font-bold leading-relaxed">{mNameAm}</div>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-mono leading-normal">{mNameEn}</div>
                    {isFutureMonth ? (
                      <span className="text-[8px] bg-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block leading-relaxed">
                        ወደፊት (Disabled)
                      </span>
                    ) : m === 13 ? (
                      <span className="text-[9px] sm:text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full mt-1 inline-block leading-relaxed">
                        Pagume
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 5. VIEW MODE: COMPACT CALENDAR + INLINE INSPECTION (MOBILE UX)*/}
      {/* ============================================================= */}
      {calendarViewMode === "compact" && (
        <div className="space-y-4">
          {/* Compact 7-Day Month Grid */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-3 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider truncate">
                Tap date to inspect production numbers
              </span>
              <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-500 font-medium shrink-0">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Ahead
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  Behind
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Holiday
                </span>
              </div>
            </div>

            {/* Weekday Headers with Abbreviated Day Names & Proper Ethiopic Leading */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs font-black uppercase text-slate-500 mb-1.5">
              {WEEKDAY_HEADERS.map((day, idx) => (
                <div key={`c_head_${idx}`} className={`py-1 ${day.isWeekend ? "text-slate-400" : ""}`}>
                  <span className="sm:hidden leading-relaxed">
                    {language === "am" ? day.amShort : day.enShort}
                  </span>
                  <span className="hidden sm:inline leading-relaxed">
                    {language === "am" ? day.amFull : day.enShort}
                  </span>
                </div>
              ))}
            </div>

            {/* Compact Day Cells (Touch Target >= 44x44px) */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: leadingBlanks }).map((_, idx) => (
                <div key={`cblank_${idx}`} className="aspect-square min-h-[44px] min-w-[44px] rounded-xl bg-slate-50/40" />
              ))}

              {gridDays.map((item) => {
                const summary = daySummaryMap.get(item.gregorianDateStr);
                const isSelected = activeDayDateStr === item.gregorianDateStr;
                const hasEntries = summary && summary.entries.length > 0;
                const hasTarget = summary?.hasTarget;
                const netVar = summary?.netVariance || 0;
                const isPositive = netVar >= 0;
                const isHoliday = !!item.specialDay && !item.specialDay.isWorkingDay;

                return (
                  <button
                    key={`c_${item.gregorianDateStr}`}
                    type="button"
                    onClick={() => setActiveDayDateStr(item.gregorianDateStr)}
                    className={`aspect-square min-h-[44px] min-w-[44px] sm:min-h-[56px] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-1 relative transition-all text-left active:scale-95 touch-manipulation ${
                      isSelected
                        ? "bg-slate-900 text-white font-black shadow-md ring-2 ring-emerald-500"
                        : item.isCurrentToday
                        ? "border-2 border-emerald-500 bg-white text-slate-900 shadow-xs"
                        : item.isFuture
                        ? "bg-slate-50/50 border border-slate-200/50 text-slate-300"
                        : isHoliday
                        ? "bg-amber-50/80 border border-amber-300 text-amber-900 font-bold"
                        : item.isWorkDay
                        ? "bg-white border border-slate-200/80 hover:border-emerald-300 text-slate-800"
                        : "bg-slate-100/70 border border-slate-200/50 text-slate-400"
                    }`}
                  >
                    {/* Primary Date Number */}
                    <span className="text-xs sm:text-sm font-bold font-mono tabular-nums leading-none">
                      {item.primaryNumber}
                    </span>

                    {/* Secondary Date Micro-Label (Clear Distinction) */}
                    <span
                      className={`text-[8px] sm:text-[9px] font-mono leading-relaxed mt-0.5 block truncate max-w-full ${
                        isSelected
                          ? "text-slate-300"
                          : isHoliday
                          ? "text-amber-700"
                          : "text-slate-400"
                      }`}
                      title={calType === "ethiopian" ? `Gregorian: ${item.secondaryLabel}` : `Ethiopian: ${item.secondaryLabel}`}
                    >
                      {item.secondaryLabel}
                    </span>

                    {/* Indicator Dot */}
                    <div className="mt-1 flex items-center justify-center gap-0.5">
                      {isHoliday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                      )}
                      {hasEntries && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected
                              ? "bg-emerald-400"
                              : hasTarget
                              ? isPositive
                                ? "bg-emerald-500"
                                : "bg-rose-500"
                              : "bg-slate-400"
                          }`}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline Active Day Details Card */}
          {activeDayDateStr && activeDaySummary && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs space-y-4 animate-in fade-in duration-150">
              {/* Header with Title and Green Edit Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Selected Date Inspection
                  </span>
                  <h2 className="text-base sm:text-xl font-black text-slate-900 mt-0.5 leading-relaxed">
                    {formatEthDate(gregorianToEth(activeDayDateStr), language === "am" ? "full_am" : "full_en")}
                  </h2>
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    {format(parseISO(activeDayDateStr), "EEEE, MMMM d, yyyy")}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSelectedDayFuture}
                    onClick={() => !isSelectedDayFuture && router.push(`/entry?date=${activeDayDateStr}`)}
                    className={`btn btn-sm w-full sm:w-auto rounded-xl font-bold gap-1.5 border-none min-h-[40px] ${
                      isSelectedDayFuture
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    }`}
                    title={isSelectedDayFuture ? "Cannot input numbers for future dates" : "Edit Daily Numbers"}
                  >
                    <PenTool className="w-4 h-4" />
                    <span>{isSelectedDayFuture ? "Input Disabled (Future Date)" : "Edit Daily Numbers"}</span>
                  </button>
                </div>
              </div>

              {/* Future Date Alert Notice */}
              {isSelectedDayFuture && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-slate-600">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Future Date:</strong> Production numbers cannot be entered for upcoming dates or future months.
                  </span>
                </div>
              )}

              {/* Special Day / Holiday Banner */}
              {activeDayItem?.specialDay && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5">
                  <PartyPopper className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <div className="font-extrabold text-amber-900 text-xs sm:text-sm leading-relaxed">
                      {activeDayItem.specialDay.nameEn}
                      {activeDayItem.specialDay.nameAm && (
                        <span className="ml-1.5 text-amber-800 font-bold leading-relaxed">
                          ({activeDayItem.specialDay.nameAm})
                        </span>
                      )}
                    </div>
                    <div className="text-amber-700 mt-0.5 font-medium leading-relaxed flex items-center gap-1.5">
                      <span
                        className={`badge badge-xs font-bold leading-relaxed ${
                          activeDayItem.specialDay.isWorkingDay ? "badge-info" : "badge-warning"
                        }`}
                      >
                        {activeDayItem.specialDay.isWorkingDay ? "Working Holiday" : "Public Holiday"}
                      </span>
                      <span>
                        • {activeDayItem.specialDay.isWorkingDay ? "Factory Operating as Scheduled" : "Factory Closed (Scheduled Off)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Day Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/70">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase">
                    Total Output
                  </span>
                  <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono tabular-nums mt-0.5">
                    {activeDaySummary.totalFG.toLocaleString()} <span className="text-xs font-normal text-slate-400">pcs</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/70">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase">
                    Daily Target
                  </span>
                  <div className="text-lg sm:text-2xl font-black text-slate-700 font-mono tabular-nums mt-0.5">
                    {activeDaySummary.hasTarget
                      ? `${Math.round(activeDaySummary.totalTarget).toLocaleString()} pcs`
                      : "No plan"}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/70 col-span-2 sm:col-span-1">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase">
                    Daily Variance
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {activeDaySummary.hasTarget ? (
                      <span
                        className={`text-xs sm:text-sm font-black font-mono tabular-nums px-2.5 py-0.5 rounded-lg ${
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
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
                  Production Lines Recorded ({activeDaySummary.entries.length})
                </h3>

                {activeDaySummary.entries.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                    {isSelectedDayFuture ? (
                      <span>Future date — production input is inactive and not permitted yet.</span>
                    ) : (
                      <>
                        No production report submitted for this date.
                        <div className="mt-2.5">
                          <button
                            onClick={() => router.push(`/entry?date=${activeDayDateStr}`)}
                            className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold border-none"
                          >
                            Create Report for this Date
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                    {activeDaySummary.entries.map((entry) => {
                      const plan = plans.find(
                        (p) =>
                          p.lineId === entry.lineId &&
                          p.productId === entry.productId
                      );
                      const target = calculateDailyTarget(
                        plan,
                        activeDayDateStr,
                        workingDays,
                        specialDays
                      );
                      const variance = target.hasTarget
                        ? calculateVariance(entry.finishedGood, target.dailyTarget)
                        : null;

                      return (
                        <div
                          key={`inline_${entry.id}`}
                          className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5"
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
                              <span className="text-sm sm:text-base font-black font-mono text-slate-900 tabular-nums">
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

                          {/* Quality metrics strip */}
                          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-200/60 text-center text-xs">
                            <div className="bg-white p-1 rounded-xl border border-slate-200/50">
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Rew</span>
                              <span className="font-mono font-bold text-slate-800 text-xs">{entry.rework}</span>
                            </div>
                            <div className="bg-white p-1 rounded-xl border border-slate-200/50">
                              <span className="text-[9px] text-rose-800 block uppercase font-bold">Rej</span>
                              <span className="font-mono font-bold text-rose-700 text-xs">{entry.reject}</span>
                            </div>
                            <div className="bg-white p-1 rounded-xl border border-slate-200/50">
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">WIP</span>
                              <span className="font-mono font-bold text-slate-800 text-xs">{entry.wip}</span>
                            </div>
                            <div className="bg-white p-1 rounded-xl border border-slate-200/50">
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Down</span>
                              <span
                                className={`font-mono font-bold text-xs ${
                                  entry.downtimeMinutes > 0 ? "text-amber-600" : "text-slate-800"
                                }`}
                              >
                                {entry.downtimeMinutes}m
                              </span>
                            </div>
                          </div>

                          {entry.issueNote && (
                            <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 p-2 rounded-xl flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{entry.issueNote}</span>
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
      {/* 6. VIEW MODE: FLUID MONTH GRID VIEW (100% RESPONSIVE)         */}
      {/* ============================================================= */}
      {calendarViewMode === "grid" && (
        <div className="w-full overflow-x-auto pb-2 -mx-1 px-1 sm:mx-0 sm:px-0">
          <div className="min-w-[320px] sm:min-w-0">
            {/* Weekday Column Headers with Abbreviated Day Names & Ethiopic Leading */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2 text-center text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 my-1.5 sm:my-2">
              {WEEKDAY_HEADERS.map((day, idx) => (
                <div key={`g_head_${idx}`} className={`py-1 ${day.isWeekend ? "text-slate-400" : ""}`}>
                  <span className="sm:hidden leading-relaxed">
                    {language === "am" ? day.amShort : day.enShort}
                  </span>
                  <span className="hidden sm:inline lg:hidden leading-relaxed">
                    {language === "am" ? day.amShort : day.enShort}
                  </span>
                  <span className="hidden lg:inline leading-relaxed">
                    {language === "am" ? day.amFull : day.enFull}
                  </span>
                </div>
              ))}
            </div>

            {/* Calendar Month Grid: Touch Target >= 44x44px, Clear Dual Calendar Distinction */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
              {/* Leading blanks */}
              {Array.from({ length: leadingBlanks }).map((_, idx) => (
                <div
                  key={`blank_${idx}`}
                  className="min-h-[56px] sm:min-h-[76px] md:min-h-[98px] lg:min-h-[115px] rounded-xl sm:rounded-2xl bg-slate-50/40 border border-transparent"
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
                const isHoliday = !!item.specialDay && !item.specialDay.isWorkingDay;

                return (
                  <button
                    key={item.gregorianDateStr}
                    type="button"
                    onClick={() => setActiveDayDateStr(item.gregorianDateStr)}
                    className={`w-full min-h-[56px] sm:min-h-[76px] md:min-h-[98px] lg:min-h-[115px] p-1 sm:p-2 md:p-2.5 rounded-xl sm:rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 touch-manipulation ${
                      isSelected
                        ? "ring-2 ring-slate-900 border-slate-900 bg-emerald-50/40 shadow-sm"
                        : item.isCurrentToday
                        ? "border-emerald-500 bg-white shadow-2xs"
                        : item.isFuture
                        ? "bg-slate-50/60 border-slate-200/60 text-slate-400"
                        : isHoliday
                        ? "bg-amber-50/80 border-amber-300 hover:border-amber-400 text-amber-900"
                        : item.isWorkDay
                        ? "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-2xs text-slate-800"
                        : "bg-slate-100/60 border-slate-200 text-slate-400"
                    }`}
                  >
                    {/* Day Header */}
                    <div className="flex items-start justify-between w-full">
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-xs sm:text-sm md:text-base font-black font-mono tabular-nums inline-block leading-none ${
                              item.isCurrentToday
                                ? "text-emerald-700 font-extrabold"
                                : item.isFuture
                                ? "text-slate-400"
                                : isHoliday
                                ? "text-amber-900"
                                : "text-slate-900 group-hover:text-emerald-700"
                            }`}
                          >
                            {item.primaryNumber}
                          </span>
                        </div>

                        {/* Distinct Secondary Calendar Date with EC / GC prefix */}
                        <span
                          className={`text-[8px] sm:text-[9px] md:text-[10px] font-mono leading-relaxed truncate max-w-full block ${
                            isSelected
                              ? "text-emerald-700 font-semibold"
                              : isHoliday
                              ? "text-amber-800/80"
                              : "text-slate-400"
                          }`}
                          title={calType === "ethiopian" ? `Gregorian: ${item.secondaryLabel}` : `Ethiopian: ${item.secondaryLabel}`}
                        >
                          <span className="opacity-70 text-[7px] sm:text-[8px] mr-0.5">
                            {calType === "ethiopian" ? "GC" : "EC"}
                          </span>
                          {item.secondaryLabel}
                        </span>
                      </div>

                      {/* Status Pill on Day Tile */}
                      <div>
                        {item.isFuture ? (
                          <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 bg-slate-100 px-1 py-0.5 rounded leading-none">
                            Future
                          </span>
                        ) : isHoliday ? (
                          <span className="text-[8px] sm:text-[9px] font-black text-amber-800 bg-amber-100 px-1 py-0.5 rounded leading-none">
                            <span className="sm:hidden">✦</span>
                            <span className="hidden sm:inline leading-relaxed">Holiday</span>
                          </span>
                        ) : !item.isWorkDay ? (
                          <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 bg-slate-200/60 px-1 py-0.5 rounded leading-none">
                            Off
                          </span>
                        ) : item.isCurrentToday ? (
                          <span className="text-[8px] sm:text-[9px] font-black text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded leading-none">
                            Today
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Production Number & Variance Badge */}
                    <div className="w-full my-0.5 sm:my-1">
                      {hasEntries ? (
                        <>
                          <div className="text-[11px] sm:text-xs md:text-sm lg:text-base font-black text-slate-900 font-mono tabular-nums tracking-tight leading-tight">
                            {summary.totalFG.toLocaleString()}
                            <span className="hidden sm:inline text-[9px] font-normal text-slate-400 ml-0.5">
                              pcs
                            </span>
                          </div>

                          {/* Variance badge */}
                          {hasTarget ? (
                            <div className="mt-0.5 flex items-center">
                              <span
                                className={`text-[9px] sm:text-[10px] md:text-[11px] font-black font-mono tabular-nums px-1 sm:px-1.5 py-0.2 rounded ${
                                  isPositive
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {varFormatted}
                              </span>
                            </div>
                          ) : (
                            <span className="hidden sm:inline text-[9px] text-slate-400 font-mono">
                              No plan
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="text-[10px] sm:text-xs text-slate-300 font-mono">
                          {item.isWorkDay ? "−" : ""}
                        </div>
                      )}
                    </div>

                    {/* Micro action visible on desktop */}
                    <div className="hidden lg:block text-[9px] text-emerald-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Inspect →
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 7. VIEW MODE: AGENDA / DAY LIST VIEW (CLEAN TIMELINE)         */}
      {/* ============================================================= */}
      {calendarViewMode === "list" && (
        <div className="space-y-2 sm:space-y-2.5">
          {gridDays.map((item) => {
            const summary = daySummaryMap.get(item.gregorianDateStr);
            const isSelected = activeDayDateStr === item.gregorianDateStr;
            const hasTarget = summary?.hasTarget;
            const netVar = summary?.netVariance || 0;
            const isPositive = netVar >= 0;
            const hasEntries = summary && summary.entries.length > 0;
            const isHoliday = !!item.specialDay && !item.specialDay.isWorkingDay;

            return (
              <button
                key={`list_${item.gregorianDateStr}`}
                type="button"
                onClick={() => setActiveDayDateStr(item.gregorianDateStr)}
                className={`w-full p-3 sm:p-4 rounded-2xl border transition-all text-left flex items-center justify-between shadow-2xs touch-manipulation ${
                  isSelected
                    ? "ring-2 ring-slate-900 bg-emerald-50/40 border-slate-900"
                    : item.isCurrentToday
                    ? "border-emerald-500 bg-white"
                    : isHoliday
                    ? "bg-amber-50/80 border-amber-300"
                    : "bg-white border-slate-200 hover:border-emerald-200"
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 flex flex-col items-center justify-center font-mono shrink-0">
                    <span className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                      {item.primaryNumber}
                    </span>
                    <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase leading-none font-bold">
                      {item.secondaryLabel}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm md:text-base font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                      {hasEntries ? (
                        <span>{summary.totalFG.toLocaleString()} pcs output</span>
                      ) : item.isFuture ? (
                        <span className="text-slate-400 italic">Future date — input disabled</span>
                      ) : isHoliday ? (
                        <span className="text-amber-800 font-extrabold flex items-center gap-1 leading-relaxed">
                          <PartyPopper className="w-3.5 h-3.5 shrink-0" />
                          <span className="leading-relaxed">
                            {item.specialDay?.nameEn}
                            {item.specialDay?.nameAm && (
                              <span className="ml-1 font-semibold text-amber-700 leading-relaxed">
                                ({item.specialDay.nameAm})
                              </span>
                            )}
                          </span>
                        </span>
                      ) : item.isWorkDay ? (
                        <span className="text-slate-500">No report recorded</span>
                      ) : (
                        <span className="text-slate-400">Scheduled day off</span>
                      )}
                    </div>
                    {hasTarget && (
                      <div className="text-[11px] sm:text-xs text-slate-400 font-mono">
                        Target: {Math.round(summary.totalTarget).toLocaleString()} pcs
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasEntries && hasTarget && (
                    <span
                      className={`text-[11px] sm:text-xs font-black font-mono px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl ${
                        isPositive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {isPositive ? `+${Math.round(netVar)}` : Math.round(netVar)}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================= */}
      {/* 8. SLIDE-OVER DRAWER / BOTTOM SHEET (GRID & LIST VIEW MODES)  */}
      {/* ============================================================= */}
      {calendarViewMode !== "compact" && activeDayDateStr && activeDaySummary && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveDayDateStr(null)}
          />

          {/* Drawer Container (Desktop: right slide-over, Mobile: native bottom sheet) */}
          <div className="fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-full sm:w-[500px] sm:rounded-none bg-white shadow-2xl flex flex-col z-10 overflow-y-auto border-t sm:border-t-0 sm:border-l border-slate-200 pb-safe animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
            {/* Mobile Drag Handle Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />

            {/* Drawer Header with Full Dual Dates */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-white/95 backdrop-blur z-20 flex items-center justify-between sticky top-0">
              <div>
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 leading-relaxed">
                  <span>{factoryName}</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-extrabold leading-relaxed">Day Inspection</span>
                </span>
                <h3 className="text-base sm:text-xl font-black text-slate-900 mt-0.5 leading-relaxed">
                  {formatEthDate(gregorianToEth(activeDayDateStr), language === "am" ? "full_am" : "full_en")}
                </h3>
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  {format(parseISO(activeDayDateStr), "EEEE, MMMM d, yyyy")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSelectedDayFuture}
                  onClick={() => !isSelectedDayFuture && router.push(`/entry?date=${activeDayDateStr}`)}
                  className={`btn btn-sm rounded-xl font-bold border-none min-h-[38px] ${
                    isSelectedDayFuture
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  }`}
                  title={isSelectedDayFuture ? "Cannot input numbers for future dates" : "Edit Report"}
                >
                  <PenTool className="w-3.5 h-3.5 mr-1" />
                  {isSelectedDayFuture ? "Input Disabled" : "Edit Report"}
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
            <div className="p-4 sm:p-5 space-y-5">
              {/* Future Date Alert Notice */}
              {isSelectedDayFuture && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-slate-600">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Future Date:</strong> Production numbers cannot be entered for upcoming dates or future months.
                  </span>
                </div>
              )}

              {/* Special Day / Holiday Banner with Proper Ethiopic Leading */}
              {activeDayItem?.specialDay && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <PartyPopper className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <div className="font-extrabold text-amber-900 text-sm leading-relaxed">
                      {activeDayItem.specialDay.nameEn}
                      {activeDayItem.specialDay.nameAm && (
                        <span className="ml-1.5 text-amber-800 font-bold leading-relaxed">
                          ({activeDayItem.specialDay.nameAm})
                        </span>
                      )}
                    </div>
                    <div className="text-amber-700 mt-0.5 font-medium leading-relaxed flex items-center gap-1.5">
                      <span
                        className={`badge badge-xs font-bold leading-relaxed ${
                          activeDayItem.specialDay.isWorkingDay ? "badge-info" : "badge-warning"
                        }`}
                      >
                        {activeDayItem.specialDay.isWorkingDay ? "Working Holiday" : "Public Holiday"}
                      </span>
                      <span>
                        • {activeDayItem.specialDay.isWorkingDay ? "Factory Operating as Scheduled" : "Factory Closed (Scheduled Off)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Day Performance Card: Output, Target, Variance */}
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
                    <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
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
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                  Line Breakdown ({activeDaySummary.entries.length} recorded)
                </h4>

                {activeDaySummary.entries.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                    {isSelectedDayFuture ? (
                      <span>Future date — production input is inactive and not permitted yet.</span>
                    ) : (
                      <>
                        No production report recorded for this date.
                        <div className="mt-3">
                          <button
                            onClick={() => router.push(`/entry?date=${activeDayDateStr}`)}
                            className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold border-none"
                          >
                            Enter Report for this Date
                          </button>
                        </div>
                      </>
                    )}
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
                        workingDays,
                        specialDays
                      );
                      const variance = target.hasTarget
                        ? calculateVariance(entry.finishedGood, target.dailyTarget)
                        : null;

                      return (
                        <div
                          key={entry.id}
                          className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-2.5"
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
                          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-center text-xs">
                            <div className="bg-slate-50 p-1.5 rounded-xl">
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Rework</span>
                              <span className="font-mono font-bold text-slate-800 text-xs">{entry.rework}</span>
                            </div>
                            <div className="bg-rose-50/50 p-1.5 rounded-xl border border-rose-100">
                              <span className="text-[9px] text-rose-800 block uppercase font-bold">Reject</span>
                              <span className="font-mono font-bold text-rose-700 text-xs">{entry.reject}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded-xl">
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">WIP</span>
                              <span className="font-mono font-bold text-slate-800 text-xs">{entry.wip}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded-xl">
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Downtime</span>
                              <span
                                className={`font-mono font-bold text-xs ${
                                  entry.downtimeMinutes > 0 ? "text-amber-600" : "text-slate-800"
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
