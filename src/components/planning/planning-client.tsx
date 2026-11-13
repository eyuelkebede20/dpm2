"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createPlanAction,
  updatePlanAction,
  deletePlanAction,
  batchCreatePlansAction,
  PlanItemWithPlant,
  PlanReportEntryItem,
} from "@/actions/plan-actions";
import { PlanDatePicker } from "./plan-date-picker";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import {
  CalendarDays,
  Plus,
  Search,
  Filter,
  Building2,
  GitBranch,
  Boxes,
  Pencil,
  Trash2,
  X,
  Sparkles,
  Globe,
  Lock,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { gregorianToEth, ethToGregorian, formatEthDate } from "@/lib/ethiopian-calendar";
import { format, parseISO } from "date-fns";

export type PlanningTab = "daily" | "weekly" | "monthly" | "master";

interface PlanningClientProps {
  factories: Array<{ id: string; name: string }>;
  initialFactoryId?: string;
  lines: Array<{ id: string; name: string; factoryId: string }>;
  products: Array<{ id: string; name: string; sku: string; factoryId?: string }>;
  lineProducts: Array<{ lineId: string; productId: string }>;
  plans: PlanItemWithPlant[];
  entries?: PlanReportEntryItem[];
  calendarSystem: "ethiopian" | "gregorian";
  userRole: "om" | "fm" | "sys_admin" | "qa";
  canManagePlans: boolean;
}

export function PlanningClient({
  factories,
  initialFactoryId = "all",
  lines,
  products,
  lineProducts,
  plans,
  entries = [],
  calendarSystem,
  userRole,
  canManagePlans,
}: PlanningClientProps) {
  const router = useRouter();

  // Tab View State: Daily, Weekly, Monthly, or Master Plans
  const [activeTab, setActiveTab] = useState<PlanningTab>("daily");

  // Daily View Date Selector (defaults to today ISO YYYY-MM-DD)
  const [dailyDate, setDailyDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Filters
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>(initialFactoryId);
  const [searchQuery, setSearchQuery] = useState("");

  // Batch Plan Modal (for OM to add plans for all unplanned products at once)
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchFactoryId, setBatchFactoryId] = useState<string>(
    initialFactoryId !== "all" ? initialFactoryId : factories[0]?.id || ""
  );
  const [batchStartDate, setBatchStartDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [batchEndDate, setBatchEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [batchDefaultQty, setBatchDefaultQty] = useState<number>(10000);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createFactoryId, setCreateFactoryId] = useState<string>(
    factories[0]?.id || ""
  );
  const [createLineId, setCreateLineId] = useState<string>("");
  const [createProductId, setCreateProductId] = useState<string>("");
  const [createStartDate, setCreateStartDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [createEndDate, setCreateEndDate] = useState<string>(() => {
    // 30 days from now default
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [createQty, setCreateQty] = useState<number>(10000);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string>("");
  const [editLineId, setEditLineId] = useState<string>("");
  const [editProductId, setEditProductId] = useState<string>("");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [editQty, setEditQty] = useState<number>(0);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Set of product IDs that already have a plan (rule: max 1 plan per product)
  const plannedProductIds = useMemo(() => {
    return new Set(plans.map((p) => p.productId));
  }, [plans]);

  // Products belonging to the currently selected factory (or all factories)
  const relevantProducts = useMemo(() => {
    if (selectedFactoryId === "all") return products;
    return products.filter((p) => !p.factoryId || p.factoryId === selectedFactoryId);
  }, [products, selectedFactoryId]);

  // Unplanned products in the current scope
  const unplannedProducts = useMemo(() => {
    return relevantProducts.filter((p) => !plannedProductIds.has(p.id));
  }, [relevantProducts, plannedProductIds]);

  // Lines available for create modal
  const createAvailableLines = useMemo(() => {
    if (!createFactoryId) return lines;
    return lines.filter((l) => l.factoryId === createFactoryId);
  }, [lines, createFactoryId]);

  // Products available for selected line in create modal
  const createAvailableProducts = useMemo(() => {
    if (!createLineId) return products;
    const linkedIds = lineProducts
      .filter((lp) => lp.lineId === createLineId)
      .map((lp) => lp.productId);
    if (linkedIds.length === 0) return products;
    return products.filter((p) => linkedIds.includes(p.id));
  }, [lineProducts, createLineId, products]);

  // Lines available for edit modal
  const editPlanRecord = useMemo(() => {
    return plans.find((p) => p.id === editPlanId);
  }, [plans, editPlanId]);

  const editAvailableLines = useMemo(() => {
    if (!editPlanRecord) return lines;
    return lines.filter((l) => l.factoryId === editPlanRecord.factoryId);
  }, [lines, editPlanRecord]);

  const editAvailableProducts = useMemo(() => {
    if (!editLineId) return products;
    const linkedIds = lineProducts
      .filter((lp) => lp.lineId === editLineId)
      .map((lp) => lp.productId);
    if (linkedIds.length === 0) return products;
    return products.filter((p) => linkedIds.includes(p.id));
  }, [lineProducts, editLineId, products]);

  // Filtered Plans for Master View
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      // Factory Filter
      if (selectedFactoryId !== "all" && p.factoryId !== selectedFactoryId) {
        return false;
      }
      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchProduct = p.productName.toLowerCase().includes(q);
        const matchSku = p.productSku.toLowerCase().includes(q);
        const matchLine = p.lineName.toLowerCase().includes(q);
        const matchPlant = p.factoryName.toLowerCase().includes(q);
        if (!matchProduct && !matchSku && !matchLine && !matchPlant) {
          return false;
        }
      }
      return true;
    });
  }, [plans, selectedFactoryId, searchQuery]);

  // Client-side pagination for smooth plan list rendering
  const planPagination = usePagination({
    items: filteredPlans,
    initialPageSize: 10,
  });

  // KPI calculations
  const totalPlannedUnits = useMemo(() => {
    return filteredPlans.reduce((acc, p) => acc + p.plannedQty, 0);
  }, [filteredPlans]);

  const totalProducedUnits = useMemo(() => {
    return filteredPlans.reduce((acc, p) => acc + p.totalProduced, 0);
  }, [filteredPlans]);

  const overallCompletionRate = useMemo(() => {
    if (totalPlannedUnits === 0) return 0;
    return Math.min(100, Math.round((totalProducedUnits / totalPlannedUnits) * 100));
  }, [totalPlannedUnits, totalProducedUnits]);

  // Product Schedule Matrix (mapping all products to Daily, Weekly, and Monthly actuals & targets)
  const productScheduleRows = useMemo(() => {
    const d = new Date(dailyDate);
    const sevenDaysAgo = new Date(d);
    sevenDaysAgo.setDate(d.getDate() - 6);
    const startWeeklyIso = sevenDaysAgo.toISOString().slice(0, 10);
    const currentMonthIso = dailyDate.slice(0, 7);

    return relevantProducts
      .filter((prod) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchName = prod.name.toLowerCase().includes(q);
        const matchSku = prod.sku?.toLowerCase().includes(q);
        return matchName || matchSku;
      })
      .map((prod) => {
        const plan = plans.find((p) => p.productId === prod.id);
        const plant = factories.find((f) => f.id === prod.factoryId) || (plan ? { name: plan.factoryName } : undefined);

        // Calculate Daily Metrics
        // Daily target based on standard 26-day manufacturing cycle
        const dailyTarget = plan ? Math.max(1, Math.round(plan.plannedQty / 26)) : null;
        const dailyActual = entries
          .filter((e) => e.productId === prod.id && e.date === dailyDate)
          .reduce((sum, e) => sum + e.finishedGood, 0);
        const dailyVariance = dailyTarget !== null ? dailyActual - dailyTarget : null;

        // Calculate Weekly Metrics (7-day window ending at dailyDate)
        const weeklyTarget = plan
          ? (plan.weeklyPlanned || (dailyTarget ? dailyTarget * 6 : Math.round(plan.plannedQty / 4)))
          : null;
        const weeklyActual = entries
          .filter((e) => e.productId === prod.id && e.date >= startWeeklyIso && e.date <= dailyDate)
          .reduce((sum, e) => sum + e.finishedGood, 0);
        const weeklyLeft = weeklyTarget !== null ? Math.max(0, weeklyTarget - weeklyActual) : null;
        const weeklyPct = weeklyTarget && weeklyTarget > 0 ? Math.min(100, Math.round((weeklyActual / weeklyTarget) * 100)) : 0;

        // Calculate Monthly Metrics (current month YYYY-MM)
        const monthlyTarget = plan ? plan.plannedQty : null;
        const monthlyActual = entries
          .filter((e) => e.productId === prod.id && e.date.startsWith(currentMonthIso))
          .reduce((sum, e) => sum + e.finishedGood, 0);
        const monthlyLeft = monthlyTarget !== null ? Math.max(0, monthlyTarget - monthlyActual) : null;
        const monthlyPct = monthlyTarget && monthlyTarget > 0 ? Math.min(100, Math.round((monthlyActual / monthlyTarget) * 100)) : 0;

        return {
          product: prod,
          plan,
          plantName: plant?.name || (plan ? plan.factoryName : "General Plant"),
          dailyTarget,
          dailyActual,
          dailyVariance,
          weeklyTarget,
          weeklyActual,
          weeklyLeft,
          weeklyPct,
          monthlyTarget,
          monthlyActual,
          monthlyLeft,
          monthlyPct,
        };
      });
  }, [relevantProducts, plans, entries, dailyDate, searchQuery, factories]);

  // Date formatter helper based on Sys Admin selection
  const formatPlanDate = (isoStr: string) => {
    if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr;
    try {
      if (calendarSystem === "ethiopian") {
        const eth = gregorianToEth(isoStr);
        return formatEthDate(eth, "full_am");
      }
      return format(parseISO(isoStr), "MMM d, yyyy");
    } catch {
      return isoStr;
    }
  };

  const formatPlanDateSecondary = (isoStr: string) => {
    if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return "";
    try {
      if (calendarSystem === "ethiopian") {
        return format(parseISO(isoStr), "MMM d, yyyy") + " GC";
      }
      const eth = gregorianToEth(isoStr);
      return formatEthDate(eth, "full_am");
    } catch {
      return "";
    }
  };

  // Open Create Modal handler
  const handleOpenCreateModal = () => {
    const fId = selectedFactoryId !== "all" ? selectedFactoryId : factories[0]?.id || "";
    setCreateFactoryId(fId);
    const available = lines.filter((l) => !fId || l.factoryId === fId);
    const defaultLineId = available[0]?.id || "";
    setCreateLineId(defaultLineId);

    // Auto-select first product that does not already have an active plan
    const linkedIds = lineProducts
      .filter((lp) => lp.lineId === defaultLineId)
      .map((lp) => lp.productId);
    const candidateProds = linkedIds.length > 0
      ? products.filter((p) => linkedIds.includes(p.id))
      : products;
    const availableProd = candidateProds.find((p) => !plannedProductIds.has(p.id));
    setCreateProductId(availableProd?.id || "");

    setCreateQty(10000);
    setCreateError(null);
    setCreateModalOpen(true);
  };

  // Quick Open Create Modal for a specific unplanned product
  const handleOpenCreateModalForProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    const fId = prod?.factoryId || (selectedFactoryId !== "all" ? selectedFactoryId : factories[0]?.id || "");
    setCreateFactoryId(fId);

    const linked = lineProducts.find((lp) => lp.productId === productId);
    const plantLines = lines.filter((l) => !fId || l.factoryId === fId);
    const targetLineId = linked ? linked.lineId : plantLines[0]?.id || "";

    setCreateLineId(targetLineId);
    setCreateProductId(productId);
    setCreateQty(10000);
    setCreateError(null);
    setCreateModalOpen(true);
  };

  // Submit Create Plan
  const handleSaveCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createLineId) {
      setCreateError("Please select a production line.");
      return;
    }
    if (!createProductId) {
      setCreateError("Please select a product.");
      return;
    }
    if (plannedProductIds.has(createProductId)) {
      setCreateError("A production plan already exists for this product. Only one plan per product is allowed.");
      return;
    }
    if (createStartDate > createEndDate) {
      setCreateError("End date must be on or after start date.");
      return;
    }
    if (createQty <= 0) {
      setCreateError("Planned quantity must be greater than zero.");
      return;
    }

    try {
      setCreateSaving(true);
      setCreateError(null);

      const res = await createPlanAction({
        lineId: createLineId,
        productId: createProductId,
        startDate: createStartDate,
        endDate: createEndDate,
        plannedQty: createQty,
        factoryId: createFactoryId,
      });

      if (!res.success) {
        setCreateError(res.error || "Failed to create plan.");
        return;
      }

      setCreateModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setCreateError(err.message || "An unexpected error occurred.");
    } finally {
      setCreateSaving(false);
    }
  };

  // Open Edit Modal handler
  const handleOpenEditModal = (plan: PlanItemWithPlant) => {
    setEditPlanId(plan.id);
    setEditLineId(plan.lineId);
    setEditProductId(plan.productId);
    setEditStartDate(plan.startDate);
    setEditEndDate(plan.endDate);
    setEditQty(plan.plannedQty);
    setEditError(null);
    setEditModalOpen(true);
  };

  // Submit Edit Plan
  const handleSaveEditPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLineId || !editProductId) {
      setEditError("Line and product are required.");
      return;
    }
    if (plans.some((p) => p.productId === editProductId && p.id !== editPlanId)) {
      setEditError("Another production plan already exists for this product. Only one plan per product is allowed.");
      return;
    }
    if (editStartDate > editEndDate) {
      setEditError("End date must be on or after start date.");
      return;
    }
    if (editQty <= 0) {
      setEditError("Planned quantity must be greater than zero.");
      return;
    }

    try {
      setEditSaving(true);
      setEditError(null);

      const res = await updatePlanAction({
        id: editPlanId,
        lineId: editLineId,
        productId: editProductId,
        startDate: editStartDate,
        endDate: editEndDate,
        plannedQty: editQty,
      });

      if (!res.success) {
        setEditError(res.error || "Failed to update plan.");
        return;
      }

      setEditModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setEditError(err.message || "An unexpected error occurred.");
    } finally {
      setEditSaving(false);
    }
  };

  // Batch Plan Handlers
  const handleOpenBatchModal = () => {
    const fId = selectedFactoryId !== "all" ? selectedFactoryId : factories[0]?.id || "";
    setBatchFactoryId(fId);
    setBatchDefaultQty(10000);
    setBatchError(null);
    setBatchModalOpen(true);
  };

  const handleSaveBatchPlans = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchFactoryId) {
      setBatchError("Please select an operating plant.");
      return;
    }
    if (batchStartDate > batchEndDate) {
      setBatchError("End date must be on or after start date.");
      return;
    }
    if (batchDefaultQty <= 0) {
      setBatchError("Default planned quantity must be greater than zero.");
      return;
    }

    try {
      setBatchSaving(true);
      setBatchError(null);

      const res = await batchCreatePlansAction({
        factoryId: batchFactoryId,
        startDate: batchStartDate,
        endDate: batchEndDate,
        defaultPlannedQty: batchDefaultQty,
      });

      if (!res.success) {
        setBatchError(res.error || "Failed to batch create plans.");
        return;
      }

      toast.success(res.message || `Created ${res.count || 0} production plans successfully.`);
      setBatchModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setBatchError(err.message || "An unexpected error occurred.");
    } finally {
      setBatchSaving(false);
    }
  };

  // Date Navigator Handlers
  const handlePrevDay = () => {
    const d = new Date(dailyDate);
    d.setDate(d.getDate() - 1);
    setDailyDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(dailyDate);
    d.setDate(d.getDate() + 1);
    setDailyDate(d.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    setDailyDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Executive Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <CalendarDays className="w-4 h-4" />
            <span>Master Production Schedule</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-500 font-semibold normal-case">
              {calendarSystem === "ethiopian" ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sys Admin Setting: 🇪🇹 Ethiopian Calendar</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Sys Admin Setting: 🌐 Gregorian Calendar</span>
                </>
              )}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <span>Production Planning</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {filteredPlans.length} {filteredPlans.length === 1 ? "Plan" : "Plans"}
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daily, weekly, and monthly targets across manufacturing plants, lines, and product catalogs.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {canManagePlans ? (
            <>
              {unplannedProducts.length > 0 && (
                <button
                  type="button"
                  data-testid="batch-add-plans-button"
                  onClick={handleOpenBatchModal}
                  className="btn btn-sm sm:btn-md bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold gap-2 shadow-xs border-none"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Batch Add Plans ({unplannedProducts.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="btn btn-sm sm:btn-md bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold gap-2 shadow-xs border-none"
              >
                <Plus className="w-4 h-4" />
                <span>New Production Plan</span>
              </button>
            </>
          ) : (
            <div className="badge badge-lg bg-amber-50 text-amber-800 border-amber-200 gap-1.5 py-3 font-semibold text-xs">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Read-Only (Managed by Operation Manager)</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Read-Only Notice for Factory Managers */}
      {!canManagePlans && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900 leading-relaxed shadow-2xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold text-amber-950 block text-sm">
              Factory Manager Read-Only View
            </span>
            <span className="text-amber-800/90 mt-0.5 block">
              Production plans and targets are scheduled by the <strong>Operation Manager (OM)</strong>. You have read-only visibility to inspect daily targets, weekly pacing, and monthly completion across lines and products.
            </span>
          </div>
        </div>
      )}

      {/* 3. High-Visibility Warning Banner for Products With No Plan */}
      {unplannedProducts.length > 0 && (
        <div
          data-testid="unplanned-warning-banner"
          className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-amber-950">
                  ⚠️ {unplannedProducts.length} {unplannedProducts.length === 1 ? "Product has" : "Products have"} No Active Production Plan
                </h3>
                <span className="badge badge-sm bg-amber-200 text-amber-900 border-none font-bold">
                  እቅድ አልተዘጋጀም
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1">
                Products without plans lack baseline daily, weekly, and monthly targets. You can initialize plans for all unplanned products at once.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {unplannedProducts.slice(0, 6).map((p) => (
                  <span
                    key={p.id}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-900 shadow-2xs"
                  >
                    {p.name} {p.sku ? `(${p.sku})` : ""}
                  </span>
                ))}
                {unplannedProducts.length > 6 && (
                  <span className="text-[11px] font-bold text-amber-800 self-center">
                    +{unplannedProducts.length - 6} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {canManagePlans && (
            <button
              type="button"
              onClick={handleOpenBatchModal}
              className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl gap-2 shadow-xs border-none shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Add Plans For All Unplanned Products</span>
            </button>
          )}
        </div>
      )}

      {/* 4. Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Active Plans
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-1">
            {filteredPlans.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across {factories.length} operating {factories.length === 1 ? "plant" : "plants"}
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Total Planned Quantity
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-1 tabular-nums">
            {totalPlannedUnits.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Scheduled production targets</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Cumulative Output
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-1 tabular-nums">
            {totalProducedUnits.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Produced finished goods</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Plan Fulfillment Rate
          </span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono mt-1 tabular-nums">
            {overallCompletionRate}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${overallCompletionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 5. Filter & Search Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Product Name, SKU, Line, or Plant..."
            className="input input-sm input-bordered w-full pl-9 rounded-xl text-xs font-medium"
          />
        </div>

        {/* Plant Selector Filter */}
        {factories.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              aria-label="Filter by Plant"
              value={selectedFactoryId}
              onChange={(e) => setSelectedFactoryId(e.target.value)}
              className="select select-sm select-bordered rounded-xl text-xs font-semibold"
            >
              <option value="all">All Operating Plants ({factories.length})</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 6. TAB SELECTOR BAR (Daily, Weekly, Monthly, Master Schedule) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          data-testid="tab-daily"
          onClick={() => setActiveTab("daily")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === "daily"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Daily View (የቀን)</span>
        </button>

        <button
          type="button"
          data-testid="tab-weekly"
          onClick={() => setActiveTab("weekly")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === "weekly"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Weekly View (የሳምንት)</span>
        </button>

        <button
          type="button"
          data-testid="tab-monthly"
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === "monthly"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Monthly View (የወር)</span>
        </button>

        <button
          type="button"
          data-testid="tab-master"
          onClick={() => setActiveTab("master")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === "master"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Master Schedule ({filteredPlans.length})</span>
        </button>
      </div>

      {/* ============================================================= */}
      {/* 7. TAB CONTENT: DAILY VIEW                                    */}
      {/* ============================================================= */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          {/* Daily Date Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevDay}
                className="btn btn-xs btn-outline rounded-lg"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="btn btn-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 rounded-lg font-bold"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                className="btn btn-xs btn-outline rounded-lg"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="font-mono font-black text-sm text-slate-900 ml-1">
                {dailyDate}
              </span>
            </div>

            <div className="text-xs font-semibold text-slate-500">
              {calendarSystem === "ethiopian" ? (
                <span>🇪🇹 {formatEthDate(gregorianToEth(dailyDate), "full_am")}</span>
              ) : (
                <span>🌐 {format(parseISO(dailyDate), "EEEE, MMMM d, yyyy")}</span>
              )}
            </div>
          </div>

          {/* Daily Target & Output Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Product Catalog</th>
                    <th className="py-3 px-4">Plant</th>
                    <th className="py-3 px-4 text-right">Daily Target</th>
                    <th className="py-3 px-4 text-right">Day Output ({dailyDate})</th>
                    <th className="py-3 px-4 text-right">Daily Variance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {canManagePlans && <th className="py-3 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productScheduleRows.map((row) => {
                    const hasPlan = Boolean(row.plan);
                    const isMet = row.dailyTarget !== null && row.dailyActual >= row.dailyTarget;

                    return (
                      <tr key={row.product.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Product */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">
                              {row.product.name}
                            </span>
                            {row.product.sku && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {row.product.sku}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Plant */}
                        <td className="py-3 px-4 text-xs font-semibold text-slate-600">
                          {row.plantName}
                        </td>

                        {/* Daily Target */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 text-xs tabular-nums">
                          {hasPlan && row.dailyTarget !== null ? (
                            `${row.dailyTarget.toLocaleString()} pcs`
                          ) : (
                            <span className="text-slate-400 font-sans italic text-[11px]">
                              —
                            </span>
                          )}
                        </td>

                        {/* Day Output */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-xs tabular-nums">
                          {row.dailyActual.toLocaleString()} pcs
                        </td>

                        {/* Variance */}
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          {hasPlan && row.dailyVariance !== null ? (
                            <span
                              className={`font-black ${
                                row.dailyVariance >= 0 ? "text-emerald-700" : "text-amber-700"
                              }`}
                            >
                              {row.dailyVariance >= 0 ? "+" : ""}
                              {row.dailyVariance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {!hasPlan ? (
                            <span className="badge badge-sm bg-amber-100 text-amber-900 border-amber-300 font-bold gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>No Plan (እቅድ አልተዘጋጀም)</span>
                            </span>
                          ) : isMet ? (
                            <span className="badge badge-sm bg-emerald-100 text-emerald-900 border-emerald-300 font-bold gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Target Met</span>
                            </span>
                          ) : (
                            <span className="badge badge-sm bg-indigo-50 text-indigo-800 border-indigo-200 font-bold gap-1">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              <span>In Progress</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        {canManagePlans && (
                          <td className="py-3 px-4 text-center">
                            {hasPlan && row.plan ? (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(row.plan!)}
                                className="btn btn-xs btn-ghost text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                data-testid={`set-plan-${row.product.id}`}
                                onClick={() => handleOpenCreateModalForProduct(row.product.id)}
                                className="btn btn-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold border-indigo-200 gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Set Plan</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 8. TAB CONTENT: WEEKLY VIEW                                   */}
      {/* ============================================================= */}
      {activeTab === "weekly" && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Product Catalog</th>
                  <th className="py-3 px-4">Plant</th>
                  <th className="py-3 px-4 text-right">Weekly Target</th>
                  <th className="py-3 px-4 text-right">7-Day Output</th>
                  <th className="py-3 px-4 text-right">Balance Remaining</th>
                  <th className="py-3 px-4">Weekly Fulfillment</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {canManagePlans && <th className="py-3 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productScheduleRows.map((row) => {
                  const hasPlan = Boolean(row.plan);

                  return (
                    <tr key={row.product.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {row.product.name}
                          </span>
                          {row.product.sku && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {row.product.sku}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs font-semibold text-slate-600">
                        {row.plantName}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 text-xs tabular-nums">
                        {hasPlan && row.weeklyTarget !== null ? (
                          `${row.weeklyTarget.toLocaleString()} pcs`
                        ) : (
                          <span className="text-slate-400 font-sans italic text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-xs tabular-nums">
                        {row.weeklyActual.toLocaleString()} pcs
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-600 text-xs tabular-nums">
                        {hasPlan && row.weeklyLeft !== null ? (
                          `${row.weeklyLeft.toLocaleString()} pcs`
                        ) : (
                          <span className="text-slate-400 font-sans italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3 px-4">
                        {hasPlan ? (
                          <div className="w-28">
                            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-600 mb-0.5">
                              <span>{row.weeklyPct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-1.5 rounded-full"
                                style={{ width: `${row.weeklyPct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {!hasPlan ? (
                          <span className="badge badge-sm bg-amber-100 text-amber-900 border-amber-300 font-bold gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>No Plan</span>
                          </span>
                        ) : row.weeklyPct >= 100 ? (
                          <span className="badge badge-sm bg-emerald-100 text-emerald-900 border-emerald-300 font-bold gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Weekly Met</span>
                          </span>
                        ) : (
                          <span className="badge badge-sm bg-indigo-50 text-indigo-800 border-indigo-200 font-bold gap-1">
                            <TrendingUp className="w-3 h-3 text-indigo-600" />
                            <span>Pacing</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {canManagePlans && (
                        <td className="py-3 px-4 text-center">
                          {hasPlan && row.plan ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(row.plan!)}
                              className="btn btn-xs btn-ghost text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`set-plan-${row.product.id}`}
                              onClick={() => handleOpenCreateModalForProduct(row.product.id)}
                              className="btn btn-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold border-indigo-200 gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Set Plan</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 9. TAB CONTENT: MONTHLY VIEW                                  */}
      {/* ============================================================= */}
      {activeTab === "monthly" && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Product Catalog</th>
                  <th className="py-3 px-4">Plant</th>
                  <th className="py-3 px-4 text-right">Monthly Target</th>
                  <th className="py-3 px-4 text-right">Month-to-Date Output</th>
                  <th className="py-3 px-4 text-right">Remaining Balance</th>
                  <th className="py-3 px-4">Monthly Fulfillment</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {canManagePlans && <th className="py-3 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productScheduleRows.map((row) => {
                  const hasPlan = Boolean(row.plan);

                  return (
                    <tr key={row.product.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {row.product.name}
                          </span>
                          {row.product.sku && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {row.product.sku}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs font-semibold text-slate-600">
                        {row.plantName}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 text-xs tabular-nums">
                        {hasPlan && row.monthlyTarget !== null ? (
                          `${row.monthlyTarget.toLocaleString()} pcs`
                        ) : (
                          <span className="text-slate-400 font-sans italic text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-xs tabular-nums">
                        {row.monthlyActual.toLocaleString()} pcs
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-600 text-xs tabular-nums">
                        {hasPlan && row.monthlyLeft !== null ? (
                          `${row.monthlyLeft.toLocaleString()} pcs`
                        ) : (
                          <span className="text-slate-400 font-sans italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3 px-4">
                        {hasPlan ? (
                          <div className="w-28">
                            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-600 mb-0.5">
                              <span>{row.monthlyPct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-1.5 rounded-full"
                                style={{ width: `${row.monthlyPct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-sans italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {!hasPlan ? (
                          <span className="badge badge-sm bg-amber-100 text-amber-900 border-amber-300 font-bold gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>No Plan</span>
                          </span>
                        ) : row.monthlyPct >= 100 ? (
                          <span className="badge badge-sm bg-emerald-100 text-emerald-900 border-emerald-300 font-bold gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="badge badge-sm bg-indigo-50 text-indigo-800 border-indigo-200 font-bold gap-1">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            <span>On Track</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {canManagePlans && (
                        <td className="py-3 px-4 text-center">
                          {hasPlan && row.plan ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(row.plan!)}
                              className="btn btn-xs btn-ghost text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`set-plan-${row.product.id}`}
                              onClick={() => handleOpenCreateModalForProduct(row.product.id)}
                              className="btn btn-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold border-indigo-200 gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Set Plan</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 10. TAB CONTENT: MASTER SCHEDULE (DETAILED ALL PLANS)          */}
      {/* ============================================================= */}
      {activeTab === "master" && (
        <div className="space-y-6">
          {filteredPlans.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-3xl p-6">
              <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Production Plans Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {searchQuery
                  ? `No plans matching "${searchQuery}". Try adjusting your search query or plant filter.`
                  : canManagePlans
                  ? "No production plans scheduled yet. Click 'New Production Plan' or 'Batch Add Plans' to schedule."
                  : "No production plans scheduled for this plant yet."}
              </p>
              {canManagePlans && !searchQuery && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  {unplannedProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={handleOpenBatchModal}
                      className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold border-none shadow-xs"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      Batch Add Plans ({unplannedProducts.length})
                    </button>
                  )}
                  <button
                    onClick={handleOpenCreateModal}
                    className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold border-none shadow-xs"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create First Production Plan
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Plant & Line</th>
                      <th className="py-3 px-4">Product Catalog</th>
                      <th className="py-3 px-4">Period Dates ({calendarSystem === "ethiopian" ? "የኢትዮጵያ" : "Gregorian"})</th>
                      <th className="py-3 px-4 text-right">Baseline Plan</th>
                      <th className="py-3 px-4 text-right">Edited Target</th>
                      <th className="py-3 px-4 text-right">Produced / Balance</th>
                      {canManagePlans && <th className="py-3 px-4 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {planPagination.paginatedItems.map((plan) => {
                      const isModified = plan.initialPlannedQty !== plan.plannedQty;
                      const percentDone =
                        plan.plannedQty > 0
                          ? Math.min(100, Math.round((plan.totalProduced / plan.plannedQty) * 100))
                          : 0;

                      return (
                        <tr key={plan.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Plant & Line */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-extrabold text-slate-900 text-xs block">
                                  {plan.factoryName}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                  <GitBranch className="w-3 h-3 text-slate-400" />
                                  {plan.lineName}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Product */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">
                                {plan.productName}
                              </span>
                              {plan.productSku && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {plan.productSku}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Period Dates formatted by Sys Admin Calendar Selection */}
                          <td className="py-3 px-4">
                            <div className="text-xs font-mono font-bold text-slate-900 flex items-center gap-1">
                              <span>{formatPlanDate(plan.startDate)}</span>
                              <span className="text-slate-400 font-sans">→</span>
                              <span>{formatPlanDate(plan.endDate)}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              {formatPlanDateSecondary(plan.startDate)} – {formatPlanDateSecondary(plan.endDate)}
                            </span>
                          </td>

                          {/* Baseline Initial Plan */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 text-xs tabular-nums">
                            {plan.initialPlannedQty.toLocaleString()}
                            <span className="text-[10px] text-slate-400 block font-sans font-normal">
                              Initial Set
                            </span>
                          </td>

                          {/* Edited Target */}
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-xs tabular-nums">
                            <div className="flex items-center justify-end gap-1">
                              <span>{plan.plannedQty.toLocaleString()}</span>
                              {isModified && (
                                <span
                                  className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                                    plan.plannedQty > plan.initialPlannedQty
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {plan.plannedQty > plan.initialPlannedQty ? "+" : ""}
                                  {plan.plannedQty - plan.initialPlannedQty}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-sans font-normal">
                              {isModified ? "Revised by OM" : "Current Plan"}
                            </span>
                          </td>

                          {/* Produced / Balance */}
                          <td className="py-3 px-4 text-right">
                            <div className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                              {plan.totalProduced.toLocaleString()} pcs
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Left: {plan.leftFromWeeklyPlanned.toLocaleString()} ({percentDone}%)
                            </div>
                            <div className="w-20 ml-auto bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-1 rounded-full"
                                style={{ width: `${percentDone}%` }}
                              />
                            </div>
                          </td>

                          {/* Actions */}
                          {canManagePlans && (
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(plan)}
                                className="btn btn-xs btn-ghost text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold gap-1"
                                title="Edit Production Plan"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Pagination
                  {...planPagination}
                  itemLabel="plans"
                  className="border-t border-slate-100 px-4"
                />
              </div>
            </div>
          )}

          {/* Unplanned Products Section in Master Tab */}
          {unplannedProducts.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-3xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      Unplanned Products ({unplannedProducts.length}) / እቅድ ያልተዘጋጀላቸው ምርቶች
                    </h3>
                    <p className="text-xs text-slate-500">
                      These products belong to this facility but do not yet have a master production schedule.
                    </p>
                  </div>
                </div>

                {canManagePlans && (
                  <button
                    type="button"
                    onClick={handleOpenBatchModal}
                    className="btn btn-xs sm:btn-sm bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl gap-1 border-none shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Batch Add All</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unplannedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">
                        {p.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.sku && (
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            {p.sku}
                          </span>
                        )}
                        <span className="badge badge-2xs bg-amber-100 text-amber-800 border-none font-bold">
                          No Plan
                        </span>
                      </div>
                    </div>

                    {canManagePlans && (
                      <button
                        type="button"
                        data-testid={`set-plan-${p.id}`}
                        onClick={() => handleOpenCreateModalForProduct(p.id)}
                        className="btn btn-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold border-indigo-200 shrink-0 gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Set Plan</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* 11. BATCH CREATE PRODUCTION PLANS MODAL (OM ONLY)             */}
      {/* ============================================================= */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <span>Batch Add Production Plans</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Initialize baseline production plans for all {unplannedProducts.length} unplanned products at once.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {batchError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-semibold">
                {batchError}
              </div>
            )}

            <form onSubmit={handleSaveBatchPlans} className="space-y-4">
              {/* Plant selection (if multi-plant) */}
              {factories.length > 1 && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Operating Plant
                  </label>
                  <select
                    value={batchFactoryId}
                    onChange={(e) => setBatchFactoryId(e.target.value)}
                    className="select select-sm select-bordered w-full rounded-xl text-xs font-bold"
                  >
                    {factories.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Products preview */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Target Products ({unplannedProducts.length})
                </label>
                <div className="max-h-28 overflow-y-auto bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-1">
                  {unplannedProducts.map((p) => (
                    <div key={p.id} className="text-xs font-medium text-slate-700 flex items-center justify-between">
                      <span>{p.name}</span>
                      <span className="font-mono text-[10px] text-slate-500">{p.sku}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date pickers */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <PlanDatePicker
                  label="Plan Start Date"
                  value={batchStartDate}
                  onChange={setBatchStartDate}
                  calendarSystem={calendarSystem}
                />

                <PlanDatePicker
                  label="Plan End Date"
                  value={batchEndDate}
                  onChange={setBatchEndDate}
                  calendarSystem={calendarSystem}
                  minDate={batchStartDate}
                />
              </div>

              {/* Default Planned Quantity */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Default Target Quantity Per Product (pcs)
                </label>
                <input
                  aria-label="Default Target Quantity Per Product (pcs)"
                  type="number"
                  min="1"
                  step="1"
                  value={batchDefaultQty || ""}
                  onChange={(e) => setBatchDefaultQty(parseInt(e.target.value, 10) || 0)}
                  className="input input-sm input-bordered w-full rounded-xl text-xs font-mono font-bold"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Each product will receive an initial baseline target of {batchDefaultQty.toLocaleString()} pcs, which the OM can adjust anytime.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchSaving}
                  className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold border-none"
                >
                  {batchSaving ? "Initializing Plans..." : `Add Plans For All (${unplannedProducts.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 12. CREATE PRODUCTION PLAN MODAL (OM ONLY)                    */}
      {/* ============================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Create Production Plan
                </h3>
                <span className="text-xs text-slate-500">
                  Set target quantity for a line & product within a scheduled period
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-semibold">
                {createError}
              </div>
            )}

            <form onSubmit={handleSaveCreatePlan} className="space-y-4">
              {/* Plant selection (if multi-plant) */}
              {factories.length > 1 && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Operating Plant
                  </label>
                  <select
                    value={createFactoryId}
                    onChange={(e) => {
                      setCreateFactoryId(e.target.value);
                      const available = lines.filter((l) => l.factoryId === e.target.value);
                      setCreateLineId(available[0]?.id || "");
                    }}
                    className="select select-sm select-bordered w-full rounded-xl text-xs font-bold"
                  >
                    {factories.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Line selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Production Line
                </label>
                <select
                  aria-label="Production Line"
                  value={createLineId}
                  onChange={(e) => {
                    const newLineId = e.target.value;
                    setCreateLineId(newLineId);
                    const linkedIds = lineProducts
                      .filter((lp) => lp.lineId === newLineId)
                      .map((lp) => lp.productId);
                    const candidateProds = linkedIds.length > 0
                      ? products.filter((p) => linkedIds.includes(p.id))
                      : products;
                    const availableProd = candidateProds.find((p) => !plannedProductIds.has(p.id));
                    setCreateProductId(availableProd?.id || "");
                  }}
                  className="select select-sm select-bordered w-full rounded-xl text-xs font-bold"
                >
                  <option value="">Select Production Line</option>
                  {createAvailableLines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Product
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    (1 plan per product)
                  </span>
                </div>
                <select
                  aria-label="Product"
                  value={createProductId}
                  onChange={(e) => setCreateProductId(e.target.value)}
                  className="select select-sm select-bordered w-full rounded-xl text-xs font-bold"
                >
                  <option value="">Select Product</option>
                  {createAvailableProducts.map((p) => {
                    const hasPlan = plannedProductIds.has(p.id);
                    return (
                      <option key={p.id} value={p.id} disabled={hasPlan}>
                        {p.name} {p.sku ? `(${p.sku})` : ""}{hasPlan ? " — [Plan Already Exists]" : ""}
                      </option>
                    );
                  })}
                </select>
                {createProductId && plannedProductIds.has(createProductId) && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    A plan already exists for this product. Only one plan per product is allowed.
                  </p>
                )}
              </div>

              {/* Date pickers respecting Sys Admin calendarSystem */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <PlanDatePicker
                  label="Plan Start Date"
                  value={createStartDate}
                  onChange={setCreateStartDate}
                  calendarSystem={calendarSystem}
                />

                <PlanDatePicker
                  label="Plan End Date"
                  value={createEndDate}
                  onChange={setCreateEndDate}
                  calendarSystem={calendarSystem}
                  minDate={createStartDate}
                />
              </div>

              {/* Planned Quantity */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Target Planned Quantity (pcs)
                </label>
                <input
                  aria-label="Target Planned Quantity (pcs)"
                  type="number"
                  min="1"
                  step="1"
                  value={createQty || ""}
                  onChange={(e) => setCreateQty(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 25000"
                  className="input input-sm input-bordered w-full rounded-xl text-xs font-mono font-bold"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold border-none"
                >
                  {createSaving ? "Saving Plan..." : "Save Production Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 13. EDIT PRODUCTION PLAN MODAL (OM ONLY)                      */}
      {/* ============================================================= */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Edit Production Plan
                </h3>
                <span className="text-xs text-slate-500">
                  Adjust target quantity or schedule dates. Baseline initial plan will be preserved.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-semibold">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditPlan} className="space-y-4">
              {/* Line selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Production Line
                </label>
                <select
                  aria-label="Production Line"
                  value={editLineId}
                  onChange={(e) => setEditLineId(e.target.value)}
                  className="select select-sm select-bordered w-full rounded-xl text-xs font-bold"
                >
                  {editAvailableLines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Product
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    (1 plan per product)
                  </span>
                </div>
                <select
                  aria-label="Product"
                  value={editProductId}
                  onChange={(e) => setEditProductId(e.target.value)}
                  className="select select-sm select-bordered w-full rounded-xl text-xs font-bold"
                >
                  {editAvailableProducts.map((p) => {
                    const hasOtherPlan = plannedProductIds.has(p.id) && p.id !== editPlanRecord?.productId;
                    return (
                      <option key={p.id} value={p.id} disabled={hasOtherPlan}>
                        {p.name} {p.sku ? `(${p.sku})` : ""}{hasOtherPlan ? " — [Plan Already Exists]" : ""}
                      </option>
                    );
                  })}
                </select>
                {editProductId && plannedProductIds.has(editProductId) && editProductId !== editPlanRecord?.productId && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    Another plan already exists for this product. Only one plan per product is allowed.
                  </p>
                )}
              </div>

              {/* Date pickers */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <PlanDatePicker
                  label="Plan Start Date"
                  value={editStartDate}
                  onChange={setEditStartDate}
                  calendarSystem={calendarSystem}
                />

                <PlanDatePicker
                  label="Plan End Date"
                  value={editEndDate}
                  onChange={setEditEndDate}
                  calendarSystem={calendarSystem}
                  minDate={editStartDate}
                />
              </div>

              {/* Planned Quantity with Baseline Comparison */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Revised Target Planned Quantity (pcs)
                </label>
                <input
                  aria-label="Revised Target Planned Quantity (pcs)"
                  type="number"
                  min="1"
                  step="1"
                  value={editQty || ""}
                  onChange={(e) => setEditQty(parseInt(e.target.value, 10) || 0)}
                  className="input input-sm input-bordered w-full rounded-xl text-xs font-mono font-bold"
                />
                {editPlanRecord && (
                  <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                    Initial Baseline Target: {editPlanRecord.initialPlannedQty.toLocaleString()} pcs
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold border-none"
                >
                  {editSaving ? "Updating Plan..." : "Update Production Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
