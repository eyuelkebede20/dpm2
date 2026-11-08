"use server";

import { db } from "@/db";
import { reportEntries, stockLedger, lines, products } from "@/db/schema";
import { requireUser, can } from "@/lib/authz";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const saveReportEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  lineId: z.string().min(1),
  productId: z.string().min(1),
  finishedGood: z.number().int().nonnegative("Finished goods must be non-negative"),
  rework: z.number().int().nonnegative("Rework must be non-negative").default(0),
  reject: z.number().int().nonnegative("Reject must be non-negative").default(0),
  scrap: z.number().int().nonnegative("Scrap must be non-negative").default(0),
  wip: z.number().int().nonnegative("WIP must be non-negative").default(0),
  downtimeMinutes: z.number().int().nonnegative("Downtime must be non-negative").default(0),
  issueNote: z.string().nullable().optional(),
});

export type SaveReportEntryInput = z.infer<typeof saveReportEntrySchema>;

export async function saveDailyReportEntry(rawInput: SaveReportEntryInput) {
  const user = await requireUser();

  const validated = saveReportEntrySchema.parse(rawInput);

  // Retrieve line to determine factory and check authorization
  const [line] = await db
    .select({ id: lines.id, factoryId: lines.factoryId })
    .from(lines)
    .where(eq(lines.id, validated.lineId))
    .limit(1);

  if (!line) {
    throw new Error("Line not found");
  }

  const allowed = await can(user, "record_entry", {
    type: "report_entry",
    factoryId: line.factoryId,
    lineId: line.id,
    productId: validated.productId,
  });

  if (!allowed) {
    throw new Error("Unauthorized to record report for this line/factory");
  }

  // Execute within a single database transaction
  return await db.transaction(async (tx) => {
    // 1. Check if report entry already exists for (date, lineId, productId)
    const [existing] = await tx
      .select()
      .from(reportEntries)
      .where(
        and(
          eq(reportEntries.date, validated.date),
          eq(reportEntries.lineId, validated.lineId),
          eq(reportEntries.productId, validated.productId)
        )
      )
      .limit(1);

    let reportEntryId = existing?.id;
    let delta = 0;

    if (existing) {
      delta = validated.finishedGood - existing.finishedGood;

      await tx
        .update(reportEntries)
        .set({
          finishedGood: validated.finishedGood,
          rework: validated.rework,
          reject: validated.reject,
          scrap: validated.scrap,
          wip: validated.wip,
          downtimeMinutes: validated.downtimeMinutes,
          issueNote: validated.issueNote || null,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(reportEntries.id, existing.id));
    } else {
      reportEntryId = `rep_${validated.date}_${validated.lineId}_${validated.productId}`;
      delta = validated.finishedGood;

      await tx.insert(reportEntries).values({
        id: reportEntryId,
        date: validated.date,
        lineId: validated.lineId,
        productId: validated.productId,
        finishedGood: validated.finishedGood,
        rework: validated.rework,
        reject: validated.reject,
        scrap: validated.scrap,
        wip: validated.wip,
        downtimeMinutes: validated.downtimeMinutes,
        issueNote: validated.issueNote || null,
        updatedBy: user.id,
      });
    }

    // 2. Automatically record delta into stock_ledger if delta !== 0
    if (delta !== 0) {
      await tx.insert(stockLedger).values({
        id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        factoryId: line.factoryId,
        productId: validated.productId,
        delta,
        reportEntryId,
      });
    }

    return {
      success: true,
      reportEntryId,
      deltaRecorded: delta,
    };
  });
}

/**
 * Bulk save for the daily entry grid screen.
 */
export async function saveDailyReportBatch(entries: SaveReportEntryInput[]) {
  const results = [];
  for (const entry of entries) {
    const res = await saveDailyReportEntry(entry);
    results.push(res);
  }
  return { success: true, count: results.length };
}
