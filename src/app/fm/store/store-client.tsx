"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStoreTransactionAction } from "@/actions/fm-actions";
import { SearchInput } from "@/components/ui";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import {
  Warehouse,
  TrendingUp,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Layers,
  Sparkles,
  Plus,
  Search,
  Filter,
  ArrowLeft,
  Calendar,
  Clock,
  Boxes,
} from "lucide-react";

interface ProductBalance {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
}

interface TransactionItem {
  id: string;
  delta: number;
  createdAt: Date;
  reportEntryId: string | null;
  productId: string;
  productName: string;
  productSku: string;
  reportDate: string | null;
}

interface StoreClientProps {
  factory: {
    id: string;
    name: string;
  };
  productBalances: ProductBalance[];
  transactions: TransactionItem[];
}

export function StoreClient({
  factory,
  productBalances,
  transactions,
}: StoreClientProps) {
  const router = useRouter();

  // Search & Filters
  const [stockSearch, setStockSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [txFilter, setTxFilter] = useState<"all" | "in" | "out">("all");

  // Store Transaction Modal State
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(
    productBalances[0]?.productId || ""
  );
  const [txDirection, setTxDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState<number>(100);
  const [txNotes, setTxNotes] = useState("");
  const [txSaving, setTxSaving] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Total Aggregate Stock
  const totalStoreStock = useMemo(() => {
    return productBalances.reduce((acc, p) => acc + (p.currentStock || 0), 0);
  }, [productBalances]);

  // Filtered Stock Balances
  const filteredBalances = useMemo(() => {
    if (!stockSearch.trim()) return productBalances;
    const q = stockSearch.toLowerCase();
    return productBalances.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [productBalances, stockSearch]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (txFilter === "in" && tx.delta < 0) return false;
      if (txFilter === "out" && tx.delta >= 0) return false;

      // Text search
      if (!txSearch.trim()) return true;
      const q = txSearch.toLowerCase();
      return (
        tx.productName.toLowerCase().includes(q) ||
        tx.productSku.toLowerCase().includes(q) ||
        (tx.reportDate && tx.reportDate.toLowerCase().includes(q))
      );
    });
  }, [transactions, txFilter, txSearch]);

  // Client-side pagination for smooth ledger loading
  const txPagination = usePagination({
    items: filteredTransactions,
    initialPageSize: 10,
  });

  // Submit Transaction
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxSaving(true);
    setTxError(null);

    const deltaValue = txDirection === "in" ? Math.abs(quantity) : -Math.abs(quantity);

    const res = await createStoreTransactionAction({
      productId: selectedProductId,
      delta: deltaValue,
      notes: txNotes.trim() || undefined,
    });

    setTxSaving(false);
    if (res.success) {
      setTxModalOpen(false);
      setQuantity(100);
      setTxNotes("");
      router.refresh();
    } else {
      setTxError(res.error || "Failed to record stock transaction");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Subnav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/fm"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Factory Management</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Warehouse className="w-4 h-4" />
            <span>Finished Goods Inventory Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-relaxed">
            Store Stock Ledger — {factory.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
            Real-time finished goods calculated strictly as the immutable sum of transactions (
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded-md font-mono font-bold text-slate-700">
              sum(delta)
            </code>
            ).
          </p>
        </div>

        {/* Action Controls & Aggregate Stock Pill */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={() => setTxModalOpen(true)}
            className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-2 min-h-[44px] px-5 font-bold text-xs sm:text-sm shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Store Transaction</span>
          </button>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs sm:text-right min-w-[190px]">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Total Inventory on Hand
            </span>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono tabular-nums mt-0.5">
              {totalStoreStock.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400 font-sans">pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Balance Cards Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            <span>Current Accumulated Product Balances ({productBalances.length})</span>
          </h2>

          <SearchInput
            placeholder="Search product balances..."
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
            onClear={() => setStockSearch("")}
            maxWidthClass="w-full sm:w-72"
          />
        </div>

        {filteredBalances.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center text-slate-400 text-sm">
            No products match your search query.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredBalances.map((item) => (
              <div
                key={item.productId}
                className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-indigo-200 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge badge-sm font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/60 py-2.5 px-3 rounded-xl">
                      {item.sku}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      In Store
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-lg mt-3 leading-relaxed">
                    {item.productName}
                  </h3>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-slate-500">Current Balance</span>
                  <div className="text-2xl font-black text-slate-900 font-mono tabular-nums tracking-tight">
                    {item.currentStock.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-slate-400 font-sans">pcs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History Log Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
        <div className="pb-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl flex-shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-relaxed">
                Transaction History Log (<code className="text-xs font-mono font-bold">stock_ledger</code>)
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Immutable audit trail of finished goods production increments and inventory adjustments
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono self-start sm:self-center">
            Showing last {filteredTransactions.length} of {transactions.length} entries
          </span>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <SearchInput
            placeholder="Search ledger by product, SKU, or date..."
            value={txSearch}
            onChange={(e) => setTxSearch(e.target.value)}
            onClear={() => setTxSearch("")}
            maxWidthClass="flex-1 max-w-md"
          />

          {/* Direction Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setTxFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[36px] ${
                txFilter === "all"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTxFilter("in")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[36px] ${
                txFilter === "in"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Stock In (+)
            </button>
            <button
              onClick={() => setTxFilter("out")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[36px] ${
                txFilter === "out"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Stock Out (-)
            </button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/70">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No stock transactions match your filter criteria.
            </div>
          ) : (
            <table className="table w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs font-black uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Production Date</th>
                  <th className="py-3.5 px-4">Reference</th>
                  <th className="py-3.5 px-4 text-right">Delta Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txPagination.paginatedItems.map((tx) => {
                  const isPositive = tx.delta >= 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 leading-relaxed">
                          {tx.productName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono font-bold mt-0.5">
                          {tx.productSku}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-700 font-mono text-xs">
                          {tx.reportDate || "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-400">
                        {tx.reportEntryId ? `${tx.reportEntryId.slice(0, 10)}...` : "Manual Adjustment"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-bold font-mono text-xs sm:text-sm px-3 py-1.5 rounded-xl ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {isPositive ? `+${tx.delta.toLocaleString()}` : tx.delta.toLocaleString()} pcs
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Responsive Cards for Transactions */}
        <div className="md:hidden space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No transactions match your query.
            </div>
          ) : (
            txPagination.paginatedItems.map((tx) => {
              const isPositive = tx.delta >= 0;
              return (
                <div
                  key={tx.id}
                  className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="badge badge-xs font-mono font-bold bg-white text-slate-700 border border-slate-200/80 mb-1">
                        {tx.productSku}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm leading-relaxed">
                        {tx.productName}
                      </h4>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 font-bold font-mono text-xs px-2.5 py-1 rounded-xl flex-shrink-0 ${
                        isPositive
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {isPositive ? `+${tx.delta.toLocaleString()}` : tx.delta.toLocaleString()} pcs
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                    <span>
                      {tx.reportEntryId ? `Report: ${tx.reportDate}` : "Manual Adjustment"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Scalable Pagination Controls for Transactions Ledger */}
        <Pagination
          {...txPagination}
          itemLabel="transactions"
          className="border-t border-slate-100 pt-3"
        />
      </div>

      {/* Modal: Store Transaction / Stock Adjustment */}
      {txModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl border border-slate-200/90">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-relaxed">
                  Record Store Stock Transaction
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record a finished goods inventory receipt, dispatch, or physical audit adjustment
                </p>
              </div>
              <button
                onClick={() => setTxModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px]"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {txError && (
              <div className="alert alert-error text-xs py-2.5 px-3 rounded-2xl mt-4 bg-red-50 text-red-700 border border-red-200">
                <span>{txError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTransaction} className="space-y-4 mt-5">
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
                  {productBalances.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName} ({p.sku}) — Current: {p.currentStock.toLocaleString()} pcs
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Transaction Direction
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTxDirection("in")}
                    className={`btn rounded-2xl min-h-[44px] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border ${
                      txDirection === "in"
                        ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Receipt / Stock In (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxDirection("out")}
                    className={`btn rounded-2xl min-h-[44px] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border ${
                      txDirection === "out"
                        ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    <span>Dispatch / Out (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Quantity (pcs)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  placeholder="e.g. 500"
                  className="input input-bordered w-full text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Adjustment Reason / Note (Optional)
                </label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="e.g. Physical inventory reconciliation, QC samples, warehouse dispatch"
                  className="input input-bordered w-full text-xs sm:text-sm rounded-2xl min-h-[44px] border-slate-200 focus:border-indigo-600 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTxModalOpen(false)}
                  className="btn btn-ghost rounded-2xl min-h-[44px] px-5 font-bold text-xs sm:text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txSaving}
                  className="btn btn-primary rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none min-h-[44px] px-6 font-bold text-xs sm:text-sm shadow-sm"
                >
                  {txSaving ? "Recording..." : "Record Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}