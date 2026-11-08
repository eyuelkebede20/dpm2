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
  Plus,
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

  // Live calculation of defect rate
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
    <div className="space-y-8">
      {/* Assigned Products Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="p-2.5 bg-accent/10 text-accent rounded-xl">
            <Boxes className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Assigned Product Scope
            </h2>
            <p className="text-xs text-slate-500">
              You are officially authorized to perform quality audits for these products
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {assignedProducts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              No products assigned yet. Please contact your Operation Manager.
            </p>
          ) : (
            assignedProducts.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-medium"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{p.name}</span>
                <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded">
                  {p.sku}
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Inspection Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit">
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
            <div className="alert alert-error text-xs py-2 px-3 rounded-xl mt-4 bg-red-50 text-red-700 border border-red-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="alert alert-success text-xs py-2 px-3 rounded-xl mt-4 bg-emerald-50 text-emerald-800 border border-emerald-200">
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
                className="input input-bordered w-full text-sm rounded-xl focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Product
              </label>
              <select
                className="select select-bordered w-full text-sm rounded-xl focus:border-indigo-600"
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
                className="select select-bordered w-full text-sm rounded-xl focus:border-indigo-600"
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

            <div className="grid grid-cols-2 gap-3">
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
                  className="input input-bordered w-full text-sm rounded-xl focus:border-indigo-600 font-mono"
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
                  className="input input-bordered w-full text-sm rounded-xl focus:border-indigo-600 font-mono tabular-nums"
                />
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDefectsQty(0)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600"
                  >
                    0 defects
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefectsQty((d) => Math.min(checkedQty, d + 1))}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefectsQty((d) => Math.min(checkedQty, d + 5))}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700"
                  >
                    +5
                  </button>
                </div>
              </div>
            </div>

            {/* Live Defect Rate Pill */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-slate-400" />
                Defect Rate
              </span>
              <span
                className={`font-mono text-sm font-bold px-2 py-0.5 rounded-lg ${
                  defectRate === 0
                    ? "bg-emerald-100 text-emerald-800"
                    : defectRate <= 2.5
                    ? "bg-amber-100 text-amber-900"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {defectRate}%
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Observations & Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Cap misalignment on bottle neck #4"
                className="textarea textarea-bordered w-full text-sm rounded-xl focus:border-indigo-600"
              />
            </div>

            <button
              type="submit"
              disabled={saving || assignedProducts.length === 0}
              className="btn btn-primary w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none text-white font-medium shadow-md shadow-indigo-100 mt-2 gap-2"
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
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
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
            <span className="text-xs text-slate-400">Showing last 50</span>
          </div>

          <div className="mt-4 flex-1 overflow-x-auto">
            {inspections.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No inspections recorded yet.
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
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
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td>
                          <div className="font-semibold text-slate-900 font-mono text-xs">
                            {item.date}
                          </div>
                          <div className="text-[10px] text-slate-400">
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
                            {item.lineName} • <span className="font-mono">{item.productSku}</span>
                          </div>
                          {item.note && (
                            <div className="text-xs text-amber-700 italic mt-0.5">
                              &ldquo;{item.note}&rdquo;
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="font-mono text-slate-700 font-medium">
                            {item.checked.toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`font-mono font-bold ${
                              item.defects > 0 ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {item.defects}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            className={`badge badge-sm font-mono font-bold ${
                              rate === 0
                                ? "badge-success text-white"
                                : rate <= 2.5
                                ? "badge-warning text-amber-950"
                                : "badge-error text-white"
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
