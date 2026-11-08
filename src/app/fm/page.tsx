import { requireAuthPage } from "@/lib/authz";
import {
  getFMFactory,
  getLines,
  getProducts,
  getLineProductsAssociations,
  getPlans,
} from "@/actions/fm-actions";
import { FMClient } from "./fm-client";

export const dynamic = "force-dynamic";

export default async function FMPage() {
  await requireAuthPage(["fm", "om", "sys_admin"]);

  const factory = await getFMFactory();
  const lines = await getLines();
  const products = await getProducts();
  const lineProducts = await getLineProductsAssociations();
  const plans = await getPlans();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Factory Management (FM)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure production lines, product catalogs, and production plans
        </p>
      </div>

      <FMClient
        factoryName={factory.name}
        lines={lines}
        products={products}
        lineProducts={lineProducts}
        plans={plans}
      />
    </div>
  );
}
