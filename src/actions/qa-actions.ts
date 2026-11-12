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
  reportEntries,
  downtimeReasons,
  users,
  qaApprovals,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------
export interface QAEntryItem {
  id: string; // report_entry_id
  date: string;
  lineId: string;
  lineName: string;
  productId: string;
  productName: string;
  productSku: string;
  factoryId: string;
  factoryName: string;
  finishedGood: number;
  rework: number;
  reject: number;
  scrap: number;
  wip: number;
  downtimeMinutes: number;
  issueNote: string | null;
  downtimeReasonCode?: string | null;
  downtimeReasonName?: string | null;
  downtimeReasonNameAm?: string | null;
  reporterName?: string | null;
  updatedAt: Date | string;
  status: "pending" | "approved" | "rejected";
  qaApprovalId?: string | null;
  qaNote?: string | null;
  qaReviewerName?: string | null;
  qaReviewedAt?: Date | string | null;
}

// -------------------------------------------------------------
// Get QA Entries For Approval (What Factory Managers Input)
// -------------------------------------------------------------
export async function getQAEntriesAction(): Promise<{
  success: boolean;
  entries: QAEntryItem[];
  userRole: string;
  error?: string;
}> {
  const user = await requireUser();

  try {
    // 1. Get user's factory affiliations
    const userFactories = await db
      .select({ factoryId: factoryUsers.factoryId })
      .from(factoryUsers)
      .where(eq(factoryUsers.userId, user.id));
    const userFactoryIds = userFactories.map((f) => f.factoryId);

    // 2. If QA, get specific product assignments
    let assignedProductIds: string[] = [];
    if (user.role === "qa") {
      const userAssignments = await db
        .select({ productId: qaAssignments.productId })
        .from(qaAssignments)
        .where(eq(qaAssignments.qaUserId, user.id));
      assignedProductIds = userAssignments.map((a) => a.productId);
    }

    const qaReviewerUser = alias(users, "qa_reviewer_user");

    const rows = await db
      .select({
        id: reportEntries.id,
        date: reportEntries.date,
        lineId: reportEntries.lineId,
        lineName: lines.name,
        productId: reportEntries.productId,
        productName: products.name,
        productSku: products.sku,
        factoryId: lines.factoryId,
        factoryName: factories.name,
        finishedGood: reportEntries.finishedGood,
        rework: reportEntries.rework,
        reject: reportEntries.reject,
        scrap: reportEntries.scrap,
        wip: reportEntries.wip,
        downtimeMinutes: reportEntries.downtimeMinutes,
        issueNote: reportEntries.issueNote,
        downtimeReasonCode: downtimeReasons.code,
        downtimeReasonName: downtimeReasons.nameEn,
        downtimeReasonNameAm: downtimeReasons.nameAm,
        reporterName: users.name,
        updatedAt: reportEntries.updatedAt,
        qaApprovalId: qaApprovals.id,
        status: qaApprovals.status,
        qaNote: qaApprovals.note,
        qaReviewerName: qaReviewerUser.name,
        qaReviewedAt: qaApprovals.updatedAt,
      })
      .from(reportEntries)
      .innerJoin(lines, eq(reportEntries.lineId, lines.id))
      .innerJoin(products, eq(reportEntries.productId, products.id))
      .innerJoin(factories, eq(lines.factoryId, factories.id))
      .leftJoin(downtimeReasons, eq(reportEntries.downtimeReasonId, downtimeReasons.id))
      .leftJoin(users, eq(reportEntries.updatedBy, users.id))
      .leftJoin(qaApprovals, eq(reportEntries.id, qaApprovals.reportEntryId))
      .leftJoin(qaReviewerUser, eq(qaApprovals.qaUserId, qaReviewerUser.id))
      .orderBy(desc(reportEntries.date), desc(reportEntries.updatedAt))
      .limit(200);

    // Filter scoped to QA product assignments / factory
    const filtered = rows.filter((r) => {
      if (user.role === "sys_admin") return true;
      if (user.role === "om") return true;
      if (user.role === "qa") {
        if (assignedProductIds.length > 0) {
          return assignedProductIds.includes(r.productId);
        }
        if (userFactoryIds.length > 0) {
          return userFactoryIds.includes(r.factoryId);
        }
        return true;
      }
      if (userFactoryIds.length > 0) {
        return userFactoryIds.includes(r.factoryId);
      }
      return true;
    });

    const entries: QAEntryItem[] = filtered.map((r) => ({
      id: r.id,
      date: r.date,
      lineId: r.lineId,
      lineName: r.lineName,
      productId: r.productId,
      productName: r.productName,
      productSku: r.productSku,
      factoryId: r.factoryId,
      factoryName: r.factoryName,
      finishedGood: r.finishedGood,
      rework: r.rework,
      reject: r.reject,
      scrap: r.scrap,
      wip: r.wip,
      downtimeMinutes: r.downtimeMinutes,
      issueNote: r.issueNote,
      downtimeReasonCode: r.downtimeReasonCode,
      downtimeReasonName: r.downtimeReasonName,
      downtimeReasonNameAm: r.downtimeReasonNameAm,
      reporterName: r.reporterName,
      updatedAt: r.updatedAt,
      status: (r.status as "approved" | "rejected") || "pending",
      qaApprovalId: r.qaApprovalId,
      qaNote: r.qaNote,
      qaReviewerName: r.qaReviewerName,
      qaReviewedAt: r.qaReviewedAt,
    }));

    return {
      success: true,
      entries,
      userRole: user.role,
    };
  } catch (err: any) {
    console.error("getQAEntriesAction error:", err);
    return {
      success: false,
      entries: [],
      userRole: user.role,
      error: err.message || "Failed to load QA entries",
    };
  }
}

// -------------------------------------------------------------
// Review QA Entry Action (Approve / Reject)
// -------------------------------------------------------------
const reviewEntrySchema = z.object({
  reportEntryId: z.string().min(1, "Report entry ID is required"),
  status: z.enum(["approved", "rejected"]),
  note: z.string().max(500, "Note cannot exceed 500 characters").optional().nullable(),
});

export async function reviewQAEntryAction(rawInput: unknown) {
  const user = await requireUser();
  if (!["qa", "om", "sys_admin"].includes(user.role)) {
    return {
      success: false,
      error: "Forbidden: Only QA, OM, or Admin can review production entries",
    };
  }

  const parsed = reviewEntrySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { reportEntryId, status, note } = parsed.data;

  try {
    const existing = await db
      .select({ id: qaApprovals.id })
      .from(qaApprovals)
      .where(eq(qaApprovals.reportEntryId, reportEntryId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(qaApprovals)
        .set({
          status,
          note: note?.trim() || null,
          qaUserId: user.id,
          updatedAt: new Date(),
        })
        .where(eq(qaApprovals.id, existing[0].id));
    } else {
      const approvalId = `qapp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.insert(qaApprovals).values({
        id: approvalId,
        reportEntryId,
        status,
        note: note?.trim() || null,
        qaUserId: user.id,
      });
    }

    revalidatePath("/qa");
    revalidatePath("/dashboard");
    revalidatePath("/entry");
    revalidatePath("/om");
    revalidatePath("/calendar");
    return { success: true };
  } catch (err: any) {
    console.error("reviewQAEntryAction error:", err);
    return { success: false, error: "Failed to record QA decision" };
  }
}

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
    revalidatePath("/entry");
    revalidatePath("/om");
    revalidatePath("/calendar");
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
