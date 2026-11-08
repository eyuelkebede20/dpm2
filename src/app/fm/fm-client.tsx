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
} from "lucide-react";

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
  plans: Array<{
    id: string;
    lineId: string;
    lineName: string;
    productId: string;
    productName: string;
    productSku: string;
    startDate: string;
    endDate: string;
    plannedQty: number;
    createdAt: Date;
  }>;
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

  // Live estimated daily target calculation
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
      {/* Factory Header Badge */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Plant Configuration
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">
            {factoryName}
          </h2>
        </div>
        <div className="flex gap-2">
          <span className="badge badge-lg bg-slate-100 text-slate-700 border-none font-medium text-xs">
            {lines.length} Lines
          </span>
          <span className="badge badge-lg bg-slate-100 text-slate-700 border-none font-medium text-xs">
            {products.length} Products
          </span>
          <span className="badge badge-lg bg-indigo-50 text-indigo-700 border-none font-medium text-xs">
            {plans.length} Active Plans
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("plans")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "plans"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Production Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("lines")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "lines"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GitBranch className="w-4 h-4" />
          Lines ({lines.length})
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "products"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Boxes className="w-4 h-4" />
          Products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab("links")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "links"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Link2 className="w-4 h-4" />
          Line ↔ Product Links
        </button>
      </div>

      {/* TAB 1: Plans */}
      {activeTab === "plans" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Monthly & Periodic Production Plans
              </h2>
              <p className="text-xs text-slate-500">
                Daily target = Planned Quantity ÷ Working Days in the period (excluding non-working days)
              </p>
            </div>
            <button
              onClick={() => setPlanModalOpen(true)}
              className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Production Plan
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {plans.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No production plans registered. Click &quot;New Production Plan&quot; to schedule output.
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th>Line / Product</th>
                    <th>Period (Start → End)</th>
                    <th>Planned Quantity</th>
                    <th>Target Calculation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plans.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td>
                        <div className="font-semibold text-slate-900">{p.productName}</div>
                        <div className="text-xs text-slate-500">
                          {p.lineName} • <span className="font-mono">{p.productSku}</span>
                        </div>
                      </td>
                      <td>
                        <div className="text-slate-800 font-medium font-mono text-xs">
                          {p.startDate} → {p.endDate}
                        </div>
                      </td>
                      <td>
                        <div className="font-bold text-slate-900 text-base">
                          {p.plannedQty.toLocaleString()}{" "}
                          <span className="text-xs font-normal text-slate-500">pcs</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-sm badge-info text-white font-medium">
                          Active Target Schedule
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Lines */}
      {activeTab === "lines" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Production Lines
              </h2>
              <p className="text-xs text-slate-500">
                Physical conveyor lines and machinery units in this factory
              </p>
            </div>
            <button
              onClick={() => setLineModalOpen(true)}
              className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Line
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th>Line Name</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50">
                    <td className="font-semibold text-slate-900">{l.name}</td>
                    <td>
                      {l.active ? (
                        <span className="badge badge-sm badge-success text-white">Active</span>
                      ) : (
                        <span className="badge badge-sm badge-ghost text-slate-400">Inactive</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={async () => {
                          await toggleLineActiveAction(l.id, !l.active);
                          router.refresh();
                        }}
                        className={`btn btn-xs rounded-lg ${
                          l.active
                            ? "btn-ghost text-red-600 hover:bg-red-50"
                            : "btn-ghost text-emerald-600 hover:bg-emerald-50"
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Product Catalog
              </h2>
              <p className="text-xs text-slate-500">
                Products manufactured and bottled in this plant
              </p>
            </div>
            <button
              onClick={() => setProdModalOpen(true)}
              className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th>Product Name</th>
                  <th>SKU Code</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="font-semibold text-slate-900">{p.name}</td>
                    <td>
                      <span className="badge badge-sm font-mono bg-slate-100 text-slate-700 border-none">
                        {p.sku}
                      </span>
                    </td>
                    <td>
                      {p.active ? (
                        <span className="badge badge-sm badge-success text-white">Active</span>
                      ) : (
                        <span className="badge badge-sm badge-ghost text-slate-400">Inactive</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={async () => {
                          await toggleProductActiveAction(p.id, !p.active);
                          router.refresh();
                        }}
                        className={`btn btn-xs rounded-lg ${
                          p.active
                            ? "btn-ghost text-red-600 hover:bg-red-50"
                            : "btn-ghost text-emerald-600 hover:bg-emerald-50"
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="pb-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">
              Link Products to Lines
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Check the boxes to associate which products can be run on each production line.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            {lines.length === 0 || products.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Ensure lines and products are created first.
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">
                      Production Line
                    </th>
                    {products.map((p) => (
                      <th
                        key={p.id}
                        className="py-3 px-4 text-center font-bold text-slate-700 text-xs uppercase tracking-wider"
                      >
                        <div>{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {p.sku}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {l.name}
                      </td>
                      {products.map((p) => {
                        const linked = isLineProductLinked(l.id, p.id);
                        return (
                          <td key={p.id} className="py-3 px-4 text-center">
                            <label className="inline-flex items-center justify-center p-2 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Create Production Plan
              </h3>
              <button
                onClick={() => setPlanModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400"
              >
                ✕
              </button>
            </div>

            {planError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl mt-4 bg-red-50 text-red-700 border border-red-200">
                <span>{planError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Line
                  </label>
                  <select
                    className="select select-bordered w-full text-sm rounded-xl"
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
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Product
                  </label>
                  <select
                    className="select select-bordered w-full text-sm rounded-xl"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input input-bordered w-full text-sm rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input input-bordered w-full text-sm rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Total Planned Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={plannedQty}
                  onChange={(e) => setPlannedQty(Number(e.target.value))}
                  placeholder="e.g. 25000"
                  className="input input-bordered w-full text-sm rounded-xl font-mono tabular-nums"
                />
              </div>

              {/* Live Target Preview */}
              {estimatedTarget && (
                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 text-xs text-indigo-950">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Calculated Daily Target:</span>
                    <span className="font-mono font-black text-indigo-700 text-sm tabular-nums">
                      ~{estimatedTarget.target.toLocaleString()} pcs / day
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-500" />
                    <span>Based on <b>{estimatedTarget.workDays} working days</b> in selected period (excluding Sundays)</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSaving}
                  className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                >
                  {planSaving ? "Creating..." : "Save Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Line */}
      {lineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Production Line</h3>
              <button onClick={() => setLineModalOpen(false)} className="btn btn-sm btn-circle btn-ghost text-slate-400">✕</button>
            </div>
            {lineError && <div className="alert alert-error text-xs py-2 px-3 rounded-xl mt-4 bg-red-50 text-red-700">{lineError}</div>}
            <form onSubmit={handleCreateLine} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Line Name</label>
                <input
                  type="text"
                  required
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  placeholder="e.g. Line 3 - Aseptic Bottling"
                  className="input input-bordered w-full text-sm rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setLineModalOpen(false)} className="btn btn-sm btn-ghost rounded-xl">Cancel</button>
                <button type="submit" disabled={lineSaving} className="btn btn-sm btn-primary rounded-xl bg-indigo-600 text-white border-none">
                  {lineSaving ? "Adding..." : "Add Line"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Product */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Product</h3>
              <button onClick={() => setProdModalOpen(false)} className="btn btn-sm btn-circle btn-ghost text-slate-400">✕</button>
            </div>
            {prodError && <div className="alert alert-error text-xs py-2 px-3 rounded-xl mt-4 bg-red-50 text-red-700">{prodError}</div>}
            <form onSubmit={handleCreateProduct} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Sparkling Water 1L"
                  className="input input-bordered w-full text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">SKU</label>
                <input
                  type="text"
                  required
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                  placeholder="e.g. WAT-1000"
                  className="input input-bordered w-full text-sm rounded-xl font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setProdModalOpen(false)} className="btn btn-sm btn-ghost rounded-xl">Cancel</button>
                <button type="submit" disabled={prodSaving} className="btn btn-sm btn-primary rounded-xl bg-indigo-600 text-white border-none">
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
