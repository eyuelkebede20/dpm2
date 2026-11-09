import { requireAuthPage } from "@/lib/authz";
import { getStoreStockData } from "@/actions/fm-actions";
import { StoreClient } from "./store-client";

export const dynamic = "force-dynamic";

export default async function StoreStockPage() {
  await requireAuthPage(["fm", "om", "sys_admin"]);

  const { factory, productBalances, transactions } = await getStoreStockData();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StoreClient
          factory={factory}
          productBalances={productBalances}
          transactions={transactions}
        />
      </div>
    </div>
  );
}