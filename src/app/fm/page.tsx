import Link from "next/link";
import { requireAuthPage } from "@/lib/authz";
import {
  getFMFactory,
  getLines,
  getProducts,
  getLineProductsAssociations,
  getPlans,
} from "@/actions/fm-actions";
import { FMClient } from "./fm-client";
import { Warehouse, Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FMPage() {
  await requireAuthPage(["fm", "om", "sys_admin"]);

  const factory = await getFMFactory();
  const lines = await getLines();
  const products = await getProducts();
  const lineProducts = await getLineProductsAssociations();
  const plans = await getPlans();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Workspace Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Settings2 className="w-4 h-4" />
              <span>Operations & Floor Configuration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-relaxed">
              Factory Management — {factory.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Configure production lines, manage product catalogs, and schedule periodic production plans.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/fm/store"
              className="btn btn-outline border-slate-300 hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-2xl gap-2 min-h-[44px] px-4 font-semibold text-xs sm:text-sm transition-all shadow-xs"
            >
              <Warehouse className="w-4 h-4 text-indigo-600" />
              <span>Finished Goods Store</span>
            </Link>
          </div>
        </div>

        <FMClient
          factoryName={factory.name}
          lines={lines}
          products={products}
          lineProducts={lineProducts}
          plans={plans}
        />
      </div>
    </div>
  );
}
