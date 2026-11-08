import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";

export const dynamic = "force-dynamic";
import { getStoreStockData } from "@/actions/fm-actions";
import {
  Warehouse,
  TrendingUp,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";

export default async function StoreStockPage() {
  const user = await requireUser();

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  if (!["fm", "om", "sys_admin"].includes(user.role)) {
    redirect("/dashboard");
  }

  const { factory, productBalances, transactions } = await getStoreStockData();

  const totalStoreStock = productBalances.reduce(
    (acc, p) => acc + (p.currentStock || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Warehouse className="w-4 h-4" />
            <span>Finished Goods Inventory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Store Stock Ledger — {factory.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time finished goods calculated strictly as the immutable sum of transactions (
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-700">
              sum(delta)
            </code>
            ).
          </p>
        </div>

        {/* Total Aggregate Stock Pill */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs sm:text-right">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Total Inventory on Hand
          </span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono tabular-nums mt-0.5">
            {totalStoreStock.toLocaleString()}{" "}
            <span className="text-xs font-normal text-slate-400">pcs</span>
          </div>
        </div>
      </div>

      {/* Stock Balance Cards */}
      <div>
        <h2 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-500" />
          Current Accumulated Product Balances ({productBalances.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {productBalances.map((item) => (
            <div
              key={item.productId}
              className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs flex flex-col justify-between hover:border-indigo-200 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="badge badge-sm font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                    {item.sku}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    In Store
                  </span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg mt-3">
                  {item.productName}
                </h3>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-slate-500">Current Balance</span>
                <div className="text-2xl font-black text-slate-900 font-mono tabular-nums tracking-tight">
                  {item.currentStock.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-400">pcs</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History Log */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs">
        <div className="pb-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Transaction History Log (<code className="text-xs font-mono font-bold">stock_ledger</code>)
              </h2>
              <p className="text-xs text-slate-500">
                Immutable audit trail of all finished goods production increments and adjustments
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono">Showing last 50 transactions</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No stock transactions recorded yet.
            </div>
          ) : (
            <table className="table w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs font-extrabold uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                  <th>Timestamp</th>
                  <th>Product</th>
                  <th>Production Date</th>
                  <th>Reference</th>
                  <th className="text-right">Delta Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const isPositive = tx.delta >= 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="text-xs text-slate-500 font-mono">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <div className="font-bold text-slate-900">
                          {tx.productName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono font-medium">
                          {tx.productSku}
                        </div>
                      </td>
                      <td>
                        <span className="font-semibold text-slate-700 font-mono text-xs">
                          {tx.reportDate || "—"}
                        </span>
                      </td>
                      <td className="text-xs font-mono text-slate-400">
                        {tx.reportEntryId ? `${tx.reportEntryId.slice(0, 10)}...` : "Manual Entry"}
                      </td>
                      <td className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-bold font-mono text-xs sm:text-sm px-2.5 py-1 rounded-xl ${
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
                          {isPositive ? `+${tx.delta}` : tx.delta} pcs
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
  );
}
