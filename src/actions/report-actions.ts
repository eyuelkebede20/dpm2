"use server";

import { z } from "zod";
import { requireUser, can } from "@/lib/authz";
import { db } from "@/db";
import {
  reportEntries,
  stockLedger,
  lines,
  products,
  factoryUsers,
  factories,
  notifications,
  plans,
  industryProfile,
} from "@/db/schema";
import { eq, and, inArray, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calculateDailyTarget } from "@/lib/target";
import { isReportMonthPassed } from "@/lib/ethiopian-calendar";

const saveDailyEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    lineId: z.string().min(1, "Line ID is required"),
    productId: z.string().min(1, "Product ID is required"),
    finishedGood: z.number().int().min(0, "Finished good must be non-negative"),
    rework: z.number().int().min(0, "Rework must be non-negative").default(0),
    reject: z.number().int().min(0, "Reject must be non-negative").default(0),
    scrap: z.number().int().min(0, "Scrap must be non-negative").default(0),
    wip: z.number().int().min(0, "WIP must be non-negative").default(0),
    downtimeMinutes: z.number().int().min(0, "Downtime must be non-negative").default(0),
    issueNote: z.string().max(500, "Issue note too long").optional().nullable(),
    downtimeReasonId: z.string().optional().nullable(),
  })
  .strict();

export async function saveDailyReportEntryAction(rawInput: unknown) {
  const user = await requireUser();

  if (user.role !== "fm" && user.role !== "sys_admin") {
    return {
      success: false,
      error: "Forbidden: Only Factory Managers can input daily numbers. Operation Managers have review permissions only.",
    };
  }

  const parsed = saveDailyEntrySchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid input data",
    };
  }

  const data = parsed.data;

  // Verify line belongs to user factory
  const [line] = await db
    .select({ factoryId: lines.factoryId })
    .from(lines)
    .where(eq(lines.id, data.lineId))
    .limit(1);

  if (!line) {
    return { success: false, error: "Production line not found" };
  }

  const allowed = await can(user, "record_entry", {
    type: "report_entry",
    factoryId: line.factoryId,
    lineId: data.lineId,
    productId: data.productId,
  });

  if (!allowed) {
    return { success: false, error: "Forbidden: Not authorized to enter reports for this line" };
  }

  // Strict enforcement: Factory Managers can only alter reports of that month (after that month has passed, they can't)
  if (user.role === "fm") {
    let calendarSystem: "ethiopian" | "gregorian" = "ethiopian";
    try {
      const [profile] = await db
        .select({ calendarSystem: industryProfile.calendarSystem })
        .from(industryProfile)
        .where(eq(industryProfile.id, "default"))
        .limit(1);
      if (profile?.calendarSystem) {
        calendarSystem = profile.calendarSystem as "ethiopian" | "gregorian";
      }
    } catch {
      calendarSystem = "ethiopian";
    }

    if (isReportMonthPassed(data.date, calendarSystem)) {
      return {
        success: false,
        error:
          "Forbidden: Factory Managers can only alter reports of the active month. The reporting window for this month has closed.",
      };
    }
  }

  try {
    const entryId = `rep_${data.date}_${data.lineId}_${data.productId}`;

    await db.transaction(async (tx) => {
      // 1. Fetch existing entry if any to calculate delta
      const [existing] = await tx
        .select({
          id: reportEntries.id,
          finishedGood: reportEntries.finishedGood,
        })
        .from(reportEntries)
        .where(
          and(
            eq(reportEntries.date, data.date),
            eq(reportEntries.lineId, data.lineId),
            eq(reportEntries.productId, data.productId)
          )
        )
        .limit(1);

      const oldFinishedGood = existing ? existing.finishedGood : 0;
      const stockDelta = data.finishedGood - oldFinishedGood;

      // Strict enforcement: Factory Managers are restricted to one data entry per day
      if (existing && user.role === "fm") {
        throw new Error(
          "Only one data entry is permitted per day. The daily entry for this date has already been recorded."
        );
      }

      // 2. Upsert report entry
      await tx
        .insert(reportEntries)
        .values({
          id: entryId,
          date: data.date,
          lineId: data.lineId,
          productId: data.productId,
          finishedGood: data.finishedGood,
          rework: data.rework,
          reject: data.reject,
          scrap: data.scrap,
          wip: data.wip,
          downtimeMinutes: data.downtimeMinutes,
          issueNote: data.issueNote || null,
          downtimeReasonId: data.downtimeReasonId || null,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [reportEntries.date, reportEntries.lineId, reportEntries.productId],
          set: {
            finishedGood: data.finishedGood,
            rework: data.rework,
            reject: data.reject,
            scrap: data.scrap,
            wip: data.wip,
            downtimeMinutes: data.downtimeMinutes,
            issueNote: data.issueNote || null,
            downtimeReasonId: data.downtimeReasonId || null,
            updatedBy: user.id,
            updatedAt: new Date(),
          },
        });

      // 3. If finished good changed, atomically write the difference to stock_ledger
      if (stockDelta !== 0) {
        await tx.insert(stockLedger).values({
          id: `stk_${entryId}_${Date.now()}`,
          factoryId: line.factoryId,
          productId: data.productId,
          delta: stockDelta,
          reportEntryId: entryId,
          createdAt: new Date(),
        });
      }
    });

    // 4. Notify factory's OM about new daily report needing review
    try {
      const [factory] = await db
        .select({ id: factories.id, name: factories.name, omId: factories.omId })
        .from(factories)
        .where(eq(factories.id, line.factoryId))
        .limit(1);

      if (factory && factory.omId && factory.omId !== user.id) {
        // Compute daily total FG & variance for this factory on data.date
        let varianceStr = `+${data.finishedGood.toLocaleString()} pcs`;
        try {
          const factoryLines = await db
            .select({ id: lines.id })
            .from(lines)
            .where(eq(lines.factoryId, factory.id));
          const lineIds = factoryLines.map((l) => l.id);

          if (lineIds.length > 0) {
            const dayEntries = await db
              .select({ finishedGood: reportEntries.finishedGood })
              .from(reportEntries)
              .where(
                and(
                  eq(reportEntries.date, data.date),
                  inArray(reportEntries.lineId, lineIds)
                )
              );
            const totalFG = dayEntries.reduce((s, e) => s + (e.finishedGood || 0), 0);

            const activePlans = await db
              .select({
                plannedQty: plans.plannedQty,
                startDate: plans.startDate,
                endDate: plans.endDate,
              })
              .from(plans)
              .where(
                and(
                  inArray(plans.lineId, lineIds),
                  lte(plans.startDate, data.date),
                  gte(plans.endDate, data.date)
                )
              );

            let totalTarget = 0;
            let hasTarget = false;
            for (const p of activePlans) {
              const res = calculateDailyTarget(p, data.date);
              if (res.hasTarget) {
                totalTarget += res.dailyTarget;
                hasTarget = true;
              }
            }

            if (hasTarget) {
              const variance = totalFG - totalTarget;
              varianceStr =
                variance >= 0
                  ? `+${Math.round(variance).toLocaleString()} pcs`
                  : `${Math.round(variance).toLocaleString()} pcs`;
            } else {
              varianceStr = `+${totalFG.toLocaleString()} pcs`;
            }
          }
        } catch {
          varianceStr = `+${data.finishedGood.toLocaleString()} pcs`;
        }

        const notifId = `notif_${factory.id}_${data.date}_${factory.omId}`;
        await db
          .insert(notifications)
          .values({
            id: notifId,
            userId: factory.omId,
            title: factory.name,
            message: varianceStr,
            type: "report_submitted",
            link: `/entry?date=${data.date}`,
            factoryId: factory.id,
            reportDate: data.date,
            isRead: false,
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: notifications.id,
            set: {
              title: factory.name,
              message: varianceStr,
              isRead: false,
              createdAt: new Date(),
            },
          });
      }
    } catch (notifErr) {
      console.warn("Notification dispatch non-fatal error:", notifErr);
    }

    revalidatePath("/fm/store");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/entry");

    return { success: true };
  } catch (err: any) {
    console.error("Atomic report entry mutation error:", err);
    return {
      success: false,
      error: err.message || "Failed to save daily production entry",
    };
  }
}

const saveDailyReportBatchSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    entries: z
      .array(
        z.object({
          lineId: z.string().min(1, "Line ID is required"),
          productId: z.string().min(1, "Product ID is required"),
          finishedGood: z.number().int().min(0, "Finished good must be non-negative"),
          rework: z.number().int().min(0, "Rework must be non-negative").default(0),
          reject: z.number().int().min(0, "Reject must be non-negative").default(0),
          scrap: z.number().int().min(0, "Scrap must be non-negative").default(0),
          wip: z.number().int().min(0, "WIP must be non-negative").default(0),
          downtimeMinutes: z.number().int().min(0, "Downtime must be non-negative").default(0),
          issueNote: z.string().max(500, "Issue note too long").optional().nullable(),
          downtimeReasonId: z.string().optional().nullable(),
        })
      )
      .min(1, "At least one production line entry is required"),
  })
  .strict();

export async function saveDailyReportBatchAction(rawInput: unknown) {
  const user = await requireUser();

  if (user.role !== "fm" && user.role !== "sys_admin") {
    return {
      success: false,
      error: "Forbidden: Only Factory Managers can input daily numbers. Operation Managers have review permissions only.",
    };
  }

  const parsed = saveDailyReportBatchSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid input data",
    };
  }

  const data = parsed.data;
  const lineIds = Array.from(new Set(data.entries.map((e) => e.lineId)));

  const factoryLines = await db
    .select({ id: lines.id, factoryId: lines.factoryId })
    .from(lines)
    .where(inArray(lines.id, lineIds));

  if (factoryLines.length === 0) {
    return { success: false, error: "Production lines not found" };
  }

  const factoryId = factoryLines[0].factoryId;

  // Verify permission for each line
  for (const entry of data.entries) {
    const line = factoryLines.find((l) => l.id === entry.lineId);
    if (!line) {
      return { success: false, error: `Production line ${entry.lineId} not found` };
    }
    const allowed = await can(user, "record_entry", {
      type: "report_entry",
      factoryId: line.factoryId,
      lineId: entry.lineId,
      productId: entry.productId,
    });
    if (!allowed) {
      return {
        success: false,
        error: "Forbidden: Not authorized to enter reports for these lines",
      };
    }
  }

  // Strict check: Factory Managers cannot submit multiple times for the same date (1 entry per day)
  // and can only alter reports of the active month (after that month has passed, they can't)
  if (user.role === "fm") {
    let calendarSystem: "ethiopian" | "gregorian" = "ethiopian";
    try {
      const [profile] = await db
        .select({ calendarSystem: industryProfile.calendarSystem })
        .from(industryProfile)
        .where(eq(industryProfile.id, "default"))
        .limit(1);
      if (profile?.calendarSystem) {
        calendarSystem = profile.calendarSystem as "ethiopian" | "gregorian";
      }
    } catch {
      calendarSystem = "ethiopian";
    }

    if (isReportMonthPassed(data.date, calendarSystem)) {
      return {
        success: false,
        error:
          "Forbidden: Factory Managers can only alter reports of the active month. The reporting window for this month has closed.",
      };
    }

    const existingEntries = await db
      .select({ id: reportEntries.id })
      .from(reportEntries)
      .where(
        and(
          eq(reportEntries.date, data.date),
          inArray(reportEntries.lineId, lineIds)
        )
      )
      .limit(1);

    if (existingEntries.length > 0) {
      return {
        success: false,
        error:
          "Only one data entry is permitted per day. The daily entry for this date has already been recorded.",
      };
    }
  }

  try {
    await db.transaction(async (tx) => {
      for (const entry of data.entries) {
        const line = factoryLines.find((l) => l.id === entry.lineId)!;
        const entryId = `rep_${data.date}_${entry.lineId}_${entry.productId}`;

        const [existing] = await tx
          .select({
            id: reportEntries.id,
            finishedGood: reportEntries.finishedGood,
          })
          .from(reportEntries)
          .where(
            and(
              eq(reportEntries.date, data.date),
              eq(reportEntries.lineId, entry.lineId),
              eq(reportEntries.productId, entry.productId)
            )
          )
          .limit(1);

        const oldFinishedGood = existing ? existing.finishedGood : 0;
        const stockDelta = entry.finishedGood - oldFinishedGood;

        await tx
          .insert(reportEntries)
          .values({
            id: entryId,
            date: data.date,
            lineId: entry.lineId,
            productId: entry.productId,
            finishedGood: entry.finishedGood,
            rework: entry.rework,
            reject: entry.reject,
            scrap: entry.scrap,
            wip: entry.wip,
            downtimeMinutes: entry.downtimeMinutes,
            issueNote: entry.issueNote || null,
            downtimeReasonId: entry.downtimeReasonId || null,
            updatedBy: user.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [reportEntries.date, reportEntries.lineId, reportEntries.productId],
            set: {
              finishedGood: entry.finishedGood,
              rework: entry.rework,
              reject: entry.reject,
              scrap: entry.scrap,
              wip: entry.wip,
              downtimeMinutes: entry.downtimeMinutes,
              issueNote: entry.issueNote || null,
              downtimeReasonId: entry.downtimeReasonId || null,
              updatedBy: user.id,
              updatedAt: new Date(),
            },
          });

        if (stockDelta !== 0) {
          await tx.insert(stockLedger).values({
            id: `stk_${entryId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            factoryId: line.factoryId,
            productId: entry.productId,
            delta: stockDelta,
            reportEntryId: entryId,
            createdAt: new Date(),
          });
        }
      }
    });

    // Notify factory OM
    try {
      const [factory] = await db
        .select({ id: factories.id, name: factories.name, omId: factories.omId })
        .from(factories)
        .where(eq(factories.id, factoryId))
        .limit(1);

      if (factory && factory.omId && factory.omId !== user.id) {
        const notifId = `notif_${factory.id}_${data.date}_${factory.omId}`;
        await db
          .insert(notifications)
          .values({
            id: notifId,
            userId: factory.omId,
            title: `New Production Report: ${factory.name}`,
            message: `Daily report for ${data.date} submitted. 1 data entry recorded, ready for OM review.`,
            type: "report_submitted",
            link: `/entry?date=${data.date}`,
            factoryId: factory.id,
            reportDate: data.date,
            isRead: false,
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: notifications.id,
            set: {
              title: `New Production Report: ${factory.name}`,
              message: `Daily report for ${data.date} submitted. 1 data entry recorded, ready for OM review.`,
              isRead: false,
              createdAt: new Date(),
            },
          });
      }
    } catch (notifErr) {
      console.warn("Notification dispatch non-fatal error:", notifErr);
    }

    revalidatePath("/fm/store");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/entry");

    return { success: true, count: data.entries.length };
  } catch (err: any) {
    console.error("Atomic batch report entry mutation error:", err);
    return {
      success: false,
      error: err.message || "Failed to save daily production entries",
    };
  }
}
