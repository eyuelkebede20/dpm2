"use server";

import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { db } from "@/db";
import {
  dailyReportReviews,
  notifications,
  factories,
  users,
  plans,
  industryProfile,
  specialDays,
} from "@/db/schema";
import { eq, and, desc, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { countWorkingDays } from "@/lib/target";
import { logSecurityEvent } from "@/lib/security";

const markReviewedSchema = z
  .object({
    factoryId: z.string().min(1, "Factory ID is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    note: z.string().max(500, "Note too long").optional().nullable(),
  })
  .strict();

/**
 * Operation Manager marks a factory daily report as reviewed.
 */
export async function markDailyReportReviewedAction(rawInput: unknown) {
  const user = await requireUser();

  if (user.role !== "om" && user.role !== "sys_admin") {
    return {
      success: false,
      error: "Forbidden: Only Operation Managers or Sys Admins can review reports",
    };
  }

  const parsed = markReviewedSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid input",
    };
  }

  const { factoryId, date, note } = parsed.data;

  // Verify factory ownership if OM
  if (user.role === "om") {
    const [factory] = await db
      .select({ id: factories.id, omId: factories.omId })
      .from(factories)
      .where(eq(factories.id, factoryId))
      .limit(1);

    if (!factory || factory.omId !== user.id) {
      return {
        success: false,
        error: "Forbidden: You are not assigned as the Operation Manager for this factory",
      };
    }
  }

  try {
    const reviewId = `rev_${factoryId}_${date}`;
    const now = new Date();

    // 1. Check if review record exists and update or insert using primary key
    const [existing] = await db
      .select({ id: dailyReportReviews.id })
      .from(dailyReportReviews)
      .where(
        and(
          eq(dailyReportReviews.factoryId, factoryId),
          eq(dailyReportReviews.date, date)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(dailyReportReviews)
        .set({
          status: "reviewed",
          reviewedBy: user.id,
          reviewedAt: now,
          note: note || null,
          updatedAt: now,
        })
        .where(eq(dailyReportReviews.id, existing.id));
    } else {
      await db
        .insert(dailyReportReviews)
        .values({
          id: reviewId,
          factoryId,
          date,
          status: "reviewed",
          reviewedBy: user.id,
          reviewedAt: now,
          note: note || null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: dailyReportReviews.id,
          set: {
            status: "reviewed",
            reviewedBy: user.id,
            reviewedAt: now,
            note: note || null,
            updatedAt: now,
          },
        });
    }

    // 2. Mark any related report notifications for this factory and date as read
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.factoryId, factoryId),
          eq(notifications.reportDate, date),
          eq(notifications.userId, user.id)
        )
      );

    revalidatePath("/entry");
    revalidatePath("/dashboard");

    return {
      success: true,
      review: {
        id: reviewId,
        factoryId,
        date,
        status: "reviewed",
        reviewedBy: user.id,
        reviewerName: user.name,
        reviewedAt: now.toISOString(),
        note: note || null,
      },
    };
  } catch (err: any) {
    console.error("Mark report reviewed error:", err);
    return {
      success: false,
      error: err.message || "Failed to mark report as reviewed",
    };
  }
}

/**
 * Operation Manager un-marks a report (sets back to pending).
 */
export async function unmarkDailyReportReviewedAction(rawInput: unknown) {
  const user = await requireUser();

  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  const parsed = markReviewedSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { factoryId, date } = parsed.data;

  // Verify factory ownership if OM (OWASP A01: BOLA Prevention)
  if (user.role === "om") {
    const [factory] = await db
      .select({ id: factories.id, omId: factories.omId })
      .from(factories)
      .where(eq(factories.id, factoryId))
      .limit(1);

    if (!factory || factory.omId !== user.id) {
      logSecurityEvent({
        event: "BOLA_ATTEMPT_BLOCKED",
        userId: user.id,
        details: { action: "revokeDailyReportReview", factoryId },
      });
      return {
        success: false,
        error: "Forbidden: You are not assigned as the Operation Manager for this factory",
      };
    }
  }

  try {
    await db
      .delete(dailyReportReviews)
      .where(
        and(
          eq(dailyReportReviews.factoryId, factoryId),
          eq(dailyReportReviews.date, date)
        )
      );

    revalidatePath("/entry");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to unmark review" };
  }
}

/**
 * Fetch notifications for current user.
 */
export async function getNotificationsAction() {
  const user = await requireUser();

  try {
    const list = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        type: notifications.type,
        link: notifications.link,
        factoryId: notifications.factoryId,
        reportDate: notifications.reportDate,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    const enriched = list.map((n) => {
      const displayName =
        n.title.replace(/^New Production Report:\s*/i, "").trim() || "Daily Report";
      let value = n.message || "";
      let isPositive = true;

      if (value.startsWith("+") || value.startsWith("-")) {
        isPositive = !value.startsWith("-");
      } else {
        value = "+0 pcs";
        isPositive = true;
      }

      return {
        ...n,
        factoryName: displayName,
        value,
        isPositive,
      };
    });

    const unreadCount = enriched.filter((n) => !n.isRead).length;

    return {
      success: true,
      notifications: enriched,
      unreadCount,
    };
  } catch (err: any) {
    return {
      success: false,
      notifications: [],
      unreadCount: 0,
      error: err.message,
    };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationReadAction(notificationId: string) {
  const user = await requireUser();

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, user.id)
        )
      );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsReadAction() {
  const user = await requireUser();

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, user.id));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

const reviewItemSchema = z
  .object({
    factoryId: z.string().min(1, "Factory ID is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    lineId: z.string().min(1, "Line ID is required"),
    productId: z.string().min(1, "Product ID is required"),
    status: z.enum(["approved", "denied"]),
    note: z.string().max(500, "Note too long").optional().nullable(),
  })
  .strict();

/**
 * Operation Manager approves or denies a specific line/product daily report item.
 */
export async function reviewItemAction(rawInput: unknown) {
  const user = await requireUser();

  if (user.role !== "om" && user.role !== "sys_admin") {
    return {
      success: false,
      error: "Forbidden: Only Operation Managers or Sys Admins can review items",
    };
  }

  const parsed = reviewItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid input",
    };
  }

  const { factoryId, date, lineId, productId, status, note } = parsed.data;

  // Verify factory ownership if OM
  if (user.role === "om") {
    const [factory] = await db
      .select({ id: factories.id, omId: factories.omId })
      .from(factories)
      .where(eq(factories.id, factoryId))
      .limit(1);

    if (!factory || factory.omId !== user.id) {
      return {
        success: false,
        error: "Forbidden: You are not assigned as the Operation Manager for this factory",
      };
    }
  }

  try {
    const reviewId = `rev_${factoryId}_${date}`;
    const now = new Date();
    const itemKey = `${lineId}_${productId}`;

    // Fetch existing review record if any
    const [existing] = await db
      .select()
      .from(dailyReportReviews)
      .where(
        and(
          eq(dailyReportReviews.factoryId, factoryId),
          eq(dailyReportReviews.date, date)
        )
      )
      .limit(1);

    const existingItems = existing?.itemReviews || {};
    const updatedItems = {
      ...existingItems,
      [itemKey]: {
        status,
        note: note || null,
        reviewedAt: now.toISOString(),
      },
    };

    if (existing) {
      await db
        .update(dailyReportReviews)
        .set({
          itemReviews: updatedItems,
          reviewedBy: user.id,
          updatedAt: now,
        })
        .where(eq(dailyReportReviews.id, existing.id));
    } else {
      await db
        .insert(dailyReportReviews)
        .values({
          id: reviewId,
          factoryId,
          date,
          status: "reviewed",
          reviewedBy: user.id,
          reviewedAt: now,
          note: null,
          itemReviews: updatedItems,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: dailyReportReviews.id,
          set: {
            itemReviews: updatedItems,
            reviewedBy: user.id,
            updatedAt: now,
          },
        });
    }

    revalidatePath("/entry");
    revalidatePath("/dashboard");
    revalidatePath("/om");

    return {
      success: true,
      itemReview: updatedItems[itemKey],
    };
  } catch (err: any) {
    console.error("Review item error:", err);
    return {
      success: false,
      error: err.message || "Failed to record item review",
    };
  }
}

const updateDailyPlanSchema = z
  .object({
    factoryId: z.string().min(1, "Factory ID is required"),
    lineId: z.string().min(1, "Line ID is required"),
    productId: z.string().min(1, "Product ID is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    planId: z.string().optional().nullable(),
    newDailyTarget: z.number().int().min(1, "Daily target must be at least 1").optional(),
    newPlannedQty: z.number().int().min(1, "Planned quantity must be at least 1").optional(),
  })
  .strict();

/**
 * Operation Manager updates the daily plan / target for a line + product.
 * Automatically recalculates and updates the annual/periodic plan planned quantity,
 * preserving initialPlannedQty so the baseline initial set and edited plan are side-by-side.
 */
export async function updateDailyPlanAction(rawInput: unknown) {
  const user = await requireUser();

  if (user.role !== "om" && user.role !== "sys_admin") {
    return {
      success: false,
      error: "Forbidden: Only Operation Managers or Sys Admins can edit daily plans",
    };
  }

  const parsed = updateDailyPlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid input",
    };
  }

  const { factoryId, lineId, productId, date, planId, newDailyTarget, newPlannedQty } = parsed.data;

  // Verify factory ownership if OM
  if (user.role === "om") {
    const [factory] = await db
      .select({ id: factories.id, omId: factories.omId })
      .from(factories)
      .where(eq(factories.id, factoryId))
      .limit(1);

    if (!factory || factory.omId !== user.id) {
      return {
        success: false,
        error: "Forbidden: You are not assigned as the Operation Manager for this factory",
      };
    }
  }

  try {
    const [profile] = await db.select().from(industryProfile).limit(1);
    const workingDays = profile?.workingDays || [1, 2, 3, 4, 5, 6];
    const specialDaysList = await db.select().from(specialDays);

    let targetPlan = null;
    if (planId) {
      const [p] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
      targetPlan = p || null;
    }

    if (!targetPlan) {
      const [p] = await db
        .select()
        .from(plans)
        .where(
          and(
            eq(plans.lineId, lineId),
            eq(plans.productId, productId),
            lte(plans.startDate, date),
            gte(plans.endDate, date)
          )
        )
        .limit(1);
      targetPlan = p || null;
    }

    const currentYear = new Date(date).getFullYear() || 2026;

    if (targetPlan) {
      const totalWorkingDays = Math.max(
        1,
        countWorkingDays(targetPlan.startDate, targetPlan.endDate, workingDays, specialDaysList)
      );

      let finalPlannedQty = newPlannedQty;
      if (!finalPlannedQty && newDailyTarget) {
        finalPlannedQty = Math.max(1, Math.round(newDailyTarget * totalWorkingDays));
      } else if (!finalPlannedQty) {
        finalPlannedQty = targetPlan.plannedQty;
      }

      const initialSet = targetPlan.initialPlannedQty ?? targetPlan.plannedQty;

      await db
        .update(plans)
        .set({
          plannedQty: finalPlannedQty,
          initialPlannedQty: initialSet,
        })
        .where(eq(plans.id, targetPlan.id));

      revalidatePath("/entry");
      revalidatePath("/fm");
      revalidatePath("/calendar");
      revalidatePath("/dashboard");

      return {
        success: true,
        plan: {
          id: targetPlan.id,
          startDate: targetPlan.startDate,
          endDate: targetPlan.endDate,
          initialPlannedQty: initialSet,
          plannedQty: finalPlannedQty,
          dailyTarget: Math.round(finalPlannedQty / totalWorkingDays),
        },
      };
    } else {
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;
      const totalWorkingDays = Math.max(
        1,
        countWorkingDays(startDate, endDate, workingDays, specialDaysList)
      );

      let finalPlannedQty = newPlannedQty;
      if (!finalPlannedQty && newDailyTarget) {
        finalPlannedQty = Math.max(1, Math.round(newDailyTarget * totalWorkingDays));
      } else if (!finalPlannedQty) {
        finalPlannedQty = 26000;
      }

      const newId = `plan_${lineId}_${productId}_${Date.now()}`;
      await db.insert(plans).values({
        id: newId,
        lineId,
        productId,
        startDate,
        endDate,
        plannedQty: finalPlannedQty,
        initialPlannedQty: finalPlannedQty,
      });

      revalidatePath("/entry");
      revalidatePath("/fm");
      revalidatePath("/calendar");
      revalidatePath("/dashboard");

      return {
        success: true,
        plan: {
          id: newId,
          startDate,
          endDate,
          initialPlannedQty: finalPlannedQty,
          plannedQty: finalPlannedQty,
          dailyTarget: Math.round(finalPlannedQty / totalWorkingDays),
        },
      };
    }
  } catch (err: any) {
    console.error("Update daily plan error:", err);
    return {
      success: false,
      error: err.message || "Failed to update daily plan",
    };
  }
}
