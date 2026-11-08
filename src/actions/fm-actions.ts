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

export async function getPlans() {
  const factory = await getFMFactory();
  const myLines = await getLines();
  const lineIds = myLines.map((l) => l.id);

  if (lineIds.length === 0) return [];

  return await db
    .select({
      id: plans.id,
      lineId: plans.lineId,
      lineName: lines.name,
      productId: plans.productId,
      productName: products.name,
      productSku: products.sku,
      startDate: plans.startDate,
      endDate: plans.endDate,
      plannedQty: plans.plannedQty,
      createdAt: plans.createdAt,
    })
    .from(plans)
    .innerJoin(lines, eq(plans.lineId, lines.id))
    .innerJoin(products, eq(plans.productId, products.id))
    .where(eq(lines.factoryId, factory.id))
    .orderBy(desc(plans.startDate));
}

export async function createPlanAction(rawInput: unknown) {
  const user = await requireUser();
  const factory = await getFMFactory();

  const allowed = await can(user, "create", {
    type: "plan",
    factoryId: factory.id,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  const parsed = createPlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { lineId, productId, startDate, endDate, plannedQty } = parsed.data;

  try {
    const planId = `plan_${Date.now()}`;
    await db.insert(plans).values({
      id: planId,
      lineId,
      productId,
      startDate,
      endDate,
      plannedQty,
    });

    revalidatePath("/fm");
    return { success: true };
  } catch (err: any) {
    console.error("Create plan error:", err);
    return { success: false, error: "Failed to create production plan" };
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
