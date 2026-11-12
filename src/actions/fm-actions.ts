"use server";

import { z } from "zod";
import { requireUser, can } from "@/lib/authz";
import { db } from "@/db";
import {
  factories,
  factoryUsers,
  lines,
  products,
  lineProducts,
  plans,
  stockLedger,
  reportEntries,
  industryProfile,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { countWorkingDays } from "@/lib/target";

// -------------------------------------------------------------
// Helper: Get FM Factory
// -------------------------------------------------------------
export async function getFMFactory() {
  const user = await requireUser();

  if (user.role === "fm" || user.role === "qa") {
    const [assoc] = await db
      .select({
        factoryId: factoryUsers.factoryId,
        factoryName: factories.name,
      })
      .from(factoryUsers)
      .innerJoin(factories, eq(factoryUsers.factoryId, factories.id))
      .where(eq(factoryUsers.userId, user.id))
      .limit(1);

    if (!assoc) {
      throw new Error("No factory associated with your user account");
    }
    return { id: assoc.factoryId, name: assoc.factoryName };
  }

  // Sys Admin or OM: pick first active factory
  const [firstFactory] = await db
    .select({
      id: factories.id,
      name: factories.name,
    })
    .from(factories)
    .where(eq(factories.active, true))
    .limit(1);

  if (!firstFactory) {
    throw new Error("No factories found in system");
  }

  return firstFactory;
}

// -------------------------------------------------------------
// Lines Management
// -------------------------------------------------------------
const createLineSchema = z
  .object({
    name: z.string().min(2, "Line name must be at least 2 characters").max(100),
  })
  .strict();

export async function getLines() {
  const factory = await getFMFactory();
  return await db
    .select()
    .from(lines)
    .where(eq(lines.factoryId, factory.id))
    .orderBy(desc(lines.createdAt));
}

export async function createLineAction(rawInput: unknown) {
  const user = await requireUser();
  const factory = await getFMFactory();

  const allowed = await can(user, "create", {
    type: "line",
    factoryId: factory.id,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  const parsed = createLineSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  try {
    const lineId = `line_${Date.now()}`;
    await db.insert(lines).values({
      id: lineId,
      factoryId: factory.id,
      name: parsed.data.name.trim(),
      active: true,
    });

    revalidatePath("/fm");
    return { success: true };
  } catch (err: any) {
    console.error("Create line error:", err);
    return { success: false, error: "Failed to create line" };
  }
}

export async function toggleLineActiveAction(lineId: string, active: boolean) {
  const user = await requireUser();
  const factory = await getFMFactory();

  const allowed = await can(user, "update", {
    type: "line",
    factoryId: factory.id,
    lineId,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  try {
    await db
      .update(lines)
      .set({ active })
      .where(and(eq(lines.id, lineId), eq(lines.factoryId, factory.id)));

    revalidatePath("/fm");
    return { success: true };
  } catch (err: any) {
    console.error("Toggle line error:", err);
    return { success: false, error: "Failed to update line status" };
  }
}

// -------------------------------------------------------------
// Products Management
// -------------------------------------------------------------
const createProductSchema = z
  .object({
    name: z.string().min(2, "Product name must be at least 2 characters").max(100),
    sku: z.string().min(2, "SKU must be at least 2 characters").max(50),
  })
  .strict();

export async function getProducts() {
  const factory = await getFMFactory();
  return await db
    .select()
    .from(products)
    .where(eq(products.factoryId, factory.id))
    .orderBy(desc(products.createdAt));
}

export async function createProductAction(rawInput: unknown) {
  const user = await requireUser();
  const factory = await getFMFactory();

  const allowed = await can(user, "create", {
    type: "product",
    factoryId: factory.id,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  const parsed = createProductSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  try {
    const prodId = `prod_${Date.now()}`;
    await db.insert(products).values({
      id: prodId,
      factoryId: factory.id,
      name: parsed.data.name.trim(),
      sku: parsed.data.sku.toUpperCase().trim(),
      active: true,
    });

    revalidatePath("/fm");
    return { success: true };
  } catch (err: any) {
    console.error("Create product error:", err);
    return { success: false, error: "Failed to create product" };
  }
}

export async function toggleProductActiveAction(productId: string, active: boolean) {
  const user = await requireUser();
  const factory = await getFMFactory();

  const allowed = await can(user, "update", {
    type: "product",
    factoryId: factory.id,
    productId,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  try {
    await db
      .update(products)
      .set({ active })
      .where(and(eq(products.id, productId), eq(products.factoryId, factory.id)));

    revalidatePath("/fm");
    return { success: true };
  } catch (err: any) {
    console.error("Toggle product error:", err);
    return { success: false, error: "Failed to update product status" };
  }
}

// -------------------------------------------------------------
// Line Products Association
// -------------------------------------------------------------
export async function getLineProductsAssociations() {
  const factory = await getFMFactory();
  const myLines = await getLines();
  const lineIds = myLines.map((l) => l.id);

  if (lineIds.length === 0) return [];

  return await db
    .select({
      lineId: lineProducts.lineId,
      productId: lineProducts.productId,
    })
    .from(lineProducts);
}

const toggleLineProductSchema = z
  .object({
    lineId: z.string().min(1),
    productId: z.string().min(1),
    linked: z.boolean(),
  })
  .strict();

export async function toggleLineProductAction(rawInput: unknown) {
  const user = await requireUser();
  const factory = await getFMFactory();

  const allowed = await can(user, "update", {
    type: "line",
    factoryId: factory.id,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  const parsed = toggleLineProductSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: "Invalid payload" };

  const { lineId, productId, linked } = parsed.data;

  try {
    if (linked) {
      await db
        .insert(lineProducts)
        .values({ lineId, productId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(lineProducts)
        .where(
          and(
            eq(lineProducts.lineId, lineId),
            eq(lineProducts.productId, productId)
          )
        );
    }

    revalidatePath("/fm");
    return { success: true };
  } catch (err: any) {
    console.error("Toggle line product error:", err);
    return { success: false, error: "Failed to update line product link" };
  }
}

// -------------------------------------------------------------
// Production Plans Management
// -------------------------------------------------------------
const createPlanSchema = z
  .object({
    lineId: z.string().min(1, "Line is required"),
    productId: z.string().min(1, "Product is required"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format (YYYY-MM-DD)"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format (YYYY-MM-DD)"),
    plannedQty: z.number().int().positive("Planned quantity must be greater than 0"),
  })
  .strict()
  .refine((data) => data.startDate <= data.endDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function getPlans(targetFactoryId?: string) {
  const user = await requireUser();
  let factoryFilterId: string | undefined = targetFactoryId;

  if (user.role === "fm") {
    const factory = await getFMFactory();
    factoryFilterId = factory.id;
  } else if (user.role === "om" && !factoryFilterId) {
    // Return all plans across factories owned by this OM
    const omFactories = await db
      .select({ id: factories.id })
      .from(factories)
      .where(eq(factories.omId, user.id));
    const omFactoryIds = omFactories.map((f) => f.id);
    if (omFactoryIds.length === 0) return [];

    const rawPlans = await db
      .select({
        id: plans.id,
        factoryId: lines.factoryId,
        factoryName: factories.name,
        lineId: plans.lineId,
        lineName: lines.name,
        productId: plans.productId,
        productName: products.name,
        productSku: products.sku,
        startDate: plans.startDate,
        endDate: plans.endDate,
        plannedQty: plans.plannedQty,
        initialPlannedQty: plans.initialPlannedQty,
        createdAt: plans.createdAt,
      })
      .from(plans)
      .innerJoin(lines, eq(plans.lineId, lines.id))
      .innerJoin(products, eq(plans.productId, products.id))
      .innerJoin(factories, eq(lines.factoryId, factories.id))
      .where(sql`${lines.factoryId} IN ${omFactoryIds}`)
      .orderBy(desc(plans.startDate));

    const allEntries = await db
      .select({
        lineId: reportEntries.lineId,
        productId: reportEntries.productId,
        date: reportEntries.date,
        finishedGood: reportEntries.finishedGood,
      })
      .from(reportEntries);

    return rawPlans.map((p) => {
      const totalProduced = allEntries
        .filter(
          (e) =>
            e.lineId === p.lineId &&
            e.productId === p.productId &&
            e.date >= p.startDate &&
            e.date <= p.endDate
        )
        .reduce((sum, e) => sum + (e.finishedGood || 0), 0);

      const leftFromWeeklyPlanned = Math.max(0, p.plannedQty - totalProduced);

      return {
        ...p,
        initialPlannedQty: p.initialPlannedQty ?? p.plannedQty,
        weeklyPlanned: p.plannedQty,
        totalProduced,
        leftFromWeeklyPlanned,
      };
    });
  }

  // Single factory query (for FM or OM with specific factoryId or Sys Admin)
  let whereClause = factoryFilterId ? eq(lines.factoryId, factoryFilterId) : undefined;
  if (!factoryFilterId && user.role !== "sys_admin") {
    const factory = await getFMFactory();
    whereClause = eq(lines.factoryId, factory.id);
  }

  const rawPlans = await db
    .select({
      id: plans.id,
      factoryId: lines.factoryId,
      factoryName: factories.name,
      lineId: plans.lineId,
      lineName: lines.name,
      productId: plans.productId,
      productName: products.name,
      productSku: products.sku,
      startDate: plans.startDate,
      endDate: plans.endDate,
      plannedQty: plans.plannedQty,
      initialPlannedQty: plans.initialPlannedQty,
      createdAt: plans.createdAt,
    })
    .from(plans)
    .innerJoin(lines, eq(plans.lineId, lines.id))
    .innerJoin(products, eq(plans.productId, products.id))
    .innerJoin(factories, eq(lines.factoryId, factories.id))
    .where(whereClause)
    .orderBy(desc(plans.startDate));

  // Compute cumulative produced finished goods and left from weekly planned
  const allEntries = await db
    .select({
      lineId: reportEntries.lineId,
      productId: reportEntries.productId,
      date: reportEntries.date,
      finishedGood: reportEntries.finishedGood,
    })
    .from(reportEntries);

  return rawPlans.map((p) => {
    const totalProduced = allEntries
      .filter(
        (e) =>
          e.lineId === p.lineId &&
          e.productId === p.productId &&
          e.date >= p.startDate &&
          e.date <= p.endDate
      )
      .reduce((sum, e) => sum + (e.finishedGood || 0), 0);

    const leftFromWeeklyPlanned = Math.max(0, p.plannedQty - totalProduced);

    return {
      ...p,
      initialPlannedQty: p.initialPlannedQty ?? p.plannedQty,
      weeklyPlanned: p.plannedQty,
      totalProduced,
      leftFromWeeklyPlanned,
    };
  });
}

export async function createPlanAction(rawInput: unknown) {
  const user = await requireUser();

  if (user.role === "fm") {
    return {
      success: false,
      error: "Forbidden: Factory Managers cannot create production plans. Only Operation Managers can manage plans.",
    };
  }

  const parsed = createPlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { lineId, productId, startDate, endDate, plannedQty } = parsed.data;

  // Resolve factoryId from the line
  const [lineRecord] = await db
    .select({ factoryId: lines.factoryId })
    .from(lines)
    .where(eq(lines.id, lineId))
    .limit(1);

  const factoryId = lineRecord?.factoryId;

  const allowed = await can(user, "create", {
    type: "plan",
    factoryId,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  try {
    const planId = `plan_${Date.now()}`;
    await db.insert(plans).values({
      id: planId,
      lineId,
      productId,
      startDate,
      endDate,
      plannedQty,
      initialPlannedQty: plannedQty,
    });

    revalidatePath("/fm");
    revalidatePath("/planning");
    revalidatePath("/calendar");
    return { success: true };
  } catch (err: any) {
    console.error("Create plan error:", err);
    return { success: false, error: "Failed to create production plan" };
  }
}

const updatePlanSchema = z
  .object({
    id: z.string().min(1, "Plan ID is required"),
    lineId: z.string().min(1, "Line is required"),
    productId: z.string().min(1, "Product is required"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format (YYYY-MM-DD)"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format (YYYY-MM-DD)"),
    plannedQty: z.number().int().positive("Planned quantity must be greater than 0"),
  })
  .strict()
  .refine((data) => data.startDate <= data.endDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function updatePlanAction(rawInput: unknown) {
  const user = await requireUser();

  if (user.role === "fm") {
    return {
      success: false,
      error: "Forbidden: Factory Managers cannot edit production plans. Only Operation Managers can manage plans.",
    };
  }

  const parsed = updatePlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { id, lineId, productId, startDate, endDate, plannedQty } = parsed.data;

  // Resolve factoryId from the line
  const [lineRecord] = await db
    .select({ factoryId: lines.factoryId })
    .from(lines)
    .where(eq(lines.id, lineId))
    .limit(1);

  const factoryId = lineRecord?.factoryId;

  const allowed = await can(user, "update", {
    type: "plan",
    factoryId,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  try {
    const [existing] = await db
      .select({
        initialPlannedQty: plans.initialPlannedQty,
        plannedQty: plans.plannedQty,
      })
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);

    const initialQty = existing?.initialPlannedQty ?? existing?.plannedQty ?? plannedQty;

    await db
      .update(plans)
      .set({
        lineId,
        productId,
        startDate,
        endDate,
        plannedQty,
        initialPlannedQty: initialQty,
      })
      .where(eq(plans.id, id));

    revalidatePath("/fm");
    revalidatePath("/planning");
    revalidatePath("/calendar");
    return { success: true };
  } catch (err: any) {
    console.error("Update plan error:", err);
    return { success: false, error: "Failed to update production plan" };
  }
}

export async function deletePlanAction(planId: string) {
  const user = await requireUser();

  if (user.role === "fm") {
    return {
      success: false,
      error: "Forbidden: Factory Managers cannot delete production plans. Only Operation Managers can manage plans.",
    };
  }

  const factory = await getFMFactory();

  const allowed = await can(user, "delete", {
    type: "plan",
    factoryId: factory.id,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  try {
    await db.delete(plans).where(eq(plans.id, planId));
    revalidatePath("/fm");
    return { success: true };
  } catch (err: any) {
    console.error("Delete plan error:", err);
    return { success: false, error: "Failed to delete production plan" };
  }
}

const createStoreTransactionSchema = z
  .object({
    productId: z.string().min(1, "Product is required"),
    delta: z.number().int().refine((val) => val !== 0, "Quantity change cannot be zero"),
    notes: z.string().max(200).optional(),
  })
  .strict();

export async function createStoreTransactionAction(rawInput: unknown) {
  const user = await requireUser();
  const factory = await getFMFactory();

  const allowed = await can(user, "create", {
    type: "stock_ledger",
    factoryId: factory.id,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  const parsed = createStoreTransactionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { productId, delta } = parsed.data;

  try {
    const txId = `stk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.insert(stockLedger).values({
      id: txId,
      factoryId: factory.id,
      productId,
      delta,
      reportEntryId: null,
    });

    revalidatePath("/fm/store");
    revalidatePath("/fm");
    return { success: true };
  } catch (err: any) {
    console.error("Create store transaction error:", err);
    return { success: false, error: "Failed to record stock transaction" };
  }
}

// -------------------------------------------------------------
// Store Stock Ledger View (/fm/store)
// -------------------------------------------------------------
export async function getStoreStockData() {
  const factory = await getFMFactory();

  // 1. Accumulated stock per product: sum(delta)
  const productBalances = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      currentStock: sql<number>`COALESCE(SUM(${stockLedger.delta}), 0)::int`,
    })
    .from(products)
    .leftJoin(
      stockLedger,
      and(
        eq(products.id, stockLedger.productId),
        eq(stockLedger.factoryId, factory.id)
      )
    )
    .where(and(eq(products.factoryId, factory.id), eq(products.active, true)))
    .groupBy(products.id, products.name, products.sku)
    .orderBy(products.name);

  // 2. Transaction history log (last 50 rows)
  const transactions = await db
    .select({
      id: stockLedger.id,
      delta: stockLedger.delta,
      createdAt: stockLedger.createdAt,
      reportEntryId: stockLedger.reportEntryId,
      productId: stockLedger.productId,
      productName: products.name,
      productSku: products.sku,
      reportDate: reportEntries.date,
    })
    .from(stockLedger)
    .innerJoin(products, eq(stockLedger.productId, products.id))
    .leftJoin(reportEntries, eq(stockLedger.reportEntryId, reportEntries.id))
    .where(eq(stockLedger.factoryId, factory.id))
    .orderBy(desc(stockLedger.createdAt))
    .limit(50);

  return {
    factory,
    productBalances,
    transactions,
  };
}
