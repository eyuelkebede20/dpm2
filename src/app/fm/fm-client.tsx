"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createLineAction,
  toggleLineActiveAction,
  createProductAction,
  toggleProductActiveAction,
  toggleLineProductAction,
  createPlanAction,
  updatePlanAction,
} from "@/actions/fm-actions";
import {
  GitBranch,
  Boxes,
  CalendarDays,
  Link2,
  Plus,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  Pencil,
  Filter,
  CheckCircle2,
  XCircle,
  Calendar,
  Layers,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";

interface PlanItem {
  id: string;
  lineId: string;
  lineName: string;
  productId: string;
  productName: string;
  productSku: string;
  startDate: string;
  endDate: string;
  plannedQty: number;
  weeklyPlanned?: number;
  totalProduced?: number;
  leftFromWeeklyPlanned?: number;
  createdAt: Date;
}

interface FMClientProps {
  factoryName: string;
  lines: Array<{
    id: string;
    name: string;
    active: boolean;
    createdAt: Date;
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    active: boolean;
    createdAt: Date;
  }>;
  lineProducts: Array<{
    lineId: string;
    productId: string;
  }>;
  plans: PlanItem[];
}

export function FMClient({
  factoryName,
  lines,
  products,
  lineProducts,
  plans,
}: FMClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"lines" | "products" | "links" | "plans">("plans");

  // Search and filter states
  const [planSearch, setPlanSearch] = useState("");
  const [lineSearch, setLineSearch] = useState("");
  const [prodSearch, setProdSearch] = useState("");

  // Create Line Modal
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [lineName, setLineName] = useState("");
  const [lineSaving, setLineSaving] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);

  // Create Product Modal
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodName, setProdName] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodSaving, setProdSaving] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);

  // Create Plan Modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState(lines[0]?.id || "");
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0]
  );
  const [plannedQty, setPlannedQty] = useState(25000);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Edit Plan Modal
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [editLineId, setEditLineId] = useState("");
  const [editProductId, setEditProductId] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editPlannedQty, setEditPlannedQty] = useState(0);
  const [editPlanSaving, setEditPlanSaving] = useState(false);
  const [editPlanError, setEditPlanError] = useState<string | null>(null);

  // Live estimated daily target calculation for Create Plan
  const estimatedTarget = useMemo(() => {
    if (!startDate || !endDate || !plannedQty || plannedQty <= 0) return null;
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e < s) return null;
      let workDays = 0;
      const cur = new Date(s);
      while (cur <= e) {
        if (cur.getDay() !== 0) workDays++; // Sunday off
        cur.setDate(cur.getDate() + 1);
      }
      if (workDays === 0) return null;
      const target = plannedQty / workDays;
      return { workDays, target: Math.round(target) };
    } catch {
      return null;
    }
  }, [startDate, endDate, plannedQty]);

  // Live estimated daily target calculation for Edit Plan
  const editEstimatedTarget = useMemo(() => {
    if (!editStartDate || !editEndDate || !editPlannedQty || editPlannedQty <= 0) return null;
    try {
      const s = new Date(editStartDate);
      const e = new Date(editEndDate);
      if (e < s) return null;
      let workDays = 0;
      const cur = new Date(s);
      while (cur <= e) {
        if (cur.getDay() !== 0) workDays++;
        cur.setDate(cur.getDate() + 1);
      }
      if (workDays === 0) return null;
      const target = editPlannedQty / workDays;
      return { workDays, target: Math.round(target) };
    } catch {
      return null;
    }
  }, [editStartDate, editEndDate, editPlannedQty]);

  // Filtered lists
  const filteredPlans = useMemo(() => {
    if (!planSearch.trim()) return plans;
    const q = planSearch.toLowerCase();
    return plans.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.productSku.toLowerCase().includes(q) ||
        p.lineName.toLowerCase().includes(q)
    );
  }, [plans, planSearch]);

  const filteredLines = useMemo(() => {
    if (!lineSearch.trim()) return lines;
    const q = lineSearch.toLowerCase();
    return lines.filter((l) => l.name.toLowerCase().includes(q));
  }, [lines, lineSearch]);

  const filteredProducts = useMemo(() => {
    if (!prodSearch.trim()) return products;
    const q = prodSearch.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, prodSearch]);

  // Submit Line
  const handleCreateLine = async (e: React.FormEvent) => {
    e.preventDefault();
    setLineSaving(true);
    setLineError(null);

    const res = await createLineAction({ name: lineName.trim() });
    setLineSaving(false);
    if (res.success) {
      setLineModalOpen(false);
      setLineName("");
      router.refresh();
    } else {
      setLineError(res.error || "Failed to create line");
    }
  };

  // Submit Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdSaving(true);
    setProdError(null);

    const res = await createProductAction({
      name: prodName.trim(),
      sku: prodSku.trim(),
    });
    setProdSaving(false);
    if (res.success) {
      setProdModalOpen(false);
      setProdName("");
      setProdSku("");
      router.refresh();
    } else {
      setProdError(res.error || "Failed to create product");
    }
  };

  // Submit Plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanSaving(true);
    setPlanError(null);

    const res = await createPlanAction({
      lineId: selectedLineId,
      productId: selectedProductId,
      startDate,
      endDate,
      plannedQty: Number(plannedQty),
    });

    setPlanSaving(false);
    if (res.success) {
      setPlanModalOpen(false);
      router.refresh();
    } else {
      setPlanError(res.error || "Failed to create plan");
    }
  };

  // Open Edit Plan Modal
  const openEditPlan = (plan: PlanItem) => {
    setEditingPlan(plan);
    setEditLineId(plan.lineId);
    setEditProductId(plan.productId);
    setEditStartDate(plan.startDate);
    setEditEndDate(plan.endDate);
    setEditPlannedQty(plan.plannedQty);
    setEditPlanError(null);
  };

  // Submit Edit Plan
  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setEditPlanSaving(true);
    setEditPlanError(null);

    const res = await updatePlanAction({
      id: editingPlan.id,
      lineId: editLineId,
      productId: editProductId,
      startDate: editStartDate,
      endDate: editEndDate,
      plannedQty: Number(editPlannedQty),
    });

    setEditPlanSaving(false);
    if (res.success) {
      setEditingPlan(null);
      router.refresh();
    } else {
      setEditPlanError(res.error || "Failed to update plan");
    }
  };

  // Toggle Line Product
  const handleToggleLink = async (lineId: string, productId: string, isLinked: boolean) => {
    await toggleLineProductAction({
      lineId,
      productId,
      linked: !isLinked,
    });
    router.refresh();
  };

  const isLineProductLinked = (lineId: string, productId: string) => {
    return lineProducts.some(
      (lp) => lp.lineId === lineId && lp.productId === productId
    );
  };

  return (
    <div className="space-y-6">
      {/* Factory Header Badge & Overview Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 block">
            Plant Configuration Hub
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 leading-relaxed">
            {factoryName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Manage physical lines, SKU catalog, line-product mapping, and output schedules
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="badge badge-lg bg-slate-100 text-slate-700 border border-slate-200/70 font-semibold text-xs px-3 py-3 rounded-xl">
            <GitBranch className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span className="font-mono">{lines.length}</span> Lines
          </div>
          <div className="badge badge-lg bg-slate-100 text-slate-700 border border-slate-200/70 font-semibold text-xs px-3 py-3 rounded-xl">
            <Boxes className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span className="font-mono">{products.length}</span> Products
          </div>
          <div className="badge badge-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold text-xs px-3 py-3 rounded-xl">
            <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            <span className="font-mono">{plans.length}</span> Active Plans
          </div>
        </div>
      </div>

      {/* Responsive Navigation Tabs with minimum 44px touch targets */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          onClick={() => setActiveTab("plans")}
          className={`py-3.5 px-5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === "plans"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60"
          }`}
        >
          <CalendarDays className="w-4 h-4 flex-shrink-0" />
          <span>Production Plans ({plans.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("lines")}
          className={`py-3.5 px-5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === "lines"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60"
          }`}
        >
          <GitBranch className="w-4 h-4 flex-shrink-0" />
          <span>Lines ({lines.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`py-3.5 px-5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === "products"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60"
          }`}
        >
          <Boxes className="w-4 h-4 flex-shrink-0" />
          <span>Products ({products.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("links")}
          className={`py-3.5 px-5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === "links"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/60"
          }`}
        >
          <Link2 className="w-4 h-4 flex-shrink-0" />
          <span>Line ↔ Product Links</span>
        </button>
      </div>

      {/* TAB 1: Plans */}
      {activeTab === "plans" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-relaxed">
                Monthly & Periodic Production Plans
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                Daily target = Planned Quantity ÷ Working Days in the period (excluding non-working days)
              </p>
            </div>
            <button
              onClick={() => setPlanModalOpen(true)}
              className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-2 min-h-[44px] px-5 font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Production Plan</span>
            </button>
          </div>

          {/* Filter / Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search plans by product, SKU, or line..."
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="input input-bordered w-full pl-10 text-xs sm:text-sm rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-600 min-h-[44px]"
              />
            </div>
            <div className="text-xs text-slate-400 font-mono self-center sm:self-auto">
              Showing {filteredPlans.length} of {plans.length} plans
            </div>
          </div>

          {/* Responsive Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/70">
            {filteredPlans.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                {planSearch
                  ? "No production plans match your search query."
                  : 'No production plans registered. Click "New Production Plan" to schedule output.'}
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs font-black uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                    <th className="py-3.5 px-4">Line / Product</th>
                    <th className="py-3.5 px-4">Period (Start → End)</th>
                    <th className="py-3.5 px-4">Planned Quantity</th>
                    <th className="py-3.5 px-4">Target Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPlans.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 leading-relaxed">
                          {p.productName}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-700">{p.lineName}</span>
                          <span>•</span>
                          <span className="badge badge-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                            {p.productSku}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-bold font-mono text-xs flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{p.startDate}</span>
                          <span className="text-slate-400">→</span>
                          <span>{p.endDate}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 text-base font-mono tabular-nums">
                          {p.plannedQty.toLocaleString()}{" "}
                          <span className="text-xs font-normal text-slate-400 font-sans">pcs</span>
                        </div>
                        {p.totalProduced !== undefined && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Produced: <span className="font-bold text-emerald-600">{p.totalProduced.toLocaleString()}</span> pcs
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200/70">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Active Target Schedule
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openEditPlan(p)}
                          className="btn btn-sm btn-ghost hover:bg-indigo-50 hover:text-indigo-600 rounded-xl text-slate-600 gap-1.5 min-h-[40px] px-3 font-semibold text-xs"
                          title="Edit Plan"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Responsive Mobile Cards for Plans */}
          <div className="md:hidden space-y-3">
            {filteredPlans.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No production plans found.
              </div>
            ) : (
              filteredPlans.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 space-y-3 hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="badge badge-xs font-mono font-bold bg-white text-slate-700 border border-slate-200/80 mb-1">
                        {p.productSku}
                      </span>
                      <h3 className="font-black text-slate-900 text-base leading-relaxed">
                        {p.productName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{p.lineName}</p>
                    </div>
                    <button
                      onClick={() => openEditPlan(p)}
                      className="btn btn-xs btn-outline border-slate-300 hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-xl min-h-[36px] min-w-[36px] p-2"
                      title="Edit Plan"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Period</span>
                      <span className="font-mono font-bold text-slate-800 text-[11px] block mt-0.5">
                        {p.startDate} → {p.endDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Planned Qty</span>
                      <span className="font-mono font-black text-indigo-700 text-sm block mt-0.5">
                        {p.plannedQty.toLocaleString()}{" "}
                        <span className="text-[10px] font-normal text-slate-400 font-sans">pcs</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Lines */}
      {activeTab === "lines" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-relaxed">
                Production Lines
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                Physical conveyor lines and machinery units in this factory
              </p>
            </div>
            <button
              onClick={() => setLineModalOpen(true)}
              className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-2 min-h-[44px] px-5 font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Line</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter production lines by name..."
                value={lineSearch}
                onChange={(e) => setLineSearch(e.target.value)}
                className="input input-bordered w-full pl-10 text-xs sm:text-sm rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-600 min-h-[44px]"
              />
            </div>
            <div className="text-xs text-slate-400 font-mono self-center sm:self-auto">
              {filteredLines.length} lines listed
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70">
            <table className="table w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs font-black uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                  <th className="py-3.5 px-4">Line Name</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLines.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 leading-relaxed">
                      {l.name}
                    </td>
                    <td className="py-3.5 px-4">
                      {l.active ? (
                        <span className="badge badge-sm badge-success text-white font-bold py-2.5 px-3 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="badge badge-sm badge-ghost text-slate-400 font-bold py-2.5 px-3 rounded-full">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={async () => {
                          await toggleLineActiveAction(l.id, !l.active);
                          router.refresh();
                        }}
                        className={`btn btn-sm rounded-xl min-h-[44px] px-4 font-bold text-xs ${
                          l.active
                            ? "btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
                            : "btn-ghost text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                      >
                        {l.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Products */}
      {activeTab === "products" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-relaxed">
                Product Catalog
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                Products manufactured and bottled in this plant (supports Amharic and English catalog entries)
              </p>
            </div>
            <button
              onClick={() => setProdModalOpen(true)}
              className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-2 min-h-[44px] px-5 font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by title or SKU..."
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                className="input input-bordered w-full pl-10 text-xs sm:text-sm rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-600 min-h-[44px]"
              />
            </div>
            <div className="text-xs text-slate-400 font-mono self-center sm:self-auto">
              {filteredProducts.length} products listed
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70">
            <table className="table w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs font-black uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">SKU Code</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 leading-relaxed">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="badge badge-sm font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/80 py-2.5 px-3 rounded-xl">
                        {p.sku}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {p.active ? (
                        <span className="badge badge-sm badge-success text-white font-bold py-2.5 px-3 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="badge badge-sm badge-ghost text-slate-400 font-bold py-2.5 px-3 rounded-full">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={async () => {
                          await toggleProductActiveAction(p.id, !p.active);
                          router.refresh();
                        }}
                        className={`btn btn-sm rounded-xl min-h-[44px] px-4 font-bold text-xs ${
                          p.active
                            ? "btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700"
                            : "btn-ghost text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                      >
                        {p.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Line Products Linking */}
      {activeTab === "links" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="pb-5 border-b border-slate-100">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-relaxed">
              Link Products to Lines
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
              Check the boxes to associate which products can be run on each production line.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/70">
            {lines.length === 0 || products.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Ensure lines and products are created first.
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200">
                    <th className="py-4 px-4 font-black text-slate-700 text-xs uppercase tracking-wider min-w-[200px]">
                      Production Line
                    </th>
                    {products.map((p) => (
                      <th
                        key={p.id}
                        className="py-4 px-4 text-center font-bold text-slate-700 text-xs uppercase tracking-wider min-w-[140px]"
                      >
                        <div className="leading-relaxed font-black text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono font-bold mt-0.5">
                          {p.sku}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 font-black text-slate-900 leading-relaxed">
                        {l.name}
                      </td>
                      {products.map((p) => {
                        const linked = isLineProductLinked(l.id, p.id);
                        return (
                          <td key={p.id} className="py-4 px-4 text-center">
                            <label className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                              <input
                                type="checkbox"
                                checked={linked}
                                onChange={() => handleToggleLink(l.id, p.id, linked)}
                                className="checkbox checkbox-primary checkbox-sm rounded-md"
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal: New Plan */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl border border-slate-200/90">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-relaxed">
                  Create Production Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set target schedule for a line and product pairing
                </p>
              </div>
              <button
                onClick={() => setPlanModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px]"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {planError && (
              <div className="alert alert-error text-xs py-2.5 px-3 rounded-2xl mt-4 bg-red-50 text-red-700 border border-red-200">
                <span>{planError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Line
                  </label>
                  <select
                    className="select select-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600"
                    value={selectedLineId}
                    onChange={(e) => setSelectedLineId(e.target.value)}
                    required
                  >
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Product
                  </label>
                  <select
                    className="select select-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 leading-relaxed"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    required
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input input-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input input-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Total Planned Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={plannedQty}
                  onChange={(e) => setPlannedQty(Number(e.target.value))}
                  placeholder="e.g. 25000"
                  className="input input-bordered w-full text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 font-mono tabular-nums"
                />
              </div>

              {/* Live Target Preview */}
              {estimatedTarget && (
                <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-4 text-xs text-indigo-950">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Calculated Daily Target:</span>
                    <span className="font-mono font-black text-indigo-700 text-base tabular-nums">
                      ~{estimatedTarget.target.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-slate-500 font-sans">pcs / day</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1.5 leading-relaxed">
                    <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span>
                      Based on <b className="font-mono text-slate-900">{estimatedTarget.workDays} working days</b> in selected period (excluding Sundays)
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="btn btn-ghost rounded-2xl min-h-[44px] px-5 font-bold text-xs sm:text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSaving}
                  className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none min-h-[44px] px-6 font-bold text-xs sm:text-sm shadow-sm"
                >
                  {planSaving ? "Creating..." : "Save Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Plan */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl border border-slate-200/90">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-relaxed">
                  Edit Production Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update targets or date range for this production plan
                </p>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px]"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {editPlanError && (
              <div className="alert alert-error text-xs py-2.5 px-3 rounded-2xl mt-4 bg-red-50 text-red-700 border border-red-200">
                <span>{editPlanError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePlan} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Line
                  </label>
                  <select
                    className="select select-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600"
                    value={editLineId}
                    onChange={(e) => setEditLineId(e.target.value)}
                    required
                  >
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Product
                  </label>
                  <select
                    className="select select-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 leading-relaxed"
                    value={editProductId}
                    onChange={(e) => setEditProductId(e.target.value)}
                    required
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="input input-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="input input-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Total Planned Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editPlannedQty}
                  onChange={(e) => setEditPlannedQty(Number(e.target.value))}
                  className="input input-bordered w-full text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 font-mono tabular-nums"
                />
              </div>

              {/* Live Target Preview */}
              {editEstimatedTarget && (
                <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-4 text-xs text-indigo-950">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Calculated Daily Target:</span>
                    <span className="font-mono font-black text-indigo-700 text-base tabular-nums">
                      ~{editEstimatedTarget.target.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-slate-500 font-sans">pcs / day</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1.5 leading-relaxed">
                    <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span>
                      Based on <b className="font-mono text-slate-900">{editEstimatedTarget.workDays} working days</b> in selected period (excluding Sundays)
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="btn btn-ghost rounded-2xl min-h-[44px] px-5 font-bold text-xs sm:text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPlanSaving}
                  className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none min-h-[44px] px-6 font-bold text-xs sm:text-sm shadow-sm"
                >
                  {editPlanSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Line */}
      {lineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl border border-slate-200/90">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 leading-relaxed">Add Production Line</h3>
              <button
                onClick={() => setLineModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px]"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            {lineError && (
              <div className="alert alert-error text-xs py-2.5 px-3 rounded-2xl mt-4 bg-red-50 text-red-700 border border-red-200">
                {lineError}
              </div>
            )}
            <form onSubmit={handleCreateLine} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Line Name
                </label>
                <input
                  type="text"
                  required
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  placeholder="e.g. Line 3 - Aseptic Bottling"
                  className="input input-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 leading-relaxed"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLineModalOpen(false)}
                  className="btn btn-ghost rounded-2xl min-h-[44px] px-5 font-bold text-xs sm:text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lineSaving}
                  className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none min-h-[44px] px-6 font-bold text-xs sm:text-sm shadow-sm"
                >
                  {lineSaving ? "Adding..." : "Add Line"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Product */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl border border-slate-200/90">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 leading-relaxed">Add Product</h3>
              <button
                onClick={() => setProdModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px]"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            {prodError && (
              <div className="alert alert-error text-xs py-2.5 px-3 rounded-2xl mt-4 bg-red-50 text-red-700 border border-red-200">
                {prodError}
              </div>
            )}
            <form onSubmit={handleCreateProduct} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Sparkling Water 1L"
                  className="input input-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  SKU
                </label>
                <input
                  type="text"
                  required
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                  placeholder="e.g. WAT-1000"
                  className="input input-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProdModalOpen(false)}
                  className="btn btn-ghost rounded-2xl min-h-[44px] px-5 font-bold text-xs sm:text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={prodSaving}
                  className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none min-h-[44px] px-6 font-bold text-xs sm:text-sm shadow-sm"
                >
                  {prodSaving ? "Adding..." : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}