"use server";

import { db } from "@/db";
import { specialDays } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { getEthiopianHolidaysForYear } from "@/lib/ethiopian-holidays";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getSpecialDaysAction(
  year?: number,
  from?: string,
  to?: string
) {
  try {
    const conditions = [];

    if (typeof year === "number" && !isNaN(year)) {
      conditions.push(eq(specialDays.year, year));
    }

    if (from && to) {
      conditions.push(gte(specialDays.date, from));
      conditions.push(lte(specialDays.date, to));
    } else if (from) {
      conditions.push(gte(specialDays.date, from));
    } else if (to) {
      conditions.push(lte(specialDays.date, to));
    }

    let query = db.select().from(specialDays);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(asc(specialDays.date));
    return results;
  } catch (error: any) {
    console.error("Failed to get special days:", error);
    return [];
  }
}

export async function saveSpecialDayAction(data: {
  id?: string;
  date: string;
  nameEn: string;
  nameAm?: string;
  type?: string;
  isWorkingDay?: boolean;
}) {
  try {
    const user = await requireUser();
    if (user.role !== "om" && user.role !== "sys_admin") {
      return { success: false, error: "Forbidden: Only OM or Sys Admin can save special days." };
    }

    const dateStr = data?.date?.trim();
    if (!dateStr || dateStr.length < 10) {
      return { success: false, error: "A valid date (YYYY-MM-DD) is required." };
    }

    const year = parseInt(dateStr.slice(0, 4), 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      return { success: false, error: "Invalid year extracted from date." };
    }

    const nameEn = data?.nameEn?.trim() || data?.nameAm?.trim();
    const nameAm = data?.nameAm?.trim() || data?.nameEn?.trim();

    if (!nameEn || !nameAm) {
      return { success: false, error: "Special day name is required." };
    }

    const type = data?.type?.trim() || "holiday";
    const isWorkingDay = Boolean(data?.isWorkingDay);

    // If id is provided, update by id
    if (data.id) {
      const [updated] = await db
        .update(specialDays)
        .set({
          date: dateStr,
          nameEn,
          nameAm,
          type,
          isWorkingDay,
          year,
          updatedAt: new Date(),
        })
        .where(eq(specialDays.id, data.id))
        .returning();

      if (updated) {
        try {
          revalidatePath("/dashboard/om");
          revalidatePath("/entry");
        } catch {
          // Safe fallback
        }
        return { success: true, specialDay: updated };
      }
    }

    // Insert or upsert on date conflict
    const [specialDay] = await db
      .insert(specialDays)
      .values({
        date: dateStr,
        nameEn,
        nameAm,
        type,
        isWorkingDay,
        year,
      })
      .onConflictDoUpdate({
        target: specialDays.date,
        set: {
          nameEn,
          nameAm,
          type,
          isWorkingDay,
          year,
          updatedAt: new Date(),
        },
      })
      .returning();

    try {
      revalidatePath("/dashboard/om");
      revalidatePath("/entry");
    } catch {
      // Safe fallback
    }

    return { success: true, specialDay };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to save special day" };
  }
}

export async function deleteSpecialDayAction(id: string) {
  try {
    const user = await requireUser();
    if (user.role !== "om" && user.role !== "sys_admin") {
      return { success: false, error: "Forbidden: Only OM or Sys Admin can delete special days." };
    }

    if (!id) {
      return { success: false, error: "Special day ID is required." };
    }

    await db.delete(specialDays).where(eq(specialDays.id, id));

    try {
      revalidatePath("/dashboard/om");
      revalidatePath("/entry");
    } catch {
      // Safe fallback
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to delete special day" };
  }
}

export async function seedYearlySpecialDaysAction(year: number) {
  try {
    const user = await requireUser();
    if (user.role !== "om" && user.role !== "sys_admin") {
      return { success: false, error: "Forbidden: Only OM or Sys Admin can seed holidays." };
    }

    if (!year || isNaN(year)) {
      return { success: false, error: "A valid Gregorian year is required." };
    }

    const holidays = getEthiopianHolidaysForYear(year);
    if (!holidays || holidays.length === 0) {
      return { success: false, error: `No Ethiopian holidays calculated for year ${year}.` };
    }

    const savedHolidays = [];
    for (const h of holidays) {
      const [upserted] = await db
        .insert(specialDays)
        .values({
          date: h.date,
          nameEn: h.nameEn,
          nameAm: h.nameAm,
          type: h.type || "holiday",
          isWorkingDay: h.isWorkingDay ?? false,
          year: h.year || year,
        })
        .onConflictDoUpdate({
          target: specialDays.date,
          set: {
            nameEn: h.nameEn,
            nameAm: h.nameAm,
            type: h.type || "holiday",
            isWorkingDay: h.isWorkingDay ?? false,
            year: h.year || year,
            updatedAt: new Date(),
          },
        })
        .returning();

      savedHolidays.push(upserted || h);
    }

    try {
      revalidatePath("/dashboard/om");
      revalidatePath("/entry");
    } catch {
      // Safe fallback
    }

    return {
      success: true,
      count: savedHolidays.length,
      holidays: savedHolidays,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to seed yearly special days" };
  }
}
