"use server";

import { z } from "zod";
import { requireUser, can } from "@/lib/authz";
import { db } from "@/db";
import {
  products,
  lines,
  lineProducts,
  qaAssignments,
  qaInspections,
  factories,
  factoryUsers,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// -------------------------------------------------------------
// Get QA Assigned Products & Available Lines
// -------------------------------------------------------------
export async function getQAWorkspaceData() {
  const user = await requireUser();

  let assignedProducts: Array<{
    id: string;
    name: string;
    sku: string;
    factoryId: string;
  }> = [];

  if (user.role === "qa") {
    assignedProducts = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        factoryId: products.factoryId,
      })
      .from(products)
      .innerJoin(qaAssignments, eq(products.id, qaAssignments.productId))
      .where(and(eq(qaAssignments.qaUserId, user.id), eq(products.active, true)));
  } else {
    // Admin, OM, or FM: allow seeing all active products
    assignedProducts = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        factoryId: products.factoryId,
      })
      .from(products)
      .where(eq(products.active, true));
  }

  const productIds = assignedProducts.map((p) => p.id);
  const factoryIds = Array.from(new Set(assignedProducts.map((p) => p.factoryId)));

  // Available lines in these factories
  const availableLines =
    factoryIds.length > 0
      ? await db
          .select({
            id: lines.id,
            name: lines.name,
            factoryId: lines.factoryId,
          })
          .from(lines)
          .where(and(inArray(lines.factoryId, factoryIds), eq(lines.active, true)))
      : [];

  return {
    user,
    assignedProducts,
    availableLines,
  };
}

// -------------------------------------------------------------
// Create QA Inspection
// -------------------------------------------------------------
const createInspectionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    productId: z.string().min(1, "Product is required"),
    lineId: z.string().min(1, "Line is required"),
    checked: z.number().int().min(1, "Checked quantity must be at least 1"),
    defects: z.number().int().min(0, "Defects cannot be negative"),
    note: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
  })
  .strict()
  .refine((data) => data.defects <= data.checked, {
    message: "Defects cannot exceed total quantity checked",
    path: ["defects"],
  });

export async function createQAInspectionAction(rawInput: unknown) {
  const user = await requireUser();

  const parsed = createInspectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { date, productId, lineId, checked, defects, note } = parsed.data;

  // Authorization check
  const allowed = await can(user, "record_inspection", {
    type: "qa_inspection",
    productId,
  });

  if (!allowed && user.role === "qa") {
    return {
      success: false,
      error: "Forbidden: You are not assigned to inspect this product",
    };
  }

  try {
    const inspectionId = `qa_${Date.now()}`;
    await db.insert(qaInspections).values({
      id: inspectionId,
      date,
      productId,
      lineId,
      checked,
      defects,
      note: note?.trim() || null,
      createdBy: user.id,
    });

    revalidatePath("/qa");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    console.error("Create inspection error:", err);
    return { success: false, error: "Failed to record QA inspection" };
  }
}

// -------------------------------------------------------------
// Get QA Inspections History
// -------------------------------------------------------------
export async function getQAInspectionsHistory() {
  const user = await requireUser();

  const query = db
    .select({
      id: qaInspections.id,
      date: qaInspections.date,
      checked: qaInspections.checked,
      defects: qaInspections.defects,
      note: qaInspections.note,
      createdAt: qaInspections.createdAt,
      productName: products.name,
      productSku: products.sku,
      lineName: lines.name,
    })
    .from(qaInspections)
    .innerJoin(products, eq(qaInspections.productId, products.id))
    .innerJoin(lines, eq(qaInspections.lineId, lines.id));

  if (user.role === "qa") {
    return await query
      .where(eq(qaInspections.createdBy, user.id))
      .orderBy(desc(qaInspections.date), desc(qaInspections.createdAt))
      .limit(50);
  }

  return await query
    .orderBy(desc(qaInspections.date), desc(qaInspections.createdAt))
    .limit(50);
}
