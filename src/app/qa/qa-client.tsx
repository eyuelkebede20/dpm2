"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQAInspectionAction } from "@/actions/qa-actions";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  Boxes,
  Percent,
} from "lucide-react";

interface QAClientProps {
  assignedProducts: Array<{
    id: string;
    name: string;
    sku: string;
    factoryId: string;
  }>;
  availableLines: Array<{
    id: string;
    name: string;
    factoryId: string;
  }>;
  inspections: Array<{
    id: string;
    date: string;
    checked: number;
    defects: number;
    note: string | null;
    createdAt: Date;
    productName: string;
    productSku: string;
    lineName: string;
  }>;
}

export function QAClient({
  assignedProducts,
  availableLines,
  inspections,
}: QAClientProps) {
  const router = useRouter();

  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [selectedProductId, setSelectedProductId] = useState(
    assignedProducts[0]?.id || ""
  );
  const [selectedLineId, setSelectedLineId] = useState(
    availableLines[0]?.id || ""
  );
  const [checkedQty, setCheckedQty] = useState<number>(100);
  const [defectsQty, setDefectsQty] = useState<number>(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Summary statistics calculation
  const totalChecked = inspections.reduce((acc, curr) => acc + curr.checked, 0);
  const totalDefects = inspections.reduce((acc, curr) => acc + curr.defects, 0);
  const passedUnits = Math.max(0, totalChecked - totalDefects);
  const overallDefectRate =
    totalChecked > 0
      ? Math.round((totalDefects / totalChecked) * 1000) / 10
      : 0;

  // Live calculation of defect rate for the current form
  const defectRate =
    checkedQty > 0
      ? Math.round((defectsQty / checkedQty) * 1000) / 10
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (checkedQty <= 0) {
      setError("Quantity checked must be at least 1");
      return;
    }

    if (defectsQty < 0 || defectsQty > checkedQty) {
      setError("Defects found cannot exceed total quantity checked");
      return;
    }

    setSaving(true);

    const res = await createQAInspectionAction({
      date,
      productId: selectedProductId,
      lineId: selectedLineId,
      checked: Number(checkedQty),
      defects: Number(defectsQty),
      note: note.trim() || undefined,
    });

    setSaving(false);

    if (res.success) {
      setSuccessMsg("Inspection logged successfully!");
      setDefectsQty(0);
      setNote("");
      setTimeout(() => setSuccessMsg(null), 3000);
      router.refresh();
    } else {
      setError(res.error || "Failed to log inspection");
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Summary Statistics Cards (Total Checked, Defect Rate, Passed Units) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Checked */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Total Checked
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-mono tabular-nums">
              {totalChecked.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              {inspections.length} {inspections.length === 1 ? "audit batch" : "audit batches"} recorded
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Defect Rate */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Defect Rate
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
                {overallDefectRate.toFixed(1)}%
              </span>
              <span
                className={`badge badge-sm font-bold ${
                  overallDefectRate === 0
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : overallDefectRate <= 2.5
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-rose-100 text-rose-800 border-rose-200"
                }`}
              >
                {overallDefectRate === 0
                  ? "Pristine"
                  : overallDefectRate <= 2.5
                  ? "Within Spec"
                  : "Action Req"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 font-medium font-mono tabular-nums">
              {totalDefects.toLocaleString()} defective units found
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        {/* Passed Units */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Passed Units
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 font-mono tabular-nums">
              {passedUnits.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              {totalChecked > 0
                ? `${Math.round((passedUnits / totalChecked) * 1000) / 10}% pass rate`
                : "100% pass rate"}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Assigned Products Scope Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Assigned Product Scope
            </h2>
            <p className="text-xs text-slate-500">
              Authorized product specifications for your QA workstation
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {assignedProducts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              No products assigned yet. Please contact your Operations Manager.
            </p>
          ) : (
            assignedProducts.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100/80 text-slate-800 text-xs font-semibold border border-slate-200/60"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{p.name}</span>
                <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {p.sku}
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Inspection Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs h-fit">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Log Quality Inspection
              </h2>
              <p className="text-xs text-slate-500">
                Record batch sampling and defect counts
              </p>
            </div>
          </div>

          {error && (
            <div className="alert alert-error text-xs py-2.5 px-3 rounded-xl mt-4 bg-red-50 text-red-700 border border-red-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="alert alert-success text-xs py-2.5 px-3 rounded-xl mt-4 bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Inspection Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input input-bordered w-full text-sm rounded-xl focus:border-indigo-600 touch-target min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Product
              </label>
              <select
                className="select select-bordered w-full text-sm rounded-xl focus:border-indigo-600 touch-target min-h-[44px]"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
              >
                {assignedProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Production Line
              </label>
              <select
                className="select select-bordered w-full text-sm rounded-xl focus:border-indigo-600 touch-target min-h-[44px]"
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                required
              >
                {availableLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Pass / Fail Status Mode Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Inspection Status Toggle
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDefectsQty(0)}
                  className={`touch-target min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-xs sm:text-sm transition-all ${
                    defectsQty === 0
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-100 ring-2 ring-emerald-500/20"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-inherit" />
                  <span>Pass (Spec OK)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (defectsQty === 0) setDefectsQty(1);
                  }}
                  className={`touch-target min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-xs sm:text-sm transition-all ${
                    defectsQty > 0
                      ? "bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-100 ring-2 ring-amber-500/20"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-inherit" />
                  <span>Defects Found</span>
                </button>
              </div>
            </div>

            {/* Quantities & Defect Pill Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Checked Qty
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={checkedQty}
                  onChange={(e) => setCheckedQty(Number(e.target.value))}
                  className="input input-bordered w-full text-sm rounded-xl focus:border-indigo-600 font-mono touch-target min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Defects Found
                </label>
                <input
                  type="number"
                  min="0"
                  max={checkedQty}
                  required
                  value={defectsQty}
                  onChange={(e) => setDefectsQty(Number(e.target.value))}
                  className="input input-bordered w-full text-sm rounded-xl focus:border-indigo-600 font-mono tabular-nums touch-target min-h-[44px]"
                />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setDefectsQty(0)}
                    className="touch-target min-h-[44px] min-w-[44px] text-xs font-bold px-2 py-2 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 border border-slate-200 active:scale-95 transition-all flex items-center justify-center"
                  >
                    0 defects
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefectsQty((d) => Math.min(checkedQty, d + 1))}
                    className="touch-target min-h-[44px] min-w-[44px] text-xs sm:text-sm font-bold px-2 py-2 rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 border border-slate-200 active:scale-95 transition-all flex items-center justify-center font-mono"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefectsQty((d) => Math.min(checkedQty, d + 5))}
                    className="touch-target min-h-[44px] min-w-[44px] text-xs sm:text-sm font-bold px-2 py-2 rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 border border-slate-200 active:scale-95 transition-all flex items-center justify-center font-mono"
                  >
                    +5
                  </button>
                </div>
              </div>
            </div>

            {/* Live Defect Rate Pill */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-slate-400" />
                Batch Defect Rate
              </span>
              <span
                className={`font-mono text-sm font-bold px-3 py-1 rounded-lg border tabular-nums ${
                  defectRate === 0
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : defectRate <= 2.5
                    ? "bg-amber-100 text-amber-950 border-amber-300"
                    : "bg-rose-100 text-rose-950 border-rose-300"
                }`}
              >
                {defectRate}%
              </span>
            </div>

            {/* Observations & Notes with Ethiopic / Amharic line-height prevention */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Observations & Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Cap misalignment on bottle neck #4 / የክዳን መላላት..."
                className="textarea textarea-bordered w-full text-sm rounded-xl focus:border-indigo-600 leading-relaxed font-sans"
              />
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Generous line-spacing prevents clipping of Ethiopic / Amharic defect notes
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || assignedProducts.length === 0}
              className="btn btn-primary w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none text-white font-bold shadow-md shadow-indigo-100 mt-2 gap-2 touch-target min-h-[48px]"
            >
              {saving ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Inspection Report
                </>
              )}
            </button>
          </form>
        </div>

        {/* Inspection History Log */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Inspection History Log
                </h2>
                <p className="text-xs text-slate-500">
                  Past quality audit records
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono">Showing last 50</span>
          </div>

          <div className="mt-4 flex-1 overflow-x-auto">
            {inspections.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No inspections recorded yet.
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs font-extrabold uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                    <th>Date</th>
                    <th>Product / Line</th>
                    <th>Samples Checked</th>
                    <th>Defects</th>
                    <th className="text-right">Defect %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspections.map((item) => {
                    const rate =
                      item.checked > 0
                        ? Math.round((item.defects / item.checked) * 1000) / 10
                        : 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td>
                          <div className="font-semibold text-slate-900 font-mono text-xs">
                            {item.date}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td>
                          <div className="font-semibold text-slate-900">
                            {item.productName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.lineName} • <span className="font-mono text-slate-600">{item.productSku}</span>
                          </div>
                          {item.note && (
                            <div className="mt-1.5 text-xs text-slate-700 bg-amber-50/80 border border-amber-200/70 rounded-lg px-2.5 py-1.5 leading-relaxed font-normal break-words">
                              <span className="text-amber-800 font-semibold mr-1">Note:</span>
                              &ldquo;{item.note}&rdquo;
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="font-mono text-slate-700 font-semibold tabular-nums">
                            {item.checked.toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              item.defects > 0 ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            {item.defects}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border tabular-nums ${
                              rate === 0
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : rate <= 2.5
                                ? "bg-amber-100 text-amber-950 border-amber-300"
                                : "bg-rose-100 text-rose-950 border-rose-300"
                            }`}
                          >
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
