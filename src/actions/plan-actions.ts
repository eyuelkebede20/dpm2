"use server";

import { z } from "zod";
import { requireUser, can } from "@/lib/authz";
import { db } from "@/db";
import {
  factories,
  factoryUsers,
  lines,
  products,
  plans,
  reportEntries,
  industryProfile,
} from "@/db/schema";
import { eq, ne, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logSecurityEvent } from "@/lib/security";

export interface PlanItemWithPlant {
  id: string;
  factoryId: string;
  factoryName: string;
  lineId: string;
  lineName: string;
  productId: string;
  productName: string;
  productSku: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  plannedQty: number;
  initialPlannedQty: number;
  weeklyPlanned: number;
  totalProduced: number;
  leftFromWeeklyPlanned: number;
  createdAt: Date;
}

/**
 * Fetch plans across factories with role scoping.
 * - OM: all factories owned by the OM or filtered by targetFactoryId
 * - FM: restricted to FM's assigned factory
 * - Sys Admin: all factories or filtered by targetFactoryId
 */
export async function getProductionPlansAction(targetFactoryId?: string): Promise<{
  success: boolean;
  data?: PlanItemWithPlant[];
  calendarSystem?: "ethiopian" | "gregorian";
  canManagePlans?: boolean;
  error?: string;
}> {
  try {
    const user = await requireUser();

    // Retrieve company profile for calendar system
    const [profile] = await db
      .select({ calendarSystem: industryProfile.calendarSystem })
      .from(industryProfile)
      .where(eq(industryProfile.id, "default"))
      .limit(1);

    const calendarSystem = (profile?.calendarSystem as "ethiopian" | "gregorian") || "ethiopian";
    const canManagePlans = user.role === "om" || user.role === "sys_admin";

    let factoryIds: string[] = [];

    if (user.role === "fm") {
      const [assoc] = await db
        .select({ factoryId: factoryUsers.factoryId })
        .from(factoryUsers)
        .where(eq(factoryUsers.userId, user.id))
        .limit(1);

      if (!assoc) {
        return { success: true, data: [], calendarSystem, canManagePlans: false };
      }
      factoryIds = [assoc.factoryId];
    } else if (user.role === "om") {
      if (targetFactoryId && targetFactoryId !== "all") {
        factoryIds = [targetFactoryId];
      } else {
        const omFactories = await db
          .select({ id: factories.id })
          .from(factories)
          .where(eq(factories.omId, user.id));
        factoryIds = omFactories.map((f) => f.id);
      }
    } else if (user.role === "sys_admin") {
      if (targetFactoryId && targetFactoryId !== "all") {
        factoryIds = [targetFactoryId];
      } else {
        const allFactories = await db.select({ id: factories.id }).from(factories);
        factoryIds = allFactories.map((f) => f.id);
      }
    }

    if (factoryIds.length === 0) {
      return { success: true, data: [], calendarSystem, canManagePlans };
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
      .where(sql`${lines.factoryId} IN ${factoryIds}`)
      .orderBy(desc(plans.startDate));

    // Cumulative produced quantities within the plan window
    const allEntries = await db
      .select({
        lineId: reportEntries.lineId,
        productId: reportEntries.productId,
        date: reportEntries.date,
        finishedGood: reportEntries.finishedGood,
      })
      .from(reportEntries);

    const formattedPlans: PlanItemWithPlant[] = rawPlans.map((p) => {
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

    return {
      success: true,
      data: formattedPlans,
      calendarSystem,
      canManagePlans,
    };
  } catch (err: any) {
    console.error("getProductionPlansAction error:", err);
    return { success: false, error: err.message || "Failed to load production plans" };
  }
}

const createPlanSchema = z
  .object({
    lineId: z.string().min(1, "Line is required"),
    productId: z.string().min(1, "Product is required"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format (YYYY-MM-DD)"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format (YYYY-MM-DD)"),
    plannedQty: z.number().int().positive("Planned quantity must be greater than 0"),
    factoryId: z.string().optional(),
  })
  .strict()
  .refine((data) => data.startDate <= data.endDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function createPlanAction(rawInput: unknown) {
  const user = await requireUser();

  // Strict role check: Factory Managers cannot create production plans
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

  // Resolve factoryId from line
  const [lineRecord] = await db
    .select({ factoryId: lines.factoryId })
    .from(lines)
    .where(eq(lines.id, lineId))
    .limit(1);

  const factoryId = parsed.data.factoryId || lineRecord?.factoryId;

  const allowed = await can(user, "create", {
    type: "plan",
    factoryId,
  });
  if (!allowed) return { success: false, error: "Forbidden" };

  try {
    // Enforce business rule: only one plan per product allowed
    const [existingProductPlan] = await db
      .select({ id: plans.id, lineId: plans.lineId })
      .from(plans)
      .where(eq(plans.productId, productId))
      .limit(1);

    if (existingProductPlan) {
      return {
        success: false,
        error: "A production plan already exists for this product. Only one plan per product is allowed. Please edit or delete the existing plan.",
      };
    }

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

    revalidatePath("/planning");
    revalidatePath("/fm");
    revalidatePath("/calendar");
    revalidatePath("/om");
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

  // Strict role check: Factory Managers cannot edit production plans
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

  // Resolve factoryId from line
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
    // Enforce business rule: only one plan per product allowed
    const [existingProductPlan] = await db
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.productId, productId), ne(plans.id, id)))
      .limit(1);

    if (existingProductPlan) {
      return {
        success: false,
        error: "Another production plan already exists for this product. Only one plan per product is allowed.",
      };
    }

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

    revalidatePath("/planning");
    revalidatePath("/fm");
    revalidatePath("/calendar");
    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Update plan error:", err);
    return { success: false, error: "Failed to update production plan" };
  }
}

export async function deletePlanAction(id: string) {
  const user = await requireUser();

  if (user.role === "fm") {
    return {
      success: false,
      error: "Forbidden: Factory Managers cannot delete production plans.",
    };
  }

  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  try {
    const [planRecord] = await db
      .select({ id: plans.id, lineId: plans.lineId })
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);

    if (!planRecord) {
      return { success: false, error: "Plan not found" };
    }

    const [lineRecord] = await db
      .select({ factoryId: lines.factoryId })
      .from(lines)
      .where(eq(lines.id, planRecord.lineId))
      .limit(1);

    const factoryId = lineRecord?.factoryId;
    const allowed = await can(user, "delete", {
      type: "plan",
      factoryId,
    });

    if (!allowed) {
      logSecurityEvent({
        event: "BOLA_ATTEMPT_BLOCKED",
        userId: user.id,
        details: { action: "deletePlan", planId: id, factoryId },
      });
      return {
        success: false,
        error: "Forbidden: You do not have permission to delete plans for this factory",
      };
    }

    await db.delete(plans).where(eq(plans.id, id));
    revalidatePath("/planning");
    revalidatePath("/fm");
    revalidatePath("/calendar");
    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Delete plan error:", err);
    return { success: false, error: "Failed to delete production plan" };
  }
}
