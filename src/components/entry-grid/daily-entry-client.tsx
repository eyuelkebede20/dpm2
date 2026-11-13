"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, subDays, parseISO, getDay } from "date-fns";
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
  Shield,
  Check,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Bell,
  Lock,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { StepperInput } from "@/components/ui/stepper-input";
import { LineTallyVisualizer } from "./line-tally-visualizer";
import { calculateDailyTarget, calculateVariance } from "@/lib/target";
import {
  saveDailyReportEntryAction,
  saveDailyReportBatchAction,
} from "@/actions/report-actions";
import {
  markDailyReportReviewedAction,
  unmarkDailyReportReviewedAction,
  reviewItemAction,
  updateDailyPlanAction,
  sendReportReminderAction,
} from "@/actions/review-actions";
import {
  ETH_MONTH_NAMES_AM,
  ETH_MONTH_NAMES_EN,
  gregorianToEth,
  ethToGregorian,
  formatEthDate,
  daysInMonthEth,
  isReportMonthPassed,
} from "@/lib/ethiopian-calendar";

export interface QAReviewInfo {
  isReviewed: boolean;
  status?: "approved" | "rejected" | "denied" | "pending";
  verdict?: string;
  inspectorId: string | null;
  inspectorName: string | null;
  checked: number;
  defects: number;
  defectRate: number;
  note: string | null;
  createdAt: string | null;
}

export interface ItemReviewInfo {
  status: "approved" | "denied";
  note?: string | null;
  reviewedAt: string;
}

export interface ReportReviewInfo {
  isReviewed: boolean;
  reviewedBy: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  note: string | null;
  itemReviews?: Record<string, ItemReviewInfo>;
}

export interface GridRowData {
  lineId: string;
  lineName: string;
  productId: string;
  productName: string;
  sku: string;
  plan: {
    id?: string;
    startDate: string;
    endDate: string;
    plannedQty: number;
    initialPlannedQty?: number;
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
  qaReview?: QAReviewInfo;
  itemReview?: ItemReviewInfo | null;
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

const ETH_PICKER_WEEKDAYS = [
  { am: "ሰኞ", en: "Mon", isWeekend: false },
  { am: "ማክ", en: "Tue", isWeekend: false },
  { am: "ረቡ", en: "Wed", isWeekend: false },
  { am: "ሐሙ", en: "Thu", isWeekend: false },
  { am: "አርብ", en: "Fri", isWeekend: false },
  { am: "ቅዳሜ", en: "Sat", isWeekend: false },
  { am: "እሁድ", en: "Sun", isWeekend: true },
];

interface DailyEntryClientProps {
  initialDate: string;
  factoryId: string;
  factoryName?: string;
  workingDays: number[];
  initialRows: GridRowData[];
  userRole: string;
  isDaySubmitted?: boolean;
  submittedAt?: string | null;
  calendarSystem?: string;
  specialDay?: SpecialDayInfo | null;
  downtimeReasons?: DowntimeReasonTemplate[];
  reportReview?: ReportReviewInfo | null;
}

export function DailyEntryClient({
  initialDate,
  factoryId,
  factoryName = "Plant",
  workingDays,
  initialRows,
  userRole,
  isDaySubmitted = false,
  submittedAt = null,
  calendarSystem,
  specialDay,
  downtimeReasons = [],
  reportReview = null,
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    | "line-asc"
    | "line-desc"
    | "product-asc"
    | "product-desc"
    | "fg-desc"
    | "fg-asc"
    | "target-desc"
    | "variance-desc"
    | "variance-asc"
  >("line-asc");
  const [groupMode, setGroupMode] = useState<"product" | "line">("product");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [daySubmitted, setDaySubmitted] = useState<boolean>(Boolean(isDaySubmitted));

  useEffect(() => {
    setDaySubmitted(Boolean(isDaySubmitted));
  }, [isDaySubmitted, selectedDate]);

  const isOM = userRole === "om";
  const canInputDailyNumbers = userRole === "fm" || userRole === "sys_admin";
  const isDayLocked = userRole === "fm" && daySubmitted;
  const isMonthPassed = useMemo(() => {
    return isReportMonthPassed(selectedDate, calendarSystem as any);
  }, [selectedDate, calendarSystem]);
  const isMonthLocked = userRole === "fm" && isMonthPassed;
  const isReadOnly = !canInputDailyNumbers || isDayLocked || isMonthLocked;
  const canEditDailyPlans = isOM || userRole === "sys_admin";
  const canReviewItems = isOM || userRole === "sys_admin";

  const [editingPlanRow, setEditingPlanRow] = useState<GridRowData | null>(null);
  const [editTargetValue, setEditTargetValue] = useState<number>(100);
  const [isSavingPlan, setIsSavingPlan] = useState<boolean>(false);
  const [isReviewingItemKey, setIsReviewingItemKey] = useState<string | null>(null);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  const [currentReview, setCurrentReview] = useState<ReportReviewInfo | null>(
    reportReview || null
  );
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    setCurrentReview(reportReview || null);
  }, [reportReview]);

  const handleSendFMReminder = async () => {
    if (!canReviewItems) return;
    setIsSendingReminder(true);
    try {
      const res = await sendReportReminderAction({
        factoryId,
        date: selectedDate,
      });
      if (res.success) {
        setToast({
          type: "success",
          message: `Notification reminder sent to Factory Managers (${res.recipients?.join(", ")}).`,
        });
      } else {
        setToast({
          type: "error",
          message: res.error || "Failed to notify Factory Managers.",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Failed to send reminder notification.",
      });
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!isOM && userRole !== "sys_admin") return;
    setIsReviewing(true);
    try {
      const res = await markDailyReportReviewedAction({
        factoryId,
        date: selectedDate,
      });
      if (res.success && res.review) {
        setCurrentReview({
          isReviewed: true,
          reviewedBy: res.review.reviewedBy,
          reviewerName: res.review.reviewerName || "Operation Manager",
          reviewedAt: res.review.reviewedAt,
          note: res.review.note,
        });
        setToast({
          type: "success",
          message: "Daily report marked as reviewed by Operation Manager.",
        });
        router.refresh();
      } else {
        setToast({
          type: "error",
          message: res.error || "Failed to mark report as reviewed",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "An error occurred",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleUnmarkReviewed = async () => {
    if (!isOM && userRole !== "sys_admin") return;
    setIsReviewing(true);
    try {
      const res = await unmarkDailyReportReviewedAction({
        factoryId,
        date: selectedDate,
      });
      if (res.success) {
        setCurrentReview({
          isReviewed: false,
          reviewedBy: null,
          reviewerName: null,
          reviewedAt: null,
          note: null,
        });
        setToast({
          type: "success",
          message: "Report review revoked. Status set to pending review.",
        });
        router.refresh();
      } else {
        setToast({
          type: "error",
          message: res.error || "Failed to revoke review",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "An error occurred",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleOpenEditPlan = (row: GridRowData) => {
    setEditingPlanRow(row);
    setEditTargetValue(row.plan?.dailyTarget || 100);
  };

  const handleSaveDailyPlan = async () => {
    if (!editingPlanRow) return;
    setIsSavingPlan(true);
    try {
      const res = await updateDailyPlanAction({
        factoryId,
        lineId: editingPlanRow.lineId,
        productId: editingPlanRow.productId,
        date: selectedDate,
        planId: editingPlanRow.plan?.id,
        newDailyTarget: editTargetValue,
      });

      if (res.success && res.plan) {
        setRows((prev) =>
          prev.map((r) =>
            r.lineId === editingPlanRow.lineId && r.productId === editingPlanRow.productId
              ? {
                  ...r,
                  plan: {
                    ...r.plan,
                    id: res.plan.id,
                    startDate: res.plan.startDate,
                    endDate: res.plan.endDate,
                    initialPlannedQty: res.plan.initialPlannedQty,
                    plannedQty: res.plan.plannedQty,
                    weeklyPlanned: res.plan.plannedQty,
                    dailyTarget: res.plan.dailyTarget,
                  },
                }
              : r
          )
        );
        setToast({
          type: "success",
          message: "Daily plan target updated successfully and reflected on annual plan.",
        });
        setEditingPlanRow(null);
        router.refresh();
      } else {
        setToast({
          type: "error",
          message: res.error || "Failed to update daily plan",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Failed to update daily plan",
      });
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleReviewItem = async (row: GridRowData, status: "approved" | "denied") => {
    const itemKey = `${row.lineId}_${row.productId}`;
    setIsReviewingItemKey(itemKey);
    try {
      const res = await reviewItemAction({
        factoryId,
        date: selectedDate,
        lineId: row.lineId,
        productId: row.productId,
        status,
      });

      if (res.success && res.itemReview) {
        setRows((prev) =>
          prev.map((r) =>
            r.lineId === row.lineId && r.productId === row.productId
              ? { ...r, itemReview: res.itemReview }
              : r
          )
        );
        setToast({
          type: "success",
          message: `Item marked as ${status === "approved" ? "Approved" : "Denied"} by Operation Manager.`,
        });
        router.refresh();
      } else {
        setToast({
          type: "error",
          message: res.error || "Failed to review item",
        });
      }
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Failed to review item",
      });
    } finally {
      setIsReviewingItemKey(null);
    }
  };

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

  const handlePrevPickerMonth = () => {
    if (pickerMonth === 1) {
      setPickerYear((y) => y - 1);
      setPickerMonth(13);
    } else {
      setPickerMonth((m) => m - 1);
    }
  };

  const handleNextPickerMonth = () => {
    if (pickerMonth === 13) {
      setPickerYear((y) => y + 1);
      setPickerMonth(1);
    } else {
      setPickerMonth((m) => m + 1);
    }
  };

  const pickerDaysCount = useMemo(() => {
    try {
      return daysInMonthEth(pickerYear, pickerMonth);
    } catch {
      return 30;
    }
  }, [pickerYear, pickerMonth]);

  const pickerLeadingBlanks = useMemo(() => {
    try {
      const firstIso = ethToGregorian(pickerYear, pickerMonth, 1);
      const dow = getDay(parseISO(firstIso)); // 0 = Sun, 1 = Mon ...
      return (dow + 6) % 7; // Monday-first
    } catch {
      return 0;
    }
  }, [pickerYear, pickerMonth]);

  const selectedIsoPreview = useMemo(() => {
    try {
      const maxDays = daysInMonthEth(pickerYear, pickerMonth);
      const safeDay = Math.min(Math.max(1, pickerDay), maxDays);
      const iso = ethToGregorian(pickerYear, pickerMonth, safeDay);
      return format(parseISO(iso), "EEEE, MMMM d, yyyy");
    } catch {
      return "";
    }
  }, [pickerYear, pickerMonth, pickerDay]);

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
        if (isReadOnly) return;
        if (isDirty && !isPending) {
          handleSaveAllRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isPending, isReadOnly]);

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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    if (selectedDate > todayStr) {
      setToast({
        type: "error",
        message: "Cannot record production entries for future dates.",
      });
      return;
    }
    startTransition(async () => {
      const res = await saveDailyReportBatchAction({
        date: selectedDate,
        entries: rows.map((row) => ({
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
        })),
      });

      if (res.success) {
        setDaySubmitted(true);
        setToast({
          type: "success",
          message: `Saved daily production numbers successfully! 1 data entry per day recorded. The day is now locked.`,
        });
        setInitialSnapshot(JSON.stringify(rows));
        router.refresh();
      } else {
        setToast({
          type: "error",
          message: res.error || "Failed to save daily production entries",
        });
      }

      setTimeout(() => setToast(null), 5000);
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

  // Filtered rows based on selected product (used for summary KPI metrics)
  const productFilteredRows = useMemo(() => {
    if (selectedProductFilter === "all") return rows;
    return rows.filter((r) => r.productId === selectedProductFilter);
  }, [rows, selectedProductFilter]);

  // Filtered and sorted rows based on product filter, text search query, and sort mode
  const displayedRows = useMemo(() => {
    let result = productFilteredRows;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.lineName.toLowerCase().includes(q) ||
          r.productName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === "line-asc") {
        return a.lineName.localeCompare(b.lineName, undefined, { numeric: true });
      }
      if (sortBy === "line-desc") {
        return b.lineName.localeCompare(a.lineName, undefined, { numeric: true });
      }
      if (sortBy === "product-asc") {
        return a.productName.localeCompare(b.productName);
      }
      if (sortBy === "product-desc") {
        return b.productName.localeCompare(a.productName);
      }
      if (sortBy === "fg-desc") {
        return (b.entry.finishedGood || 0) - (a.entry.finishedGood || 0);
      }
      if (sortBy === "fg-asc") {
        return (a.entry.finishedGood || 0) - (b.entry.finishedGood || 0);
      }
      if (sortBy === "target-desc") {
        const targetA =
          calculateDailyTarget(a.plan, selectedDate, workingDays, specialDaysList)
            .dailyTarget || 0;
        const targetB =
          calculateDailyTarget(b.plan, selectedDate, workingDays, specialDaysList)
            .dailyTarget || 0;
        return targetB - targetA;
      }
      if (sortBy === "variance-desc") {
        const targetA = calculateDailyTarget(a.plan, selectedDate, workingDays, specialDaysList).dailyTarget;
        const targetB = calculateDailyTarget(b.plan, selectedDate, workingDays, specialDaysList).dailyTarget;
        const vA = calculateVariance(a.entry.finishedGood || 0, targetA);
        const vB = calculateVariance(b.entry.finishedGood || 0, targetB);
        return (vB.variance ?? -999999) - (vA.variance ?? -999999);
      }
      if (sortBy === "variance-asc") {
        const targetA = calculateDailyTarget(a.plan, selectedDate, workingDays, specialDaysList).dailyTarget;
        const targetB = calculateDailyTarget(b.plan, selectedDate, workingDays, specialDaysList).dailyTarget;
        const vA = calculateVariance(a.entry.finishedGood || 0, targetA);
        const vB = calculateVariance(b.entry.finishedGood || 0, targetB);
        return (vA.variance ?? 999999) - (vB.variance ?? 999999);
      }
      return 0;
    });
  }, [
    productFilteredRows,
    searchQuery,
    sortBy,
    selectedDate,
    workingDays,
    specialDaysList,
  ]);

  // Rows grouped by product for "By Product" display mode (filtered and sorted)
  const productGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        product: { id: string; name: string; sku: string };
        summary: (typeof productSummaries)[0];
        items: { row: GridRowData; globalIndex: number }[];
      }
    >();

    const q = searchQuery.trim().toLowerCase();

    rows.forEach((row, globalIndex) => {
      if (selectedProductFilter !== "all" && row.productId !== selectedProductFilter) {
        return;
      }
      if (q) {
        const matches =
          row.lineName.toLowerCase().includes(q) ||
          row.productName.toLowerCase().includes(q) ||
          row.sku.toLowerCase().includes(q);
        if (!matches) return;
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

    const groupList = Array.from(groups.values());

    // Sort items within each product group according to sortBy
    groupList.forEach((group) => {
      group.items.sort((aItem, bItem) => {
        const a = aItem.row;
        const b = bItem.row;
        if (sortBy === "line-asc") {
          return a.lineName.localeCompare(b.lineName, undefined, { numeric: true });
        }
        if (sortBy === "line-desc") {
          return b.lineName.localeCompare(a.lineName, undefined, { numeric: true });
        }
        if (sortBy === "fg-desc") {
          return (b.entry.finishedGood || 0) - (a.entry.finishedGood || 0);
        }
        if (sortBy === "fg-asc") {
          return (a.entry.finishedGood || 0) - (b.entry.finishedGood || 0);
        }
        if (sortBy === "target-desc") {
          const targetA = calculateDailyTarget(a.plan, selectedDate, workingDays, specialDaysList).dailyTarget || 0;
          const targetB = calculateDailyTarget(b.plan, selectedDate, workingDays, specialDaysList).dailyTarget || 0;
          return targetB - targetA;
        }
        if (sortBy === "variance-desc") {
          const targetA = calculateDailyTarget(a.plan, selectedDate, workingDays, specialDaysList).dailyTarget;
          const targetB = calculateDailyTarget(b.plan, selectedDate, workingDays, specialDaysList).dailyTarget;
          const vA = calculateVariance(a.entry.finishedGood || 0, targetA);
          const vB = calculateVariance(b.entry.finishedGood || 0, targetB);
          return (vB.variance ?? -999999) - (vA.variance ?? -999999);
        }
        if (sortBy === "variance-asc") {
          const targetA = calculateDailyTarget(a.plan, selectedDate, workingDays, specialDaysList).dailyTarget;
          const targetB = calculateDailyTarget(b.plan, selectedDate, workingDays, specialDaysList).dailyTarget;
          const vA = calculateVariance(a.entry.finishedGood || 0, targetA);
          const vB = calculateVariance(b.entry.finishedGood || 0, targetB);
          return (vA.variance ?? 999999) - (vB.variance ?? 999999);
        }
        return 0;
      });
    });

    // Also sort the groups themselves if sorting by product name
    if (sortBy === "product-asc") {
      groupList.sort((a, b) => a.product.name.localeCompare(b.product.name));
    } else if (sortBy === "product-desc") {
      groupList.sort((a, b) => b.product.name.localeCompare(a.product.name));
    }

    return groupList;
  }, [
    rows,
    selectedProductFilter,
    searchQuery,
    sortBy,
    productSummaries,
    selectedDate,
    workingDays,
    specialDaysList,
  ]);

  // Aggregated totals (reflects filtered rows when a product is selected)
  let totalFG = 0;
  let totalTarget = 0;
  let hasAnyTarget = false;
  let totalRework = 0;
  let totalReject = 0;
  let totalScrap = 0;
  let totalWIP = 0;
  let totalDowntime = 0;

  productFilteredRows.forEach((r) => {
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
            {(!row.itemReview?.status || (row.itemReview.status as string) === "pending") &&
              (!row.qaReview?.isReviewed || (row.qaReview.status as string) === "pending") && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                  title="Warning: Product daily report has not been reviewed"
                >
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                  <span>Unreviewed</span>
                </span>
              )}
            {(!row.entry || (row.entry.finishedGood === 0 && !daySubmitted)) && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs"
                title="Warning: Daily production report not uploaded"
              >
                <AlertCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                <span>Not Uploaded</span>
              </span>
            )}
          </div>
        </td>

        {/* Initial Set Plan */}
        <td className="py-3 px-3">
          {row.plan?.plannedQty !== undefined ? (
            <div className="flex flex-col items-start gap-0.5 font-mono">
              <span className="font-bold tabular-nums text-slate-700 text-xs">
                {(row.plan.initialPlannedQty ?? row.plan.plannedQty).toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-400 font-sans uppercase">Initial Set</span>
            </div>
          ) : (
            <span className="text-slate-300 font-mono text-xs">—</span>
          )}
        </td>

        {/* Edited Plan */}
        <td className="py-3 px-3">
          {row.plan?.plannedQty !== undefined ? (
            <div className="flex flex-col items-start gap-0.5 font-mono">
              <span className="font-black tabular-nums text-indigo-700 text-xs">
                {row.plan.plannedQty.toLocaleString()}
              </span>
              <span className="text-[9px] text-indigo-400 font-sans uppercase">Edited Plan</span>
            </div>
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
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black tabular-nums text-slate-900">
                  {targetRes.displayTarget.toLocaleString()}
                </span>
                {canEditDailyPlans && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditPlan(row)}
                    className="btn btn-ghost btn-xs p-1 h-6 min-h-0 text-indigo-600 hover:bg-indigo-50 rounded"
                    title="Edit Daily Plan Target"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block font-mono tabular-nums">
                Target: {targetRes.dailyTarget.toLocaleString()}/day
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400 italic">
                {targetRes.reason === "non_working_day"
                  ? "Day Off"
                  : "No plan"}
              </span>
              {canEditDailyPlans && (
                <button
                  type="button"
                  onClick={() => handleOpenEditPlan(row)}
                  className="btn btn-ghost btn-xs p-1 h-6 min-h-0 text-indigo-600 hover:bg-indigo-50 rounded"
                  title="Set Daily Plan"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
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
            disabled={isReadOnly}
          />
        </td>

        {/* QA Review */}
        <td className="py-3 px-3 min-w-[170px]">
          {row.qaReview?.isReviewed ? (
            <div className="space-y-0.5">
              {row.qaReview.status === "approved" ||
              (!row.qaReview.status && row.qaReview.defects === 0) ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  QA Approved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  QA Denied
                </span>
              )}
              <div className="text-xs font-semibold text-slate-800 truncate max-w-[150px]">
                by {row.qaReview.inspectorName || "QA Team"}
              </div>
              <div
                className={`text-[10px] font-mono font-bold ${
                  row.qaReview.defects > 0 ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {row.qaReview.defects} defects ({row.qaReview.defectRate}%)
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80">
              <AlertCircle className="w-3 h-3 text-amber-500" />
              Pending QA
            </span>
          )}
        </td>

        {/* OM Review */}
        <td className="py-3 px-3 min-w-[180px]">
          <div className="space-y-1.5">
            {row.itemReview?.status === "approved" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Check className="w-3 h-3 text-emerald-600" />
                OM Approved
              </span>
            ) : row.itemReview?.status === "denied" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                <X className="w-3 h-3 text-rose-600" />
                OM Denied
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                Pending OM
              </span>
            )}

            {canReviewItems && (
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleReviewItem(row, "approved")}
                  disabled={isReviewingItemKey === `${row.lineId}_${row.productId}`}
                  className={`btn btn-xs rounded-lg px-2 font-bold gap-1 min-h-[26px] ${
                    row.itemReview?.status === "approved"
                      ? "bg-emerald-700 text-white border-emerald-800"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200"
                  }`}
                  title="Approve Daily Numbers"
                >
                  <Check className="w-3 h-3" />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewItem(row, "denied")}
                  disabled={isReviewingItemKey === `${row.lineId}_${row.productId}`}
                  className={`btn btn-xs rounded-lg px-2 font-bold gap-1 min-h-[26px] ${
                    row.itemReview?.status === "denied"
                      ? "bg-rose-700 text-white border-rose-800"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border-rose-200"
                  }`}
                  title="Deny Daily Numbers"
                >
                  <X className="w-3 h-3" />
                  <span>Deny</span>
                </button>
              </div>
            )}
          </div>
        </td>

        {/* Issue Notes */}
        <td className="py-3 px-4 min-w-[280px]">
          <div className="space-y-1.5">
            <input
              type="text"
              placeholder={isReadOnly ? "No issue notes" : "Note stoppage or quality issue..."}
              value={row.entry.issueNote || ""}
              onChange={(e) =>
                updateRowField(globalIndex, "issueNote", e.target.value)
              }
              disabled={isReadOnly}
              className="input input-bordered min-h-[38px] h-9.5 sm:min-h-[42px] sm:h-10 w-full text-xs sm:text-sm placeholder:text-slate-400 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 leading-relaxed disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
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
                  disabled={isReadOnly}
                  className="select select-xs select-bordered w-full text-[11px] font-medium text-slate-700 rounded-lg bg-slate-50 focus:bg-white leading-relaxed disabled:bg-slate-100 disabled:text-slate-500"
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
              {(!row.itemReview?.status || (row.itemReview.status as string) === "pending") &&
                (!row.qaReview?.isReviewed || (row.qaReview.status as string) === "pending") && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                    title="Warning: Product daily report has not been reviewed"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>Unreviewed (ያልተገመገመ)</span>
                  </span>
                )}
              {(!row.entry || (row.entry.finishedGood === 0 && !daySubmitted)) && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs"
                  title="Warning: Daily production numbers not uploaded yet"
                >
                  <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                  <span>Not Uploaded (ያልተመዘገበ)</span>
                </span>
              )}
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

        {/* Annual Plans (Initial Set vs Edited) & Daily Target Strip */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Initial Set Plan</span>
            <span className="font-mono font-bold text-slate-700 text-xs block mt-0.5">
              {(row.plan?.initialPlannedQty ?? row.plan?.plannedQty ?? 0).toLocaleString()} pcs
            </span>
            <span className="text-[9px] text-slate-400 font-sans">Baseline</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-600 block">Edited Plan</span>
            <span className="font-mono font-black text-indigo-700 text-xs block mt-0.5">
              {(row.plan?.plannedQty ?? 0).toLocaleString()} pcs
            </span>
            <span className="text-[9px] text-indigo-400 font-sans">Active Target</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Left from Plan</span>
            <span className="font-mono font-bold text-slate-800 text-xs block mt-0.5">
              {(() => {
                const total = (row.plan?.priorFinishedGood || 0) + row.entry.finishedGood;
                const left = Math.max(0, (row.plan?.plannedQty || 0) - total);
                return `${left.toLocaleString()} pcs`;
              })()}
            </span>
            <span className="text-[9px] text-slate-400 font-sans">Remaining</span>
          </div>
          <div className="flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Daily Target</span>
              <span className="font-mono font-black text-slate-900 text-xs block mt-0.5">
                {targetRes.hasTarget ? `${targetRes.displayTarget.toLocaleString()} pcs` : "None"}
              </span>
            </div>
            {canEditDailyPlans && (
              <button
                type="button"
                onClick={() => handleOpenEditPlan(row)}
                className="btn btn-xs btn-outline border-indigo-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700 rounded-lg gap-1 font-bold mt-1 self-start"
              >
                <Pencil className="w-3 h-3 text-indigo-600" />
                <span>Edit Daily Plan</span>
              </button>
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
              disabled={isReadOnly}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
            placeholder={isReadOnly ? "No issue notes" : "Note stoppage or quality issue..."}
            value={row.entry.issueNote || ""}
            onChange={(e) =>
              updateRowField(globalIndex, "issueNote", e.target.value)
            }
            disabled={isReadOnly}
            className="input input-bordered min-h-[44px] h-11 w-full text-base sm:text-sm rounded-xl focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 leading-relaxed disabled:bg-slate-100 disabled:text-slate-600 disabled:border-slate-200"
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
                disabled={isReadOnly}
                className="select select-sm select-bordered w-full text-xs font-medium text-slate-700 rounded-xl bg-slate-50 focus:bg-white leading-relaxed touch-target disabled:bg-slate-100 disabled:text-slate-500"
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

        {/* QA Section Review Status on Report Card */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>QA Section Review (የጥራት ቁጥጥር ክለሳ)</span>
            {row.qaReview?.createdAt && (
              <span className="text-[10px] text-slate-400 font-mono normal-case">
                {format(parseISO(row.qaReview.createdAt), "MMM d, yyyy HH:mm")}
              </span>
            )}
          </div>

          {row.qaReview?.isReviewed ? (
            <div
              className={`rounded-2xl p-3 space-y-2.5 border ${
                row.qaReview.status === "approved" || row.qaReview.defects === 0
                  ? "bg-emerald-50/70 border-emerald-200/90"
                  : "bg-rose-50/70 border-rose-200/90"
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {row.qaReview.status === "approved" ||
                  (!row.qaReview.status && row.qaReview.defects === 0) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      QA Approved (ፅድቅ / Spec OK)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      QA Denied (ውድቅ / Defects Found)
                    </span>
                  )}
                  <span className="text-xs text-slate-700 font-medium">
                    Reviewed by:{" "}
                    <b className="text-slate-900 font-bold">
                      {row.qaReview.inspectorName || "QA Inspector"}
                    </b>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white/90 p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Inspected Units</span>
                  <span className="font-mono font-bold text-slate-900">
                    {row.qaReview.checked.toLocaleString()} pcs
                  </span>
                </div>
                <div className="bg-white/90 p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Defects</span>
                  <span
                    className={`font-mono font-bold ${
                      row.qaReview.defects > 0 ? "text-rose-600" : "text-emerald-700"
                    }`}
                  >
                    {row.qaReview.defects.toLocaleString()} ({row.qaReview.defectRate}%)
                  </span>
                </div>
                <div className="bg-white/90 p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">QA Notes</span>
                  <span
                    className="text-slate-700 font-medium truncate block"
                    title={row.qaReview.note || "No QA note recorded"}
                  >
                    {row.qaReview.note || "—"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Pending QA Inspection
                </span>
                <span className="text-xs text-slate-500">
                  Pending inspection by QA section for this product line.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* OM Item Review Section on Report Card */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Operation Manager Review (የስራ አስኪያጅ ክለሳ)</span>
            {row.itemReview?.reviewedAt && (
              <span className="text-[10px] text-slate-400 font-mono normal-case">
                {format(parseISO(row.itemReview.reviewedAt), "MMM d, HH:mm")}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3">
            <div className="flex items-center gap-2">
              {row.itemReview?.status === "approved" ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  OM Approved (በስራ አስኪያጅ የጸደቀ)
                </span>
              ) : row.itemReview?.status === "denied" ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                  <X className="w-3.5 h-3.5 text-rose-600" />
                  OM Denied (በስራ አስኪያጅ ውድቅ የተደረገ)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Pending OM Review
                </span>
              )}
            </div>

            {canReviewItems && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleReviewItem(row, "approved")}
                  disabled={isReviewingItemKey === `${row.lineId}_${row.productId}`}
                  className={`btn btn-xs rounded-xl px-3 font-bold gap-1 min-h-[32px] ${
                    row.itemReview?.status === "approved"
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-300"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Item</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewItem(row, "denied")}
                  disabled={isReviewingItemKey === `${row.lineId}_${row.productId}`}
                  className={`btn btn-xs rounded-xl px-3 font-bold gap-1 min-h-[32px] ${
                    row.itemReview?.status === "denied"
                      ? "bg-rose-600 text-white border-rose-700"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border-rose-300"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Deny Item</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderControlsToolbar = () => (
    <div className="p-2.5 sm:p-3 bg-slate-50/95 border-b border-slate-200 space-y-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        {/* Search Input & Sort Selector */}
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search line name, product, or SKU..."
              aria-label="Search lines or products"
              className="w-full pl-9 pr-8 py-1.5 bg-white hover:bg-slate-50 focus:bg-white text-xs sm:text-sm font-medium text-slate-900 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="select select-xs border-none bg-transparent font-bold text-slate-800 focus:outline-hidden text-xs pr-6 cursor-pointer"
              aria-label="Sort production entries"
            >
              <option value="line-asc">Line Name (A–Z)</option>
              <option value="line-desc">Line Name (Z–A)</option>
              <option value="product-asc">Product Name (A–Z)</option>
              <option value="product-desc">Product Name (Z–A)</option>
              <option value="fg-desc">Finished Good (High to Low)</option>
              <option value="fg-asc">Finished Good (Low to High)</option>
              <option value="target-desc">Daily Target (High to Low)</option>
              <option value="variance-desc">Variance (Ahead first)</option>
              <option value="variance-asc">Variance (Behind first)</option>
            </select>
          </div>
        </div>

        {/* Product Filter & Group Toggle & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {availableProducts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
              <Boxes className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="select select-xs border-none bg-transparent font-bold text-slate-800 focus:outline-hidden text-xs pr-6 cursor-pointer"
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
          <div className="join bg-white p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setGroupMode("product")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 min-h-[30px] px-2.5 touch-manipulation ${
                groupMode === "product"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
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
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 min-h-[30px] px-2.5 touch-manipulation ${
                groupMode === "line"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Flat Line View"
            >
              <span>By Line</span>
            </button>
          </div>

          {/* View Mode Switcher (Table View vs Cards View) */}
          <div className="join bg-white p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 min-h-[30px] px-2.5 touch-manipulation ${
                viewMode === "table"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Table View"
              aria-label="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`btn btn-xs join-item rounded-lg font-bold gap-1 min-h-[30px] px-2.5 touch-manipulation ${
                viewMode === "cards"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "btn-ghost text-slate-500"
              }`}
              title="Card View (Mobile Optimized)"
              aria-label="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-bar: Group Info, Active Filter Info & Modified Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">
            {groupMode === "product"
              ? `Grouped By Product (${productGroups.length} ${productGroups.length === 1 ? "group" : "groups"})`
              : `Active Production Lines (${displayedRows.length})`}
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            • Frozen line column • Tab/Enter jumps field • Ctrl+S to save
          </span>
          {(searchQuery.trim() !== "" || selectedProductFilter !== "all") && (
            <span className="text-slate-500 font-medium">
              (Showing <b className="text-slate-900 font-mono">{displayedRows.length}</b> of {rows.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(searchQuery.trim() !== "" || selectedProductFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedProductFilter("all");
              }}
              className="btn btn-xs btn-ghost text-indigo-600 hover:text-indigo-800 font-bold gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}

          {isDirty && (
            <span className="badge badge-warning text-xs font-bold gap-1 shadow-2xs">
              ● {modifiedRowCount} {modifiedRowCount === 1 ? "line" : "lines"} modified
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl 2xl:max-w-8xl mx-auto px-3 sm:px-6 md:px-8 py-3.5 pb-32">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-200 mb-2.5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <span>{factoryName}</span>
            <span>•</span>
            <span className="text-indigo-600 font-extrabold">
              Fast Production Grid
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Production Entry & Tracking
          </h1>
          {isEth && ethDate ? (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="badge badge-neutral text-xs font-bold px-2.5 py-0.5 rounded-lg leading-relaxed font-sans">
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

        {/* Date Selector Bar */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          {isEth && ethDate && (
            <button
              type="button"
              onClick={() => setShowEthPicker(true)}
              className="btn btn-xs sm:btn-sm min-h-[30px] bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold gap-1 px-2.5 mr-0.5 leading-relaxed touch-manipulation"
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
            className="btn btn-sm btn-ghost min-h-[30px] min-w-[30px] px-2 text-slate-600 hover:text-slate-900 touch-manipulation"
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            className={`flex items-center gap-1.5 px-2 ${
              isEth ? "cursor-pointer hover:bg-slate-50 rounded-lg py-0.5 transition-colors" : ""
            }`}
            onClick={() => isEth && setShowEthPicker(true)}
            title={isEth ? "ቀን ምረጥ / Select Ethiopian Date" : undefined}
          >
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
            className={`btn btn-sm btn-ghost min-h-[30px] min-w-[30px] px-2 touch-manipulation ${
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
            className="btn btn-xs btn-ghost text-slate-600 rounded-lg text-[11px] font-bold min-h-[30px] px-2 touch-manipulation"
          >
            Yest
          </button>

          <button
            type="button"
            onClick={() => handleDateChange(format(new Date(), "yyyy-MM-dd"))}
            className="btn btn-xs btn-outline btn-neutral rounded-lg text-[11px] font-bold min-h-[30px] px-2 touch-manipulation"
          >
            Today
          </button>
        </div>
      </div>

      {/* Notifications & Warning Alerts Strip at the Top */}
      <div className="space-y-2 mb-2.5">
        {/* Special Off-Day Holiday Banner */}
        {specialDay && !specialDay.isWorkingDay && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-2xl flex items-center justify-between text-xs sm:text-sm shadow-xs">
            <div className="flex items-center gap-2 font-semibold flex-wrap">
              <span className="text-base">🎉</span>
              <span className="leading-relaxed">
                Special Off-Day: {specialDay.nameEn} {specialDay.nameAm ? `(${specialDay.nameAm})` : ""}
              </span>
              <span className="badge badge-xs sm:badge-sm badge-outline border-emerald-500 text-emerald-700 uppercase font-mono">
                {specialDay.type}
              </span>
            </div>
            <span className="text-xs bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full font-mono font-bold shrink-0">
              Daily Target: 0
            </span>
          </div>
        )}

        {/* Unreviewed Daily Report Warning Banner */}
        {!currentReview?.isReviewed && (
          <div className="p-2.5 sm:p-3 rounded-2xl border bg-amber-500/10 border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                  <span>Unreviewed Daily Report (ክለሳ ያልተደረገለት ዕለታዊ ሪፖርት)</span>
                  <span className="badge badge-warning badge-xs sm:badge-sm font-bold">Review Pending</span>
                </div>
                <p className="text-[11px] text-amber-800/90 mt-0.5 leading-tight">
                  This factory report has not received Operation Manager review and sign-off. Daily figures require OM verification.
                </p>
              </div>
            </div>
            {canReviewItems && (
              <button
                type="button"
                onClick={handleSendFMReminder}
                disabled={isSendingReminder}
                className="btn btn-xs sm:btn-sm rounded-xl font-bold gap-1 bg-amber-600 hover:bg-amber-700 text-white border-none shadow-xs shrink-0 self-start sm:self-auto touch-manipulation min-h-[30px]"
              >
                {isSendingReminder ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    <span>Notifying...</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5 text-white" />
                    <span>Notify Factory Managers (አስታውስ)</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* FM Month-Passed Lockout Banner */}
        {isMonthLocked && (
          <div className="p-2.5 sm:p-3 rounded-2xl border bg-amber-500/15 border-amber-400 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-200/70 border border-amber-400 flex items-center justify-center shrink-0 text-amber-900">
                <Lock className="w-4 h-4 text-amber-900" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                  <span>Reporting Period Closed (የወሩ ሪፖርት ጊዜ አልፏል)</span>
                  <span className="badge badge-warning badge-xs sm:badge-sm font-bold">Month Passed • Locked</span>
                </div>
                <p className="text-[11px] text-amber-900/90 mt-0.5 leading-tight">
                  Factory Managers can only alter reports of the active month. This past month has closed and is locked against modifications.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl font-bold text-xs shrink-0 self-start sm:self-auto">
              <Lock className="w-3.5 h-3.5 text-amber-800" />
              <span>Read-Only Period</span>
            </div>
          </div>
        )}

        {/* Operation Manager Review Mode Banner */}
        {isOM && (
          <div className="p-2.5 sm:p-3 rounded-2xl border bg-amber-50/90 border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-800">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                  <span>Operation Manager Review Mode</span>
                  <span className="badge badge-warning badge-xs sm:badge-sm font-bold">Read-Only</span>
                </div>
                <p className="text-[11px] text-amber-800/90 mt-0.5 leading-tight">
                  You have read-only audit access for factory daily numbers. Steppers and inputs cannot be modified. Review QA inspection status and line metrics below, then mark this report as reviewed.
                </p>
              </div>
            </div>
            {currentReview?.isReviewed ? (
              <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl font-bold text-xs shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reviewed by {currentReview.reviewerName || "OM"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl font-bold text-xs shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>Pending Your Review</span>
              </div>
            )}
          </div>
        )}

        {/* FM 1 Data Entry Per Day Completed Banner */}
        {!isOM && userRole === "fm" && daySubmitted && (
          <div className="p-2.5 sm:p-3 rounded-2xl border bg-emerald-50/90 border-emerald-200 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                  <span>Daily Data Entry Completed (የዕለቱ መረጃ ተመዝግቧል)</span>
                  <span className="badge badge-success badge-xs sm:badge-sm font-bold text-white">1 Entry Per Day Locked</span>
                </div>
                <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-tight">
                  Only one data entry is permitted per day. Today&apos;s daily numbers have been recorded and submitted. All fields are locked for factory modifications and pending Operation Manager review.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl font-bold text-xs shrink-0 self-start sm:self-auto">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Entry Recorded & Locked</span>
            </div>
          </div>
        )}

        {/* Sys Admin Override Banner */}
        {!isOM && userRole === "sys_admin" && daySubmitted && (
          <div className="p-2.5 sm:p-3 rounded-2xl border bg-indigo-50/90 border-indigo-200 text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center shrink-0 text-indigo-800">
                <Shield className="w-4 h-4 text-indigo-700" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                  <span>Admin Override Mode</span>
                  <span className="badge badge-info badge-xs sm:badge-sm font-bold text-white">Sys Admin Access</span>
                </div>
                <p className="text-[11px] text-indigo-800/90 mt-0.5 leading-tight">
                  Daily numbers have been submitted. As System Administrator, you retain emergency administrative override to correct values if needed.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Cards at the Top */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mb-2.5">
        <div className="card bg-white border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 rounded-2xl">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            Total Finished Good
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums">
              {totalFG.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
            Net Good: <b className="font-mono text-slate-700 tabular-nums">{netGoodOutput}</b> ({yieldPct}%)
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 rounded-2xl">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            Target & Variance
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tabular-nums">
              {hasAnyTarget
                ? Math.round(totalTarget).toLocaleString()
                : "No Target"}
            </span>
            {hasAnyTarget && (
              <span
                className={`text-[10px] font-black font-mono tabular-nums px-1.5 py-0.2 rounded-full flex items-center gap-0.5 ${
                  netVariance >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {netVariance >= 0 ? (
                  <TrendingUp className="w-2.5 h-2.5" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5" />
                )}
                {netVarianceFormatted}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {hasAnyTarget
              ? `${Math.round((totalFG / (totalTarget || 1)) * 100)}% of daily target`
              : "No active plans today"}
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 rounded-2xl">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            Quality Fallout
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5 text-slate-700 flex-wrap">
            <span className="text-xs font-semibold">
              Rew: <b className="font-mono text-slate-900 tabular-nums">{totalRework}</b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold">
              Rej: <b className="font-mono text-rose-600 tabular-nums">{totalReject}</b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold">
              Scrap: <b className="font-mono text-amber-600 tabular-nums">{totalScrap}</b>
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Total non-conforming: <b className="font-mono tabular-nums">{totalRework + totalFallout}</b>
          </div>
        </div>

        <div className="card bg-white border border-slate-200/90 shadow-2xs p-2.5 sm:p-3 rounded-2xl">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            WIP & Downtime
          </span>
          <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-700">
              WIP: <b className="font-mono text-slate-900 tabular-nums">{totalWIP}</b>
            </span>
            <span className="text-xs font-semibold text-slate-700">
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
          <div className="text-[10px] text-slate-400 mt-0.5">
            {totalDowntime > 0
              ? `${(totalDowntime / 60).toFixed(1)} hrs lost`
              : "Zero line stoppages"}
          </div>
        </div>
      </div>

      {/* Product Performance Strip at the Top */}
      {productSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-2 sm:p-2.5 shadow-2xs mb-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-indigo-600" />
              <span>Product Performance Overview</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Click pill to filter views
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            {/* All Products Pill */}
            <button
              type="button"
              onClick={() => setSelectedProductFilter("all")}
              className={`px-2.5 py-1.5 rounded-xl border text-left shrink-0 transition-all touch-manipulation ${
                selectedProductFilter === "all"
                  ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-2xs"
                  : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                All Products
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono font-black text-xs text-slate-900 tabular-nums">
                  {rows.reduce((sum, r) => sum + (r.entry.finishedGood || 0), 0).toLocaleString()}
                </span>
                <span className="text-[9px] text-slate-400">pcs</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5 font-medium">
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
                  className={`px-2.5 py-1.5 rounded-xl border text-left shrink-0 transition-all touch-manipulation ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-2xs"
                      : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[130px] leading-snug">
                      {prod.productName}
                    </span>
                    <span className="text-[8px] font-mono font-bold bg-white px-1 py-0.2 rounded text-slate-600 border border-slate-200">
                      {prod.sku}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-mono font-black text-xs text-slate-900 tabular-nums">
                        {prod.totalFG.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-slate-400">pcs</span>
                    </div>

                    {prod.hasTarget ? (
                      <span
                        className={`text-[9px] font-mono font-black tabular-nums px-1 py-0.2 rounded-md ${
                          prod.netVariance >= 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {prod.netVariance >= 0 ? `+${prod.netVariance}` : `${prod.netVariance}`}
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">No target</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5 gap-1.5 font-mono tabular-nums">
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
          {renderControlsToolbar()}

          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 min-w-[210px] sticky left-0 bg-slate-100 z-20 sticky-col-shadow">
                    Line & Product
                  </th>
                  <th className="py-3 px-3 min-w-[130px]">Initial Set Plan</th>
                  <th className="py-3 px-3 min-w-[130px]">Edited Plan</th>
                  <th className="py-3 px-3 min-w-[150px]">Left from Plan</th>
                  <th className="py-3 px-3 min-w-[130px]">Daily Target</th>
                  <th className="py-3 px-3 min-w-[170px] bg-emerald-50/50 text-emerald-950 font-extrabold">
                    Finished Good
                  </th>
                  <th className="py-3 px-3 min-w-[110px]">Variance</th>
                  <th className="py-3 px-3 min-w-[140px]">Rework</th>
                  <th className="py-3 px-3 min-w-[140px]">Reject</th>
                  <th className="py-3 px-3 min-w-[140px]">Scrap</th>
                  <th className="py-3 px-3 min-w-[140px]">WIP</th>
                  <th className="py-3 px-3 min-w-[140px]">Downtime (min)</th>
                  <th className="py-3 px-3 min-w-[170px]">QA Review</th>
                  <th className="py-3 px-3 min-w-[180px]">OM Review</th>
                  <th className="py-3 px-4 min-w-[260px]">Issue Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="text-center py-12 text-slate-400">
                      <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No active lines or products configured for this factory.
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="text-center py-12 text-slate-400">
                      <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      {searchQuery.trim()
                        ? `No production lines match "${searchQuery.trim()}".`
                        : "No production lines producing the selected product."}
                      <div className="mt-2 flex items-center justify-center gap-2">
                        {searchQuery.trim() && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="btn btn-xs btn-outline btn-neutral rounded-lg"
                          >
                            Clear Search
                          </button>
                        )}
                        {selectedProductFilter !== "all" && (
                          <button
                            type="button"
                            onClick={() => setSelectedProductFilter("all")}
                            className="btn btn-xs btn-outline btn-neutral rounded-lg"
                          >
                            Show All Products
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : groupMode === "product" ? (
                  productGroups.map((group) => (
                    <React.Fragment key={`group_${group.product.id}`}>
                      {/* Product Group Header Banner Row */}
                      <tr className="bg-indigo-50/80 border-y-2 border-indigo-200">
                        <td colSpan={15} className="py-2.5 px-4 sticky left-0 z-10 bg-indigo-50/90">
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
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            {renderControlsToolbar()}
          </div>
          {rows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
              <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No active lines or products configured for this factory.
            </div>
          ) : displayedRows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
              <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              {searchQuery.trim()
                ? `No production lines match "${searchQuery.trim()}".`
                : "No production lines producing the selected product."}
              <div className="mt-2 flex items-center justify-center gap-2">
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="btn btn-xs btn-outline btn-neutral rounded-lg"
                  >
                    Clear Search
                  </button>
                )}
                {selectedProductFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setSelectedProductFilter("all")}
                    className="btn btn-xs btn-outline btn-neutral rounded-lg"
                  >
                    Show All Products
                  </button>
                )}
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
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-2 sm:py-3 shadow-xl pb-safe">
        <div className="max-w-7xl 2xl:max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16 flex items-center justify-between gap-3">
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
            {isDirty && !isReadOnly && (
              <span className="badge badge-warning badge-sm font-bold shadow-2xs">
                {modifiedRowCount} modified
              </span>
            )}
            {!isOM && currentReview?.isReviewed && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Reviewed by OM ({currentReview.reviewerName})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOM ? (
              // OM Review Actions
              currentReview?.isReviewed ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Reviewed by {currentReview.reviewerName || "OM"}</span>
                    {currentReview.reviewedAt && (
                      <span className="text-slate-400 font-mono text-xs hidden md:inline">
                        ({format(parseISO(currentReview.reviewedAt), "MMM d, HH:mm")})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleUnmarkReviewed}
                    disabled={isReviewing}
                    className="btn btn-sm btn-ghost text-slate-600 hover:text-rose-600 rounded-xl text-xs font-bold"
                  >
                    {isReviewing ? "Updating..." : "Revoke Review"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleMarkReviewed}
                  disabled={isReviewing}
                  className="btn btn-sm sm:btn-md min-h-[44px] px-5 sm:px-8 rounded-2xl font-black shadow-md transition-all flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white border-none shadow-indigo-200 active:scale-95 cursor-pointer touch-manipulation"
                >
                  {isReviewing ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      <span>Reviewing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      <span>Mark as Reviewed</span>
                      <span className="hidden sm:inline text-xs font-normal opacity-90">
                        (በኦፕሬሽን ስራ አስኪያጅ አጽድቅ)
                      </span>
                    </>
                  )}
                </button>
              )
            ) : isMonthLocked ? (
              // FM Month Passed - Locked State
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-2xl font-bold text-xs sm:text-sm shadow-2xs">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Reporting Window Closed (የክለሳ ጊዜ አልፏል)</span>
                <span className="text-[10px] text-amber-700 font-mono hidden md:inline font-normal">
                  — Month Passed
                </span>
              </div>
            ) : isDayLocked ? (
              // FM 1 Data Entry Per Day - Locked State
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-2xl font-bold text-xs sm:text-sm shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Daily Entry Completed (የዕለቱ መረጃ ተመዝግቧል)</span>
                <span className="text-[10px] text-emerald-700 font-mono hidden md:inline font-normal">
                  — 1 Data Entry Recorded
                </span>
              </div>
            ) : (
              // FM Standard Actions
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ethiopian Date Picker Modal (Responsive Bottom-Sheet on Mobile, Centered on Desktop) */}
      {showEthPicker && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ethiopian Date Selection"
            className="bg-white w-full max-h-[92dvh] sm:max-h-[85vh] sm:max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200 shadow-2xl p-4 sm:p-6 pb-safe flex flex-col overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-bottom-2 duration-200"
          >
            {/* Mobile Drag Handle Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2.5 sm:hidden shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl" role="img" aria-label="Ethiopian Flag">🇪🇹</span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    ቀን ምረጥ <span className="text-xs sm:text-sm font-semibold text-slate-500">(Select Date)</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                    13-Month Ethiopian Production Calendar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEthPicker(false)}
                className="btn btn-ghost btn-sm btn-circle text-slate-400 hover:text-slate-700"
                aria-label="Close Ethiopian date picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Year & Month Stepper Controls */}
            <div className="my-3 space-y-3">
              <div className="flex items-center justify-between gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={handlePrevPickerMonth}
                  className="btn btn-sm btn-circle btn-ghost text-slate-600 hover:bg-white min-h-[38px] min-w-[38px] touch-manipulation"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 flex-1 justify-center">
                  {/* Month Select */}
                  <select
                    value={pickerMonth}
                    onChange={(e) => setPickerMonth(Number(e.target.value))}
                    className="select select-sm select-bordered font-extrabold text-slate-800 rounded-xl leading-relaxed text-xs sm:text-sm h-9 min-h-0"
                    aria-label="Select Ethiopian Month"
                  >
                    {Array.from({ length: 13 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}. {ETH_MONTH_NAMES_AM[m]} ({ETH_MONTH_NAMES_EN[m]})
                      </option>
                    ))}
                  </select>

                  {/* Year Select */}
                  <select
                    value={pickerYear}
                    onChange={(e) => setPickerYear(Number(e.target.value))}
                    className="select select-sm select-bordered font-extrabold text-slate-800 rounded-xl leading-relaxed font-mono text-xs sm:text-sm h-9 min-h-0"
                    aria-label="Select Ethiopian Year"
                  >
                    {[2014, 2015, 2016, 2017, 2018, 2019, 2020].map((y) => (
                      <option key={y} value={y}>
                        {y} ዓ.ም
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleNextPickerMonth}
                  className="btn btn-sm btn-circle btn-ghost text-slate-600 hover:bg-white min-h-[38px] min-w-[38px] touch-manipulation"
                  aria-label="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 7-Day Ethiopian Month Calendar Grid */}
              <div className="bg-slate-50/70 rounded-2xl border border-slate-200/70 p-2 sm:p-2.5">
                {/* Weekday Column Headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1 pb-1 border-b border-slate-200/60">
                  {ETH_PICKER_WEEKDAYS.map((wd, idx) => (
                    <div
                      key={`wd_${idx}`}
                      className={`text-[10px] sm:text-xs font-bold leading-normal ${
                        wd.isWeekend ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      <span>{wd.am}</span>
                      <span className="block text-[8px] sm:text-[9px] font-mono text-slate-400">{wd.en}</span>
                    </div>
                  ))}
                </div>

                {/* Date Tiles Grid */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {/* Leading blanks for month alignment */}
                  {Array.from({ length: pickerLeadingBlanks }).map((_, idx) => (
                    <div key={`blank_${idx}`} className="aspect-square min-h-[38px] sm:min-h-[42px] rounded-xl" />
                  ))}

                  {Array.from({ length: pickerDaysCount }, (_, i) => i + 1).map((d) => {
                    const isSelected = pickerDay === d;
                    let isDayToday = false;
                    let isFutureDay = false;
                    try {
                      const dayIso = ethToGregorian(pickerYear, pickerMonth, d);
                      isDayToday = dayIso === todayStr;
                      isFutureDay = dayIso > todayStr;
                    } catch {}

                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={isFutureDay}
                        onClick={() => setPickerDay(d)}
                        className={`aspect-square min-h-[38px] sm:min-h-[42px] rounded-xl font-mono font-bold text-xs sm:text-sm flex flex-col items-center justify-center relative transition-all active:scale-95 touch-manipulation ${
                          isSelected
                            ? "bg-indigo-600 text-white font-extrabold shadow-md scale-105 z-10 ring-2 ring-indigo-400"
                            : isDayToday
                            ? "border-2 border-emerald-500 bg-white text-emerald-950 font-black shadow-2xs"
                            : isFutureDay
                            ? "opacity-30 cursor-not-allowed bg-slate-100 text-slate-400"
                            : "bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/30 text-slate-800"
                        }`}
                        title={isFutureDay ? "Future Date (Disabled)" : undefined}
                      >
                        <span className="leading-none">{d}</span>
                        {isDayToday && !isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5 inline-block" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Date Preview */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                <div className="font-bold text-indigo-950">
                  🇪🇹 {pickerDay} {ETH_MONTH_NAMES_AM[pickerMonth]} {pickerYear} ዓ.ም
                </div>
                {selectedIsoPreview && (
                  <div className="font-mono text-[11px] text-indigo-700/80 truncate ml-2">
                    GC: {selectedIsoPreview}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-auto">
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
                className="btn btn-sm btn-ghost text-slate-600 font-bold min-h-[40px] px-3 rounded-xl touch-manipulation"
              >
                ዛሬ (Today)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEthPicker(false)}
                  className="btn btn-sm min-h-[40px] btn-ghost rounded-xl leading-relaxed touch-manipulation px-3"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyEthDate(pickerYear, pickerMonth, pickerDay)
                  }
                  className="btn btn-sm min-h-[40px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-4 leading-relaxed touch-manipulation shadow-xs"
                >
                  አረጋግጥ (Apply)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OM Edit Daily Plan Modal */}
      {editingPlanRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-relaxed">
                    Edit Daily Plan Target
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Adjust daily target — automatically updates and reflects on annual plan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlanRow(null)}
                className="btn btn-ghost btn-sm btn-circle text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Line:</span>
                <span className="font-extrabold text-slate-900">{editingPlanRow.lineName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Product:</span>
                <span className="font-extrabold text-slate-900">
                  {editingPlanRow.productName} ({editingPlanRow.sku})
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Plan Period:</span>
                <span className="font-mono font-bold text-slate-800">
                  {editingPlanRow.plan?.startDate || "2026-01-01"} → {editingPlanRow.plan?.endDate || "2026-12-31"}
                </span>
              </div>
            </div>

            {/* Side-by-Side Annual Plans Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-100/90 border border-slate-200 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Initial Set Annual Plan
                </span>
                <span className="font-mono font-black text-slate-800 text-lg block mt-1">
                  {(editingPlanRow.plan?.initialPlannedQty ?? editingPlanRow.plan?.plannedQty ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Baseline target (unaltered)</span>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                  Current Edited Annual Plan
                </span>
                <span className="font-mono font-black text-indigo-700 text-lg block mt-1">
                  {(editingPlanRow.plan?.plannedQty ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-indigo-400 font-medium">Active revised plan</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Daily Target (pcs / day)
              </label>
              <input
                type="number"
                min="1"
                required
                value={editTargetValue}
                onChange={(e) => setEditTargetValue(Math.max(1, Number(e.target.value)))}
                className="input input-bordered w-full text-base font-mono font-black text-slate-900 rounded-2xl min-h-[48px] border-slate-200 focus:border-indigo-600 tabular-nums"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Changing daily target will recalculate the annual plan based on total working days in period.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPlanRow(null)}
                className="btn btn-ghost rounded-2xl min-h-[44px] px-5 font-bold text-xs sm:text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDailyPlan}
                disabled={isSavingPlan || editTargetValue < 1}
                className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none min-h-[44px] px-6 font-bold text-xs sm:text-sm shadow-sm"
              >
                {isSavingPlan ? "Saving..." : "Save Daily Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
