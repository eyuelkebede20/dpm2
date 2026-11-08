"use server";

import { db } from "@/db";
import { downtimeReasons } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getDowntimeReasonsAction(includeInactive: boolean = false) {
  try {
    const baseQuery = db.select().from(downtimeReasons);

    const query = includeInactive
      ? baseQuery
      : baseQuery.where(eq(downtimeReasons.isActive, true));

    const results = await query.orderBy(asc(downtimeReasons.sortOrder), asc(downtimeReasons.code));
    return results;
  } catch (error: any) {
    console.error("Failed to get downtime reasons:", error);
    return [];
  }
}

export async function createDowntimeReasonAction(data: {
  code: string;
  nameEn: string;
  nameAm?: string;
  category?: string;
  sortOrder?: number;
}) {
  try {
    const user = await requireUser();
    if (user.role !== "om" && user.role !== "sys_admin") {
      return { success: false, error: "Forbidden: Only OM or Sys Admin can manage downtime reasons." };
    }

    const code = data?.code?.trim();
    const nameEn = data?.nameEn?.trim();
    if (!code || !nameEn) {
      return { success: false, error: "Code and English name are required." };
    }

    const nameAm = data?.nameAm?.trim() || nameEn;
    const category = data?.category?.trim() || "machine";
    const sortOrder = typeof data?.sortOrder === "number" ? data.sortOrder : 0;

    const [reason] = await db
      .insert(downtimeReasons)
      .values({
        code,
        nameEn,
        nameAm,
        category,
        sortOrder,
        isActive: true,
      })
      .returning();

    try {
      revalidatePath("/dashboard/om");
      revalidatePath("/entry");
    } catch {
      // Safe fallback when executed outside next context
    }

    return { success: true, reason };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to create downtime reason" };
  }
}

export async function updateDowntimeReasonAction(
  id: string,
  data: {
    code?: string;
    nameEn?: string;
    nameAm?: string;
    category?: string;
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  try {
    const user = await requireUser();
    if (user.role !== "om" && user.role !== "sys_admin") {
      return { success: false, error: "Forbidden: Only OM or Sys Admin can manage downtime reasons." };
    }

    if (!id) {
      return { success: false, error: "Reason ID is required." };
    }

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.code !== undefined) updateFields.code = data.code.trim();
    if (data.nameEn !== undefined) updateFields.nameEn = data.nameEn.trim();
    if (data.nameAm !== undefined) updateFields.nameAm = data.nameAm.trim();
    if (data.category !== undefined) updateFields.category = data.category.trim();
    if (data.isActive !== undefined) updateFields.isActive = Boolean(data.isActive);
    if (data.sortOrder !== undefined) updateFields.sortOrder = Number(data.sortOrder);

    await db
      .update(downtimeReasons)
      .set(updateFields)
      .where(eq(downtimeReasons.id, id));

    try {
      revalidatePath("/dashboard/om");
      revalidatePath("/entry");
    } catch {
      // Safe fallback
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to update downtime reason" };
  }
}

export async function toggleDowntimeReasonActiveAction(id: string) {
  try {
    const user = await requireUser();
    if (user.role !== "om" && user.role !== "sys_admin") {
      return { success: false, error: "Forbidden: Only OM or Sys Admin can manage downtime reasons." };
    }

    if (!id) {
      return { success: false, error: "Reason ID is required." };
    }

    const [existing] = await db
      .select()
      .from(downtimeReasons)
      .where(eq(downtimeReasons.id, id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Downtime reason not found." };
    }

    const newActive = !existing.isActive;

    await db
      .update(downtimeReasons)
      .set({
        isActive: newActive,
        updatedAt: new Date(),
      })
      .where(eq(downtimeReasons.id, id));

    try {
      revalidatePath("/dashboard/om");
      revalidatePath("/entry");
    } catch {
      // Safe fallback
    }

    return { success: true, isActive: newActive };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to toggle downtime reason" };
  }
}
