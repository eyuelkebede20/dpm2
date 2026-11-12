import { requireAuthPage } from "@/lib/authz";
import { getCurrentUserContext } from "@/actions/data";
import { getProductionPlansAction } from "@/actions/plan-actions";
import { db } from "@/db";
import { factories, factoryUsers, lines, products, lineProducts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { PlanningClient } from "@/components/planning/planning-client";

export const dynamic = "force-dynamic";

interface PlanningPageProps {
  searchParams: Promise<{
    factoryId?: string;
  }>;
}

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const user = await requireAuthPage(["om", "fm", "sys_admin"]);
  const context = await getCurrentUserContext();
  const resolvedParams = await searchParams;

  const calendarSystem =
    (context.industryProfile as any)?.calendarSystem || "ethiopian";
  const canManagePlans = user.role === "om" || user.role === "sys_admin";

  // Determine accessible factories based on role
  let accessibleFactories: Array<{ id: string; name: string }> = [];

  if (user.role === "fm") {
    if (context.factoryId) {
      accessibleFactories = [
        {
          id: context.factoryId,
          name: context.factoryName || "My Plant",
        },
      ];
    }
  } else if (user.role === "om") {
    accessibleFactories = await db
      .select({ id: factories.id, name: factories.name })
      .from(factories)
      .where(eq(factories.omId, user.id));
  } else {
    // sys_admin
    accessibleFactories = await db
      .select({ id: factories.id, name: factories.name })
      .from(factories);
  }

  const factoryIds = accessibleFactories.map((f) => f.id);

  // Fetch lines, products, and links for these factories
  let linesList: Array<{ id: string; name: string; factoryId: string }> = [];
  let productsList: Array<{ id: string; name: string; sku: string; factoryId?: string }> = [];
  let lineProductsList: Array<{ lineId: string; productId: string }> = [];

  if (factoryIds.length > 0) {
    linesList = await db
      .select({ id: lines.id, name: lines.name, factoryId: lines.factoryId })
      .from(lines)
      .where(sql`${lines.factoryId} IN ${factoryIds}`);

    productsList = await db
      .select({ id: products.id, name: products.name, sku: products.sku, factoryId: products.factoryId })
      .from(products)
      .where(sql`${products.factoryId} IN ${factoryIds}`);

    const lineIds = linesList.map((l) => l.id);
    if (lineIds.length > 0) {
      lineProductsList = await db
        .select({ lineId: lineProducts.lineId, productId: lineProducts.productId })
        .from(lineProducts)
        .where(sql`${lineProducts.lineId} IN ${lineIds}`);
    }
  }

  // Fetch production plans
  const targetFactoryId = resolvedParams.factoryId || (user.role === "fm" && context.factoryId ? context.factoryId : "all");
  const plansRes = await getProductionPlansAction(targetFactoryId);
  const planItems = plansRes.success && plansRes.data ? plansRes.data : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlanningClient
          factories={accessibleFactories}
          initialFactoryId={targetFactoryId}
          lines={linesList}
          products={productsList}
          lineProducts={lineProductsList}
          plans={planItems}
          calendarSystem={calendarSystem}
          userRole={user.role}
          canManagePlans={canManagePlans}
        />
      </div>
    </div>
  );
}
