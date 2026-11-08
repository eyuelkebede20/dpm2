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
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
  })
  .strict();

export async function saveDailyReportEntryAction(rawInput: unknown) {
  const user = await requireUser();

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

    revalidatePath("/fm/store");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/entry");

    return { success: true };
  } catch (err: any) {
    console.error("Atomic report entry mutation error:", err);
    return { success: false, error: "Failed to save daily production entry" };
  }
}
