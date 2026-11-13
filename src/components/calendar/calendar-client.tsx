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
  Boxes,
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
  products?: { id: string; name: string; sku?: string }[];
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

const GREG_MONTHS = [
  { num: 1, name: "January", short: "Jan" },
  { num: 2, name: "February", short: "Feb" },
  { num: 3, name: "March", short: "Mar" },
  { num: 4, name: "April", short: "Apr" },
  { num: 5, name: "May", short: "May" },
  { num: 6, name: "June", short: "Jun" },
  { num: 7, name: "July", short: "Jul" },
  { num: 8, name: "August", short: "Aug" },
  { num: 9, name: "September", short: "Sep" },
  { num: 10, name: "October", short: "Oct" },
  { num: 11, name: "November", short: "Nov" },
  { num: 12, name: "December", short: "Dec" },
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

  const currentGregYear = useMemo(() => {
    try {
      return parseInt(initialGregMonthStr.split("-")[0], 10);
    } catch {
      return new Date().getFullYear();
    }
  }, [initialGregMonthStr]);

  const [gregJumperYear, setGregJumperYear] = useState<number>(currentGregYear);

  useEffect(() => {
    setGregJumperYear(currentGregYear);
  }, [currentGregYear]);

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

  // Close drawer or modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showMonthJumper) {
          setShowMonthJumper(false);
        } else if (activeDayDateStr) {
          setActiveDayDateStr(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMonthJumper, activeDayDateStr]);

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

  const jumpToGregorianMonth = (year: number, month: number) => {
    const mStr = String(month).padStart(2, "0");
    const targetMonthStr = `${year}-${mStr}`;
    if (targetMonthStr > currentGregMonthStr) {
      return;
    }
    setShowMonthJumper(false);
    router.push(`/calendar?cal=gregorian&month=${targetMonthStr}`);
  };

  // Filter dropdowns
  const availableLines = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => map.set(e.lineId, e.lineName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const availableProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku?: string }>();
    if (products) {
      products.forEach((p) => map.set(p.id, { id: p.id, name: p.name, sku: (p as any).sku }));
    }
    plans.forEach((p) => {
      if (!map.has(p.productId)) {
        map.set(p.productId, { id: p.productId, name: (p as any).productName || "Product" });
      }
    });
    entries.forEach((e) => {
      if (!map.has(e.productId)) {
        map.set(e.productId, { id: e.productId, name: e.productName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products, plans, entries]);

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
        productBreakdown: Array<{
          productId: string;
          productName: string;
          fg: number;
          target: number;
          hasTarget: boolean;
        }>;
      }
    >();

    // Relevant plans based on filters
    const relevantPlans = plans.filter((p) => {
      if (selectedLineFilter !== "all" && p.lineId !== selectedLineFilter) return false;
      if (selectedProductFilter !== "all" && p.productId !== selectedProductFilter) return false;
      return true;
    });

    gridDays.forEach((item) => {
      const dayEntries = filteredEntries.filter((e) => e.date === item.gregorianDateStr);

      let dayTotalFG = 0;
      let dayTotalTarget = 0;
      let dayHasTarget = false;

      const productBreakdownMap = new Map<
        string,
        {
          productId: string;
          productName: string;
          fg: number;
          target: number;
          hasTarget: boolean;
        }
      >();

      dayEntries.forEach((e) => {
        dayTotalFG += e.finishedGood;
        if (!productBreakdownMap.has(e.productId)) {
          productBreakdownMap.set(e.productId, {
            productId: e.productId,
            productName: e.productName,
            fg: 0,
            target: 0,
            hasTarget: false,
          });
        }
        productBreakdownMap.get(e.productId)!.fg += e.finishedGood;
      });

      relevantPlans.forEach((p) => {
        const t = calculateDailyTarget(p, item.gregorianDateStr, workingDays, specialDays);
        if (t.hasTarget) {
          dayTotalTarget += t.dailyTarget;
          dayHasTarget = true;

          const prodMeta = availableProducts.find((ap) => ap.id === p.productId);
          const pName = prodMeta?.name || (p as any).productName || "Product";
          if (!productBreakdownMap.has(p.productId)) {
            productBreakdownMap.set(p.productId, {
              productId: p.productId,
              productName: pName,
              fg: 0,
              target: 0,
              hasTarget: false,
            });
          }
          const pItem = productBreakdownMap.get(p.productId)!;
          pItem.target += t.dailyTarget;
          pItem.hasTarget = true;
        }
      });

      map.set(item.gregorianDateStr, {
        totalFG: dayTotalFG,
        totalTarget: dayTotalTarget,
        hasTarget: dayHasTarget,
        netVariance: dayHasTarget ? dayTotalFG - dayTotalTarget : 0,
        entries: dayEntries,
        productBreakdown: Array.from(productBreakdownMap.values()),
      });
    });

    return map;
  }, [gridDays, filteredEntries, plans, workingDays, specialDays, selectedLineFilter, selectedProductFilter, availableProducts]);

  // Month-level Product Summaries
  const monthProductSummaries = useMemo(() => {
    return availableProducts.map((prod) => {
      let prodFG = 0;
      let prodTarget = 0;
      let prodHasTarget = false;

      // Filter entries for this product (also respecting line filter)
      const prodEntries = entries.filter((e) => {
        if (e.productId !== prod.id) return false;
        if (selectedLineFilter !== "all" && e.lineId !== selectedLineFilter) return false;
        return true;
      });

      prodEntries.forEach((e) => {
        prodFG += e.finishedGood;
      });

      // Target across all gridDays
      const prodPlans = plans.filter((p) => {
        if (p.productId !== prod.id) return false;
        if (selectedLineFilter !== "all" && p.lineId !== selectedLineFilter) return false;
        return true;
      });

      gridDays.forEach((d) => {
        prodPlans.forEach((p) => {
          const t = calculateDailyTarget(p, d.gregorianDateStr, workingDays, specialDays);
          if (t.hasTarget) {
            prodTarget += t.dailyTarget;
            prodHasTarget = true;
          }
        });
      });

      const netVar = prodHasTarget ? prodFG - prodTarget : 0;
      const completionPct = prodTarget > 0 ? Math.round((prodFG / prodTarget) * 100) : null;

      return {
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        totalFG: prodFG,
        totalTarget: prodTarget,
        hasTarget: prodHasTarget,
        netVariance: netVar,
        completionPct,
        entriesCount: prodEntries.length,
      };
    });
  }, [availableProducts, entries, plans, gridDays, workingDays, specialDays, selectedLineFilter]);

  // Active day details for inspection drawer / inline card
  const activeDaySummary = activeDayDateStr ? daySummaryMap.get(activeDayDateStr) : null;
  const activeDayItem = activeDayDateStr
    ? gridDays.find((g) => g.gregorianDateStr === activeDayDateStr)
    : null;

  // Active Day grouped by Product
  const activeDayProductGroups = useMemo(() => {
    if (!activeDaySummary || !activeDayDateStr) return [];

    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku?: string;
        totalFG: number;
        totalTarget: number;
        hasTarget: boolean;
        netVariance: number;
        entries: CalendarEntry[];
      }
    >();

    activeDaySummary.entries.forEach((e) => {
      const prodMeta = availableProducts.find((p) => p.id === e.productId);
      if (!map.has(e.productId)) {
        map.set(e.productId, {
          productId: e.productId,
          productName: e.productName,
          sku: prodMeta?.sku,
          totalFG: 0,
          totalTarget: 0,
          hasTarget: false,
          netVariance: 0,
          entries: [],
        });
      }

      const g = map.get(e.productId)!;
      g.totalFG += e.finishedGood;
      g.entries.push(e);

      const plan = plans.find(
        (p) => p.lineId === e.lineId && p.productId === e.productId
      );
      const target = calculateDailyTarget(
        plan,
        activeDayDateStr,
        workingDays,
        specialDays
      );
      if (target.hasTarget) {
        g.totalTarget += target.dailyTarget;
        g.hasTarget = true;
      }
    });

    map.forEach((g) => {
      g.netVariance = g.hasTarget ? g.totalFG - g.totalTarget : 0;
    });

    return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [activeDaySummary, activeDayDateStr, availableProducts, plans, workingDays, specialDays]);

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
    <div className="max-w-7xl 2xl:max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16 py-3 sm:py-4.5 pb-24 space-y-3 sm:space-y-4">
      {/* ============================================================= */}
      {/* 1. COMPACT PAGE HEADER & EXECUTIVE ACTION BAR                */}
      {/* ============================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="font-extrabold text-slate-700">{factoryName}</span>
            <span>•</span>
            <span className="text-emerald-700 font-extrabold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {calType === "ethiopian" ? "የኢትዮጵያ ካላንደር (13 ወራት)" : "Gregorian Calendar"}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
            <CalendarIcon className="w-5 h-5 text-emerald-600 shrink-0" />
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
            className={`btn btn-sm h-8 sm:h-9 w-full sm:w-auto font-bold rounded-xl shadow-xs border-none gap-1.5 transition-all text-xs ${
              isSelectedDayFuture
                ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
            }`}
            title={isSelectedDayFuture ? "Cannot input numbers for future dates" : "Enter Daily Numbers"}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>{isSelectedDayFuture ? "Input Disabled (Future)" : "Enter Daily Numbers"}</span>
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 2. COMPACT MONTH PERFORMANCE KPI RIBBON                      */}
      {/* ============================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* KPI 1: Output */}
        <div className="bg-white border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 rounded-xl">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate block">
            Month Total Output
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 font-mono tabular-nums leading-tight">
              {monthTotals.output.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            {monthTotals.recordedDaysCount} days logged
          </div>
        </div>

        {/* KPI 2: Target & Variance */}
        <div className="bg-white border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 rounded-xl">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate block">
            Plan & Variance
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
            <span className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 font-mono tabular-nums leading-tight">
              {monthTotals.target > 0 ? Math.round(monthTotals.target).toLocaleString() : "No Plan"}
            </span>
            {monthTotals.target > 0 && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-md flex items-center leading-none ${
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
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            {monthTotals.completionPct !== null ? `${monthTotals.completionPct}% completed` : "No targets set"}
          </div>
        </div>

        {/* KPI 3: Working Days */}
        <div className="bg-white border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 rounded-xl">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate block">
            Working Days
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 font-mono tabular-nums leading-tight">
              {monthTotals.workingDaysCount}
            </span>
            <span className="text-[10px] font-bold text-slate-400">days</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            {gridDays.length - monthTotals.workingDaysCount} scheduled off / holidays
          </div>
        </div>

        {/* KPI 4: Coverage Logged */}
        <div className="bg-white border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 rounded-xl">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate block">
            Coverage Status
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base sm:text-xl lg:text-2xl font-black text-emerald-700 font-mono tabular-nums leading-tight">
              {Math.round((monthTotals.recordedDaysCount / (monthTotals.workingDaysCount || 1)) * 100)}%
            </span>
            <span className="text-[10px] font-bold text-slate-400">logged</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            {monthTotals.recordedDaysCount} of {monthTotals.workingDaysCount} active work days
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 3. PRODUCT MONTH PERFORMANCE STRIP (COMPACT PILLS)            */}
      {/* ============================================================= */}
      {monthProductSummaries.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Boxes className="w-3 h-3 text-emerald-600" />
              <span>Product Month Performance</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Filter by product
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
            {/* All Products Pill */}
            <button
              type="button"
              onClick={() => setSelectedProductFilter("all")}
              className={`px-2.5 py-1.5 rounded-lg border text-left shrink-0 transition-all text-xs ${
                selectedProductFilter === "all"
                  ? "bg-emerald-50 border-emerald-400 ring-1 ring-emerald-500/20 shadow-2xs"
                  : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                All Products
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono font-black text-xs text-slate-900">
                  {monthTotals.output.toLocaleString()}
                </span>
                <span className="text-[9px] text-slate-400">pcs</span>
              </div>
            </button>

            {/* Individual Product Pills */}
            {monthProductSummaries.map((prod) => {
              const isSelected = selectedProductFilter === prod.id;
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() =>
                    setSelectedProductFilter(isSelected ? "all" : prod.id)
                  }
                  className={`px-2.5 py-1.5 rounded-lg border text-left shrink-0 transition-all text-xs ${
                    isSelected
                      ? "bg-emerald-50 border-emerald-400 ring-1 ring-emerald-500/20 shadow-2xs"
                      : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                      {prod.name}
                    </span>
                    {prod.sku && (
                      <span className="text-[8px] font-mono font-bold bg-white px-1 py-0.2 rounded text-slate-600 border border-slate-200">
                        {prod.sku}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="font-mono font-black text-xs text-slate-900">
                      {prod.totalFG.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-slate-400">pcs</span>
                    {prod.hasTarget && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded ${
                          prod.netVariance >= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {prod.netVariance >= 0 ? `+${prod.netVariance}` : `${prod.netVariance}`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 4. UNIFIED CALENDAR TOOLBAR (DIRECTLY ATOP THE CALENDAR)       */}
      {/* ============================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 sm:p-2.5 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Month Stepper & Jumper + Today + Calendar Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Month Stepper & Jumper */}
            <div className="join border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white flex items-center">
              <button
                onClick={handlePrevMonth}
                className="btn btn-xs sm:btn-sm btn-ghost join-item h-8 min-h-0 px-2.5 text-slate-600 hover:text-slate-900"
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowMonthJumper(true)}
                className="join-item px-2.5 sm:px-3 h-8 flex items-center justify-center gap-1 text-xs sm:text-sm font-black text-slate-900 hover:bg-slate-50 transition-colors"
                title={calType === "ethiopian" ? "Jump to Ethiopian Month" : "Jump to Gregorian Month"}
              >
                <span className="truncate">{headerTitle}</span>
                {calType === "ethiopian" ? (
                  <span className="text-[9px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-mono font-bold shrink-0 flex items-center gap-0.5">
                    13M
                    <ChevronDown className="w-2.5 h-2.5 text-emerald-700" />
                  </span>
                ) : (
                  <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                )}
              </button>

              <button
                onClick={handleNextMonth}
                disabled={isNextMonthDisabled}
                className={`btn btn-xs sm:btn-sm btn-ghost join-item h-8 min-h-0 px-2.5 text-slate-600 hover:text-slate-900 transition-all ${
                  isNextMonthDisabled
                    ? "opacity-30 cursor-not-allowed pointer-events-none text-slate-300"
                    : ""
                }`}
                title={isNextMonthDisabled ? "Next Month (Disabled - Future)" : "Next Month"}
                aria-label="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Today Button */}
            <button
              onClick={handleToday}
              className="btn btn-xs sm:btn-sm btn-outline h-8 min-h-0 rounded-xl text-xs font-bold px-2.5"
            >
              Today
            </button>

            {/* Dual Calendar Mode Toggle */}
            <div className="join border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
              <button
                type="button"
                onClick={() => toggleCalendarType("ethiopian")}
                className={`btn btn-xs sm:btn-sm join-item h-8 min-h-0 text-xs font-bold px-2.5 ${
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
                className={`btn btn-xs sm:btn-sm join-item h-8 min-h-0 text-xs font-bold px-2.5 ${
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
                className="btn btn-xs sm:btn-sm btn-ghost h-8 min-h-0 rounded-xl text-xs font-bold px-2 text-slate-600 border border-slate-200"
                title="Toggle Amharic / English Labels"
              >
                {language === "am" ? "ፊደል (አማ)" : "English"}
              </button>
            )}

            {/* Date Range Sub-label */}
            <span className="font-extrabold text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60 text-[10px] sm:text-[11px] hidden md:inline">
              {headerSubrange}
            </span>
          </div>

          {/* Right: View Mode Switcher + Filters */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* View Switcher: Compact, Grid, List */}
            <div className="join bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex">
              <button
                type="button"
                onClick={() => setCalendarViewMode("compact")}
                className={`btn btn-xs join-item h-7 rounded-lg font-bold gap-1 flex items-center px-2.5 ${
                  calendarViewMode === "compact"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "btn-ghost text-slate-600"
                }`}
                title="Compact View (Single screen UX)"
              >
                <CalendarDays className="w-3 h-3" />
                <span>Compact</span>
              </button>

              <button
                type="button"
                onClick={() => setCalendarViewMode("grid")}
                className={`btn btn-xs join-item h-7 rounded-lg font-bold gap-1 flex items-center px-2.5 ${
                  calendarViewMode === "grid"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "btn-ghost text-slate-600"
                }`}
                title="Month Grid View (Fluid 7-day layout)"
              >
                <GridIcon className="w-3 h-3" />
                <span>Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setCalendarViewMode("list")}
                className={`btn btn-xs join-item h-7 rounded-lg font-bold gap-1 flex items-center px-2.5 ${
                  calendarViewMode === "list"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "btn-ghost text-slate-600"
                }`}
                title="Agenda List View (Vertical feed)"
              >
                <ListIcon className="w-3 h-3" />
                <span>List</span>
              </button>
            </div>

            {/* Line Filter */}
            {availableLines.length > 0 && (
              <select
                value={selectedLineFilter}
                onChange={(e) => setSelectedLineFilter(e.target.value)}
                className="select select-xs select-bordered rounded-xl text-xs font-semibold h-7 min-h-0"
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
                className="select select-xs select-bordered rounded-xl text-xs font-semibold h-7 min-h-0"
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
                className="btn btn-xs btn-ghost text-rose-600 rounded-lg text-[10px] font-bold h-7 min-h-0 px-1.5"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 4. QUICK MONTH JUMPER MODAL (RESPONSIVE BOTTOM-SHEET ON MOBILE)*/}
      {/* ============================================================= */}
      {showMonthJumper && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={calType === "ethiopian" ? "Select Ethiopian Month & Year" : "Select Gregorian Month & Year"}
            className="bg-white w-full max-h-[92dvh] sm:max-h-[85vh] sm:max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200 shadow-2xl p-4 sm:p-6 pb-safe flex flex-col overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-top-2 duration-200"
          >
            {/* Mobile Drag Handle Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                  {calType === "ethiopian"
                    ? language === "am"
                      ? "የኢትዮጵያ ወር እና ዓመት ይምረጡ"
                      : "Select Ethiopian Month & Year"
                    : "Select Gregorian Month & Year"}
                </h3>
                <span className="text-xs text-slate-500 leading-relaxed">
                  {calType === "ethiopian"
                    ? "13 Ethiopian Months (12 × 30 days + Pagume 5/6)"
                    : "12 Gregorian Months"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMonthJumper(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700"
                aria-label="Close month jumper"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {calType === "ethiopian" ? (
              <>
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
                          className={`btn btn-xs sm:btn-sm rounded-xl font-mono font-bold flex-1 min-h-[38px] touch-manipulation ${
                            isFutureYear
                              ? "opacity-30 cursor-not-allowed bg-slate-100 text-slate-400 border-none"
                              : ethYear === y
                              ? "bg-emerald-600 text-white border-none shadow-xs"
                              : "btn-outline text-slate-600 hover:bg-slate-50"
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
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 my-2">
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
                        className={`p-2 sm:p-2.5 rounded-2xl border text-center transition-all min-h-[64px] flex flex-col items-center justify-center active:scale-95 touch-manipulation ${
                          isFutureMonth
                            ? "border-slate-200 bg-slate-100/70 text-slate-400 opacity-40 cursor-not-allowed pointer-events-none"
                            : isSelected
                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-extrabold shadow-xs ring-2 ring-emerald-500/30"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                        }`}
                        title={isFutureMonth ? `${mNameEn} (Disabled - Future Month)` : mNameEn}
                      >
                        <div className="text-sm sm:text-base font-bold leading-tight">{mNameAm}</div>
                        <div className="text-[10px] sm:text-xs text-slate-400 font-mono leading-normal mt-0.5">{mNameEn}</div>
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
              </>
            ) : (
              <>
                {/* Gregorian Year Selector Strip */}
                <div className="my-3 sm:my-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 leading-relaxed">
                    Year
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {[2023, 2024, 2025, 2026, 2027].map((y) => {
                      const thisYear = new Date().getFullYear();
                      const isFutureYear = y > thisYear;
                      return (
                        <button
                          key={y}
                          type="button"
                          disabled={isFutureYear}
                          onClick={() => !isFutureYear && setGregJumperYear(y)}
                          className={`btn btn-xs sm:btn-sm rounded-xl font-mono font-bold flex-1 min-h-[38px] touch-manipulation ${
                            isFutureYear
                              ? "opacity-30 cursor-not-allowed bg-slate-100 text-slate-400 border-none"
                              : gregJumperYear === y
                              ? "bg-indigo-600 text-white border-none shadow-xs"
                              : "btn-outline text-slate-600 hover:bg-slate-50"
                          }`}
                          title={isFutureYear ? "Future Year (Disabled)" : undefined}
                        >
                          {y}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 12 Gregorian Months Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 my-2">
                  {GREG_MONTHS.map((gm) => {
                    const mStr = String(gm.num).padStart(2, "0");
                    const targetStr = `${gregJumperYear}-${mStr}`;
                    const isSelected = initialGregMonthStr === targetStr;
                    const isFutureMonth = targetStr > currentGregMonthStr;

                    return (
                      <button
                        key={gm.num}
                        type="button"
                        disabled={isFutureMonth}
                        onClick={() => !isFutureMonth && jumpToGregorianMonth(gregJumperYear, gm.num)}
                        className={`p-2 sm:p-2.5 rounded-2xl border text-center transition-all min-h-[64px] flex flex-col items-center justify-center active:scale-95 touch-manipulation ${
                          isFutureMonth
                            ? "border-slate-200 bg-slate-100/70 text-slate-400 opacity-40 cursor-not-allowed pointer-events-none"
                            : isSelected
                            ? "border-indigo-600 bg-indigo-50 text-indigo-900 font-extrabold shadow-xs ring-2 ring-indigo-500/30"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                        }`}
                        title={isFutureMonth ? `${gm.name} (Disabled - Future Month)` : gm.name}
                      >
                        <div className="text-sm sm:text-base font-bold leading-tight">{gm.name}</div>
                        <div className="text-[10px] sm:text-xs text-slate-400 font-mono leading-normal mt-0.5">{gm.short}</div>
                        {isFutureMonth && (
                          <span className="text-[8px] bg-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block leading-relaxed">
                            Future
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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
                    data-testid="compact-day-tile"
                    onClick={() => setActiveDayDateStr(item.gregorianDateStr)}
                    className={`aspect-square min-h-[44px] min-w-[44px] sm:min-h-[50px] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-1 relative transition-all text-left active:scale-95 touch-manipulation ${
                      isSelected
                        ? "bg-slate-900 text-white font-black shadow-md ring-2 ring-emerald-500"
                        : item.isCurrentToday
                        ? "border-2 border-emerald-500 bg-emerald-50/40 text-slate-900 font-black shadow-xs ring-1 ring-emerald-500/30"
                        : item.isFuture
                        ? "bg-slate-50/50 border border-slate-200/50 text-slate-300"
                        : isHoliday
                        ? "bg-amber-50/80 border border-amber-300 text-amber-950 font-bold"
                        : item.isWorkDay
                        ? "bg-white border border-slate-200/80 hover:border-emerald-300 text-slate-800"
                        : "bg-slate-100/70 border border-slate-200/50 text-slate-400"
                    }`}
                  >
                    {/* Primary Date Number */}
                    <span className="text-sm sm:text-base font-black font-mono tabular-nums leading-none">
                      {item.primaryNumber}
                    </span>

                    {/* Secondary Date Micro-Label (Clear Distinction) */}
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono leading-tight mt-0.5 block truncate max-w-full font-medium ${
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
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 ring-1 ring-white/80 inline-block" />
                      )}
                      {hasEntries && (
                        <span
                          className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ring-1 ring-white/80 ${
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

          {/* Inline Active Day Details Card (Desktop view in compact mode) */}
          {activeDayDateStr && activeDaySummary ? (
            <div className="hidden sm:block bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs space-y-4 animate-in fade-in duration-150">
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

              {/* Product Group Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <span>Production by Product ({activeDayProductGroups.length} product{activeDayProductGroups.length === 1 ? "" : "s"}, {activeDaySummary.entries.length} lines)</span>
                  </h3>
                </div>

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
                  <div className="space-y-4">
                    {activeDayProductGroups.map((group) => {
                      return (
                        <div
                          key={`compact_group_${group.productId}`}
                          className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-3.5 space-y-3"
                        >
                          {/* Product Group Header Banner */}
                          <div className="flex items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                <Boxes className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-black text-slate-900 text-sm">
                                    {group.productName}
                                  </span>
                                  {group.sku && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 text-[10px] font-mono font-bold">
                                      {group.sku}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {group.entries.length} line{group.entries.length > 1 ? "s" : ""} recorded
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-sm sm:text-base font-black font-mono text-slate-900 tabular-nums">
                                {group.totalFG.toLocaleString()} pcs
                              </span>
                              {group.hasTarget && (
                                <div className="text-xs font-bold font-mono">
                                  <span
                                    className={
                                      group.netVariance >= 0
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }
                                  >
                                    {group.netVariance >= 0 ? `+${Math.round(group.netVariance)}` : Math.round(group.netVariance)}
                                  </span>
                                  <span className="text-slate-400 font-normal ml-1">
                                    (tgt: {Math.round(group.totalTarget).toLocaleString()})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Line Entries Under This Product */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {group.entries.map((entry) => {
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
                                  className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-2 shadow-2xs"
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                        {entry.lineName}
                                      </div>
                                    </div>

                                    <div className="text-right">
                                      <span className="text-xs sm:text-sm font-black font-mono text-slate-900 tabular-nums">
                                        {entry.finishedGood.toLocaleString()} pcs
                                      </span>
                                      {variance && (
                                        <div className="text-[11px] font-bold font-mono">
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
                                  <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-slate-100 text-center text-xs">
                                    <div className="bg-slate-50 p-1 rounded-lg border border-slate-200/40">
                                      <span className="text-[8px] text-slate-400 block uppercase font-bold">Rework</span>
                                      <span className="font-mono font-bold text-slate-800 text-[11px]">{entry.rework}</span>
                                    </div>
                                    <div className="bg-slate-50 p-1 rounded-lg border border-slate-200/40">
                                      <span className="text-[8px] text-rose-800 block uppercase font-bold">Reject</span>
                                      <span className="font-mono font-bold text-rose-700 text-[11px]">{entry.reject}</span>
                                    </div>
                                    <div className="bg-slate-50 p-1 rounded-lg border border-slate-200/40">
                                      <span className="text-[8px] text-slate-400 block uppercase font-bold">WIP</span>
                                      <span className="font-mono font-bold text-slate-800 text-[11px]">{entry.wip}</span>
                                    </div>
                                    <div className="bg-slate-50 p-1 rounded-lg border border-slate-200/40">
                                      <span className="text-[8px] text-slate-400 block uppercase font-bold">Down</span>
                                      <span
                                        className={`font-mono font-bold text-[11px] ${
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center text-slate-500 shadow-2xs">
              <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Date Selected</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any date on the calendar above to inspect daily numbers and performance.
              </p>
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
                  className="min-h-[58px] sm:min-h-[74px] md:min-h-[86px] lg:min-h-[96px] rounded-xl sm:rounded-2xl bg-slate-50/40 border border-transparent"
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
                    data-testid="calendar-day-tile"
                    onClick={() => setActiveDayDateStr(item.gregorianDateStr)}
                    className={`w-full min-h-[58px] sm:min-h-[74px] md:min-h-[86px] lg:min-h-[96px] p-1 sm:p-1.5 md:p-2 rounded-xl sm:rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer group active:scale-98 touch-manipulation ${
                      isSelected
                        ? "ring-2 ring-slate-900 border-slate-900 bg-emerald-50/40 shadow-sm"
                        : item.isCurrentToday
                        ? "border-2 border-emerald-500 bg-white shadow-2xs"
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
                            className={`text-sm sm:text-base md:text-lg font-black font-mono tabular-nums inline-block leading-none ${
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
                          className={`text-[9px] sm:text-[10px] md:text-[11px] font-mono leading-tight truncate max-w-full block font-medium ${
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
                          <span className="hidden sm:inline text-[8px] sm:text-[9px] font-bold text-slate-400 bg-slate-100 px-1 py-0.5 rounded leading-none">
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
                          <div className="text-xs sm:text-sm md:text-base font-black text-slate-900 font-mono tabular-nums tracking-tight leading-tight">
                            {summary.totalFG.toLocaleString()}
                            <span className="hidden sm:inline text-[9px] font-normal text-slate-400 ml-0.5">
                              pcs
                            </span>
                          </div>

                          {/* Variance badge */}
                          {hasTarget ? (
                            <div className="mt-0.5 flex items-center">
                              <span
                                className={`text-[9px] sm:text-[10px] md:text-[11px] font-black font-mono tabular-nums px-1 sm:px-1.5 py-0.5 rounded-md ${
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

                          {/* Product breakdown micro badges */}
                          {summary.productBreakdown && summary.productBreakdown.length > 0 && (
                            <div className="hidden sm:flex flex-col gap-0.5 mt-1 pt-1 border-t border-slate-100">
                              {summary.productBreakdown.slice(0, 2).map((pb) => (
                                <div key={pb.productId} className="flex items-center justify-between text-[9px] text-slate-500 font-mono truncate">
                                  <span className="truncate max-w-[55px] font-sans font-medium text-slate-600" title={pb.productName}>{pb.productName}</span>
                                  <span className="font-bold text-slate-800 tabular-nums">{pb.fg.toLocaleString()}</span>
                                </div>
                              ))}
                              {summary.productBreakdown.length > 2 && (
                                <span className="text-[8px] text-slate-400 font-sans">+{summary.productBreakdown.length - 2} more</span>
                              )}
                            </div>
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
                data-testid="list-day-tile"
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
                    {/* Product breakdown badges */}
                    {summary?.productBreakdown && summary.productBreakdown.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {summary.productBreakdown.map((pb) => (
                          <span
                            key={pb.productId}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[10px] font-mono text-slate-700"
                          >
                            <span className="font-sans font-medium text-slate-600 truncate max-w-[120px]">{pb.productName}:</span>
                            <span className="font-bold text-slate-900">{pb.fg.toLocaleString()}</span>
                            {pb.hasTarget && (
                              <span className="text-[9px] text-slate-400 font-normal">/{Math.round(pb.target)}</span>
                            )}
                          </span>
                        ))}
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
      {/* 8. SLIDE-OVER DRAWER / BOTTOM SHEET (MOBILE BOTTOM SHEET & DESKTOP DRAWER) */}
      {/* ============================================================= */}
      {activeDayDateStr && activeDaySummary && (
        <div className={`fixed inset-0 z-50 flex justify-end ${calendarViewMode === "compact" ? "sm:hidden" : ""}`}>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveDayDateStr(null)}
          />

          {/* Drawer Container (Desktop: right slide-over, Mobile: native bottom sheet) */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Day Inspection"
            className="fixed bottom-0 left-0 right-0 max-h-[88dvh] rounded-t-3xl sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-full sm:w-[500px] sm:rounded-none bg-white shadow-2xl flex flex-col z-10 overflow-y-auto border-t sm:border-t-0 sm:border-l border-slate-200 pb-safe animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
          >
            {/* Mobile Drag Handle Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

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
                  aria-label="Close day inspection"
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

              {/* Product Group Breakdown in Drawer */}
              <div className="space-y-3">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-emerald-600" />
                  <span>Product Breakdown ({activeDayProductGroups.length} product{activeDayProductGroups.length === 1 ? "" : "s"}, {activeDaySummary.entries.length} lines)</span>
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
                  <div className="space-y-4">
                    {activeDayProductGroups.map((group) => {
                      return (
                        <div
                          key={`drawer_group_${group.productId}`}
                          className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5 space-y-3"
                        >
                          {/* Product Group Header Banner */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                                <Boxes className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {group.productName}
                                  </span>
                                  {group.sku && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px] font-mono font-bold">
                                      {group.sku}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {group.entries.length} line{group.entries.length > 1 ? "s" : ""}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-sm font-black font-mono text-slate-900 tabular-nums">
                                {group.totalFG.toLocaleString()} pcs
                              </span>
                              {group.hasTarget && (
                                <div className="text-xs font-bold font-mono">
                                  <span
                                    className={
                                      group.netVariance >= 0
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }
                                  >
                                    {group.netVariance >= 0 ? `+${Math.round(group.netVariance)}` : Math.round(group.netVariance)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Line items under this product in drawer */}
                          <div className="space-y-2.5">
                            {group.entries.map((entry) => {
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
                                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                      {entry.lineName}
                                    </div>

                                    <div className="text-right">
                                      <span className="text-xs sm:text-sm font-black font-mono text-slate-900 tabular-nums">
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
                                    <div className="text-xs text-slate-600 bg-amber-50/70 border border-amber-200 p-2 rounded-xl flex items-start gap-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                      <span>{entry.issueNote}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
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
