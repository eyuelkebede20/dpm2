"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createPlanAction,
  updatePlanAction,
  deletePlanAction,
  PlanItemWithPlant,
} from "@/actions/plan-actions";
import { PlanDatePicker } from "./plan-date-picker";
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
} from "lucide-react";
import { gregorianToEth, ethToGregorian, formatEthDate } from "@/lib/ethiopian-calendar";
import { format, parseISO } from "date-fns";

interface PlanningClientProps {
  factories: Array<{ id: string; name: string }>;
  initialFactoryId?: string;
  lines: Array<{ id: string; name: string; factoryId: string }>;
  products: Array<{ id: string; name: string; sku: string; factoryId?: string }>;
  lineProducts: Array<{ lineId: string; productId: string }>;
  plans: PlanItemWithPlant[];
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
  calendarSystem,
  userRole,
  canManagePlans,
}: PlanningClientProps) {
  const router = useRouter();

  // Filters
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>(initialFactoryId);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filtered Plans
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
    setCreateLineId(available[0]?.id || "");
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
            Schedule periodic and annual output targets across manufacturing plants, lines, and products.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {canManagePlans ? (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="btn btn-sm sm:btn-md bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold gap-2 shadow-xs border-none"
            >
              <Plus className="w-4 h-4" />
              <span>New Production Plan</span>
            </button>
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
              Production plans and targets are authorized and scheduled by the <strong>Operation Manager (OM)</strong>. You have read-only access to view planned quantities, weekly targets, and fulfillment progress for your plant&apos;s lines and products.
            </span>
          </div>
        </div>
      )}

      {/* 3. Executive KPI Summary Cards */}
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

      {/* 4. Filter & Search Controls */}
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

      {/* 5. Master Plans Table / Cards */}
      {filteredPlans.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-3xl p-6">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Production Plans Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No plans matching "${searchQuery}". Try adjusting your search query or plant filter.`
              : canManagePlans
              ? "No periodic production plans have been scheduled yet. Click 'New Production Plan' to set line targets."
              : "No production plans scheduled for this plant yet."}
          </p>
          {canManagePlans && !searchQuery && (
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold mt-4 border-none shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create First Production Plan
            </button>
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
                {filteredPlans.map((plan) => {
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
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 6. CREATE PRODUCTION PLAN MODAL (OM ONLY)                     */}
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
                  onChange={(e) => setCreateLineId(e.target.value)}
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
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Product
                </label>
                <select
                  aria-label="Product"
                  value={createProductId}
                  onChange={(e) => setCreateProductId(e.target.value)}
                  className="select select-sm select-bordered w-full rounded-xl text-xs font-bold"
                >
                  <option value="">Select Product</option>
                  {createAvailableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </option>
                  ))}
                </select>
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
      {/* 7. EDIT PRODUCTION PLAN MODAL (OM ONLY)                       */}
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
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Product
                </label>
                <select
                  aria-label="Product"
                  value={editProductId}
                  onChange={(e) => setEditProductId(e.target.value)}
                  className="select select-sm select-bordered w-full rounded-xl text-xs font-bold"
                >
                  {editAvailableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </option>
                  ))}
                </select>
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
