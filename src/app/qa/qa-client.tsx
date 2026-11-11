"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { QAEntryItem, reviewQAEntryAction } from "@/actions/qa-actions";
import { SearchInput } from "@/components/ui";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Check,
  AlertCircle,
  RotateCcw,
  Boxes,
  Calendar,
  MessageSquare,
  Sparkles,
  ChevronDown,
  History,
} from "lucide-react";

export interface QAClientProps {
  initialEntries?: QAEntryItem[];
  userRole?: string;
  // Optional legacy props
  assignedProducts?: any[];
  availableLines?: any[];
  inspections?: any[];
}

export function QAClient({
  initialEntries = [],
  userRole = "qa",
}: QAClientProps) {
  const router = useRouter();

  const [entries, setEntries] = useState<QAEntryItem[]>(initialEntries);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected">("all");
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Reject Modal state
  const [rejectingItem, setRejectingItem] = useState<QAEntryItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Unique products for quick filter
  const productOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku: string }>();
    entries.forEach((e) => {
      if (!map.has(e.productId)) {
        map.set(e.productId, { id: e.productId, name: e.productName, sku: e.productSku });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  // Summary counts
  const pendingCount = useMemo(
    () => entries.filter((e) => e.status === "pending").length,
    [entries]
  );
  const approvedCount = useMemo(
    () => entries.filter((e) => e.status === "approved").length,
    [entries]
  );
  const rejectedCount = useMemo(
    () => entries.filter((e) => e.status === "rejected").length,
    [entries]
  );
  const totalReviewed = approvedCount + rejectedCount;

  // Filtered lists
  const pendingEntries = useMemo(() => {
    return entries
      .filter((e) => e.status === "pending")
      .filter((e) => {
        if (selectedProductFilter !== "all" && e.productId !== selectedProductFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            e.productName.toLowerCase().includes(q) ||
            e.lineName.toLowerCase().includes(q) ||
            e.productSku.toLowerCase().includes(q) ||
            e.date.includes(q)
          );
        }
        return true;
      });
  }, [entries, selectedProductFilter, searchQuery]);

  const historyEntries = useMemo(() => {
    return entries
      .filter((e) => e.status !== "pending")
      .filter((e) => {
        if (historyFilter !== "all" && e.status !== historyFilter) {
          return false;
        }
        if (selectedProductFilter !== "all" && e.productId !== selectedProductFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            e.productName.toLowerCase().includes(q) ||
            e.lineName.toLowerCase().includes(q) ||
            e.productSku.toLowerCase().includes(q) ||
            e.date.includes(q) ||
            (e.qaNote && e.qaNote.toLowerCase().includes(q))
          );
        }
        return true;
      });
  }, [entries, historyFilter, selectedProductFilter, searchQuery]);

  // Handle Review Action (Approve / Reject)
  const handleReview = async (
    item: QAEntryItem,
    status: "approved" | "rejected",
    note?: string
  ) => {
    setProcessingId(item.id);

    // Optimistic UI update
    setEntries((prev) =>
      prev.map((e) =>
        e.id === item.id
          ? {
              ...e,
              status,
              qaNote: note?.trim() || null,
              qaReviewedAt: new Date(),
            }
          : e
      )
    );

    const res = await reviewQAEntryAction({
      reportEntryId: item.id,
      status,
      note,
    });

    setProcessingId(null);

    if (res.success) {
      showToast(
        "success",
        status === "approved"
          ? `Approved ${item.productName} (${item.lineName}) successfully.`
          : `Rejected ${item.productName} (${item.lineName}).`
      );
      if (rejectingItem?.id === item.id) {
        setRejectingItem(null);
        setRejectionReason("");
      }
      router.refresh();
    } else {
      // Revert on error
      setEntries((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, status: item.status } : e))
      );
      showToast("error", res.error || "Failed to record decision.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`alert ${
              toastMsg.type === "success"
                ? "alert-success bg-emerald-600 text-white"
                : "alert-error bg-rose-600 text-white"
            } shadow-lg rounded-2xl text-sm font-bold flex items-center gap-2 border-none py-2.5 px-4`}
          >
            {toastMsg.type === "success" ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. EXECUTIVE KPI SUMMARY STRIP                                */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Pending Review Card */}
        <div
          onClick={() => setActiveTab("pending")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-2xs cursor-pointer transition-all ${
            activeTab === "pending"
              ? "border-amber-400 ring-2 ring-amber-500/20 bg-amber-50/20"
              : "border-slate-200/90 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Pending Review
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono tabular-nums mt-2">
            {pendingCount}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1 font-medium">
            Waiting for QA decision
          </span>
        </div>

        {/* Approved Card */}
        <div
          onClick={() => {
            setActiveTab("history");
            setHistoryFilter("approved");
          }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-2xs cursor-pointer transition-all ${
            activeTab === "history" && historyFilter === "approved"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20"
              : "border-slate-200/90 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Approved (የጸደቁ)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tabular-nums mt-2">
            {approvedCount}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1 font-medium">
            Quality verified & passed
          </span>
        </div>

        {/* Rejected Card */}
        <div
          onClick={() => {
            setActiveTab("history");
            setHistoryFilter("rejected");
          }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-2xs cursor-pointer transition-all ${
            activeTab === "history" && historyFilter === "rejected"
              ? "border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/20"
              : "border-slate-200/90 hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Rejected (ውድቅ)
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono tabular-nums mt-2">
            {rejectedCount}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1 font-medium">
            Requires FM correction
          </span>
        </div>

        {/* Total Reviewed Card */}
        <div
          onClick={() => {
            setActiveTab("history");
            setHistoryFilter("all");
          }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-2xs cursor-pointer transition-all ${
            activeTab === "history" && historyFilter === "all"
              ? "border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/20"
              : "border-slate-200/90 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Total Decisions
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 font-mono tabular-nums mt-2">
            {totalReviewed}
          </div>
          <span className="text-[11px] text-slate-500 block mt-1 font-medium">
            Total reports logged
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TABS & FILTER BAR                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Main Navigation Tabs */}
          <div className="join bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`btn btn-sm join-item rounded-xl text-xs font-bold gap-2 min-h-[36px] ${
                activeTab === "pending"
                  ? "bg-white text-slate-900 shadow-xs border-none"
                  : "btn-ghost text-slate-600"
              }`}
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Pending Review (ለመጽደቅ የቀረቡ)</span>
              {pendingCount > 0 && (
                <span className="badge badge-xs font-extrabold bg-amber-500 text-white border-none px-1.5">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`btn btn-sm join-item rounded-xl text-xs font-bold gap-2 min-h-[36px] ${
                activeTab === "history"
                  ? "bg-white text-slate-900 shadow-xs border-none"
                  : "btn-ghost text-slate-600"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Previous Approvals & Decisions (ያለፉ ውሳኔዎች)</span>
              {totalReviewed > 0 && (
                <span className="badge badge-xs font-bold bg-slate-200 text-slate-700 border-none px-1.5">
                  {totalReviewed}
                </span>
              )}
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <SearchInput
              placeholder="Search product or line..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              maxWidthClass="w-full sm:w-64"
            />

            {/* Product Filter */}
            {productOptions.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <Boxes className="w-3.5 h-3.5 text-slate-400" />
                <select
                  aria-label="Filter by Product"
                  value={selectedProductFilter}
                  onChange={(e) => setSelectedProductFilter(e.target.value)}
                  className="select select-xs border-none bg-transparent font-bold text-slate-700 text-xs focus:outline-hidden p-0"
                >
                  <option value="all">All Products</option>
                  {productOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* History Sub-Filter (Visible when viewing history tab) */}
        {activeTab === "history" && (
          <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs font-bold">
            <span className="text-slate-400 uppercase text-[10px] tracking-wider shrink-0">
              Filter Decisions:
            </span>
            <button
              type="button"
              onClick={() => setHistoryFilter("all")}
              className={`px-3 py-1.5 rounded-xl border transition-colors ${
                historyFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Decisions ({totalReviewed})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter("approved")}
              className={`px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5 ${
                historyFilter === "approved"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-emerald-800 border-slate-200 hover:bg-emerald-50/50"
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approved Only ({approvedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter("rejected")}
              className={`px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5 ${
                historyFilter === "rejected"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-rose-800 border-slate-200 hover:bg-rose-50/50"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected Only ({rejectedCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. PENDING REVIEW VIEW (WHAT FACTORY MANAGERS INPUT)           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {pendingEntries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                All Production Inputs Reviewed!
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No factory manager production reports are currently waiting for QA sign-off.
                Check back when new daily reports are submitted.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingEntries.map((item) => {
                const isProcessing = processingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
                  >
                    {/* Header Row: Product, Line, Date, Submitter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-slate-900">
                            {item.productName}
                          </h3>
                          <span className="badge badge-sm font-mono text-[10px] bg-slate-100 text-slate-700 border-slate-200 font-bold">
                            {item.productSku}
                          </span>
                          <span className="badge badge-sm font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Pending Review
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          <span className="font-bold text-slate-700">{item.lineName}</span>
                          <span>•</span>
                          <span>{item.factoryName}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-400">Date: {item.date}</span>
                        </div>
                      </div>

                      {item.reporterName && (
                        <div className="text-xs text-slate-400 font-medium">
                          Reported by <span className="text-slate-700 font-bold">{item.reporterName}</span>
                        </div>
                      )}
                    </div>

                    {/* FM Reported Numbers Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                      <div className="bg-emerald-50/70 border border-emerald-100 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                          Finished Goods
                        </span>
                        <span className="font-black font-mono text-emerald-700 text-base tabular-nums">
                          {item.finishedGood.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-emerald-600 block">pcs</span>
                      </div>

                      <div className="bg-rose-50/70 border border-rose-100 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
                          Reject
                        </span>
                        <span className="font-black font-mono text-rose-700 text-base tabular-nums">
                          {item.reject.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-rose-600 block">pcs</span>
                      </div>

                      <div className="bg-amber-50/70 border border-amber-100 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                          Rework
                        </span>
                        <span className="font-black font-mono text-amber-700 text-base tabular-nums">
                          {item.rework.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-amber-600 block">pcs</span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Scrap
                        </span>
                        <span className="font-black font-mono text-slate-700 text-base tabular-nums">
                          {item.scrap.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-400 block">pcs</span>
                      </div>

                      <div className="bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                          WIP
                        </span>
                        <span className="font-black font-mono text-indigo-600 text-base tabular-nums">
                          {item.wip.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-indigo-500 block">pcs</span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-2xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Downtime
                        </span>
                        <span className="font-black font-mono text-slate-700 text-base tabular-nums">
                          {item.downtimeMinutes}
                        </span>
                        <span className="text-[9px] text-slate-400 block">mins</span>
                      </div>
                    </div>

                    {/* FM Issue Note / Downtime Reason if present */}
                    {(item.issueNote || item.downtimeReasonName) && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 text-xs flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          {item.downtimeReasonName && (
                            <span className="font-bold text-slate-800 mr-2">
                              [{item.downtimeReasonCode}] {item.downtimeReasonName}
                              {item.downtimeReasonNameAm ? ` (${item.downtimeReasonNameAm})` : ""}
                            </span>
                          )}
                          {item.issueNote && (
                            <span className="text-slate-600">{item.issueNote}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions: Approve / Reject */}
                    <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleReview(item, "approved")}
                        className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-none shadow-xs gap-1.5 px-4"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isProcessing ? "Approving..." : "Approve (አጽድቅ)"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          setRejectingItem(item);
                          setRejectionReason("");
                        }}
                        className="btn btn-sm bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl border-none shadow-xs gap-1.5 px-4"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject (ውድቅ አድርግ)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. PREVIOUS APPROVALS & DECISIONS VIEW (HISTORY)              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {historyEntries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-2xs space-y-2">
              <History className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-600">
                No decisions found for this filter
              </h3>
              <p className="text-xs text-slate-400">
                Change your filter or review pending batches to build decision history.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {historyEntries.map((item) => {
                const isApproved = item.status === "approved";
                const isProcessing = processingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-3xl border p-4 sm:p-5 shadow-2xs space-y-3 transition-all ${
                      isApproved ? "border-emerald-200/80" : "border-rose-200/80"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`badge badge-sm font-bold gap-1 ${
                              isApproved
                                ? "bg-emerald-100 text-emerald-800 border-none"
                                : "bg-rose-100 text-rose-800 border-none"
                            }`}
                          >
                            {isApproved ? (
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-rose-700" />
                            )}
                            <span>{isApproved ? "Approved (የጸደቀ)" : "Rejected (ውድቅ የተደረገ)"}</span>
                          </span>

                          <h3 className="text-sm sm:text-base font-black text-slate-900">
                            {item.productName}
                          </h3>
                          <span className="badge badge-xs font-mono bg-slate-100 text-slate-600">
                            {item.productSku}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.lineName} • {item.factoryName} • <span className="font-mono">{item.date}</span>
                        </div>
                      </div>

                      {/* Reversal / Change Decision */}
                      <div className="flex items-center gap-2">
                        {isApproved ? (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setRejectingItem(item);
                              setRejectionReason("");
                            }}
                            className="btn btn-xs btn-ghost text-rose-600 hover:bg-rose-50 font-bold rounded-lg gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Change to Rejected</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleReview(item, "approved")}
                            className="btn btn-xs btn-ghost text-emerald-700 hover:bg-emerald-50 font-bold rounded-lg gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Change to Approved</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Reported Stats Quick Row */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 bg-slate-50/70 p-2.5 rounded-2xl">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Finished Good</span>
                        <span className="font-bold text-slate-900">{item.finishedGood.toLocaleString()} pcs</span>
                      </div>
                      <div className="h-4 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Reject</span>
                        <span className="font-bold text-rose-600">{item.reject} pcs</span>
                      </div>
                      <div className="h-4 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Rework</span>
                        <span className="font-bold text-amber-600">{item.rework} pcs</span>
                      </div>
                      <div className="h-4 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Downtime</span>
                        <span className="font-bold text-slate-700">{item.downtimeMinutes} min</span>
                      </div>
                    </div>

                    {/* QA Note / Reason if any */}
                    {item.qaNote && (
                      <div
                        className={`text-xs p-2.5 rounded-xl border ${
                          isApproved
                            ? "bg-emerald-50/50 border-emerald-100 text-emerald-900"
                            : "bg-rose-50/50 border-rose-100 text-rose-900"
                        }`}
                      >
                        <span className="font-bold mr-1">QA Note:</span>
                        <span>{item.qaNote}</span>
                      </div>
                    )}

                    {/* Reviewer signature */}
                    {item.qaReviewerName && (
                      <div className="text-[11px] text-slate-400 text-right">
                        Decision recorded by <span className="font-bold text-slate-600">{item.qaReviewerName}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. REJECTION MODAL (REASON PROMPT)                            */}
      {/* ------------------------------------------------------------- */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Reject Production Batch (ምርት ውድቅ አድርግ)
                  </h3>
                  <span className="text-xs text-slate-500">
                    {rejectingItem.productName} • {rejectingItem.lineName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Reported Output:</span>
                <span className="font-mono font-bold text-slate-800">
                  {rejectingItem.finishedGood.toLocaleString()} pcs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Defects / Rejects:</span>
                <span className="font-mono font-bold text-rose-600">
                  {rejectingItem.reject} pcs
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rejection Reason (የውድቅ ምክንያት - አማራጭ)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Reject rate exceeds 5% threshold, packaging seal failure..."
                className="textarea textarea-bordered w-full text-xs rounded-xl focus:outline-hidden leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="btn btn-sm btn-ghost rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === rejectingItem.id}
                onClick={() => handleReview(rejectingItem, "rejected", rejectionReason)}
                className="btn btn-sm bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl border-none shadow-xs gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
