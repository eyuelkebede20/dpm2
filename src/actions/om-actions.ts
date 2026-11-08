"use server";

import { z } from "zod";
import { requireUser, can } from "@/lib/authz";
import { db } from "@/db";
import {
  factories,
  users,
  accounts,
  factoryUsers,
  products,
  qaAssignments,
  specialDays,
  downtimeReasons,
} from "@/db/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";

// -------------------------------------------------------------
// Factories Management
// -------------------------------------------------------------
const createFactorySchema = z
  .object({
    name: z.string().min(2, "Factory name must be at least 2 characters").max(100),
  })
  .strict();

export async function getOMFactories() {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    throw new Error("Forbidden");
  }

  const query = db
    .select({
      id: factories.id,
      name: factories.name,
      omId: factories.omId,
      active: factories.active,
      createdAt: factories.createdAt,
    })
    .from(factories);

  if (user.role === "om") {
    return await query.where(eq(factories.omId, user.id)).orderBy(desc(factories.createdAt));
  }

  return await query.orderBy(desc(factories.createdAt));
}

export async function createFactoryAction(rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only OM can create factories" };
  }

  const parsed = createFactorySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  try {
    const factoryId = `fac_${Date.now()}`;
    await db.insert(factories).values({
      id: factoryId,
      name: parsed.data.name.trim(),
      omId: user.id,
      active: true,
    });

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Create factory error:", err);
    return { success: false, error: "Failed to create factory" };
  }
}

// -------------------------------------------------------------
// User Management (FM & QA)
// -------------------------------------------------------------
const provisionUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(12, "Temporary password must be at least 12 characters")
      .max(128),
    role: z.enum(["fm", "qa"]),
    factoryId: z.string().min(1, "Factory must be selected"),
  })
  .strict();

export async function getOMUsers() {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    throw new Error("Forbidden");
  }

  // Get factories belonging to this OM
  const myFactories = await getOMFactories();
  const factoryIds = myFactories.map((f) => f.id);

  if (factoryIds.length === 0) {
    return [];
  }

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      factoryId: factoryUsers.factoryId,
      factoryName: factories.name,
    })
    .from(users)
    .innerJoin(factoryUsers, eq(users.id, factoryUsers.userId))
    .innerJoin(factories, eq(factoryUsers.factoryId, factories.id))
    .where(inArray(factoryUsers.factoryId, factoryIds))
    .orderBy(desc(users.createdAt));

  return results;
}

export async function provisionFactoryUserAction(rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  const parsed = provisionUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { name, email, password, role, factoryId } = parsed.data;

  // Verify factory ownership if OM
  if (user.role === "om") {
    const [factory] = await db
      .select({ id: factories.id })
      .from(factories)
      .where(and(eq(factories.id, factoryId), eq(factories.omId, user.id)))
      .limit(1);

    if (!factory) {
      return { success: false, error: "Invalid factory or unauthorized" };
    }
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "User with this email already exists" };
    }

    const newUserId = `usr_${role}_${Date.now()}`;
    const hashedPassword = await hashPassword(password);

    await db.transaction(async (tx) => {
      // 1. Create user
      await tx.insert(users).values({
        id: newUserId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        active: true,
        mustChangePassword: true,
        createdBy: user.id,
      });

      // 2. Create account
      await tx.insert(accounts).values({
        id: `acc_${newUserId}`,
        accountId: newUserId,
        providerId: "credential",
        userId: newUserId,
        password: hashedPassword,
      });

      // 3. Link user to factory
      await tx.insert(factoryUsers).values({
        factoryId,
        userId: newUserId,
      });
    });

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Provision factory user failed:", err);
    return { success: false, error: "Failed to provision user" };
  }
}

export async function toggleFactoryUserStatusAction(userId: string, active: boolean) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  try {
    await db
      .update(users)
      .set({ active, updatedAt: new Date() })
      .where(eq(users.id, userId));

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Toggle user error:", err);
    return { success: false, error: "Failed to update user status" };
  }
}

export async function updateFactoryUserRoleAction(userId: string, newRole: "fm" | "qa") {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only OM can reassign factory user roles" };
  }

  if (!["fm", "qa"].includes(newRole)) {
    return { success: false, error: "Invalid role: OM can only assign FM or QA roles" };
  }

  // Ensure target user belongs to a factory owned by this OM (if caller is OM)
  if (user.role === "om") {
    const userFactories = await db
      .select({ factoryId: factoryUsers.factoryId })
      .from(factoryUsers)
      .innerJoin(factories, eq(factories.id, factoryUsers.factoryId))
      .where(and(eq(factoryUsers.userId, userId), eq(factories.omId, user.id)))
      .limit(1);

    if (userFactories.length === 0) {
      return { success: false, error: "Forbidden: Target user is not in your factories" };
    }
  }

  try {
    await db
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId));

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Update factory user role error:", err);
    return { success: false, error: "Failed to update user role" };
  }
}

// -------------------------------------------------------------
// QA Product Assignment Matrix
// -------------------------------------------------------------
export async function getQAProductMatrixData() {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    throw new Error("Forbidden");
  }

  const myFactories = await getOMFactories();
  const factoryIds = myFactories.map((f) => f.id);

  if (factoryIds.length === 0) {
    return { qaUsers: [], productsList: [], assignments: [] };
  }

  // Get QA users in these factories
  const qaUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      factoryId: factoryUsers.factoryId,
      factoryName: factories.name,
    })
    .from(users)
    .innerJoin(factoryUsers, eq(users.id, factoryUsers.userId))
    .innerJoin(factories, eq(factoryUsers.factoryId, factories.id))
    .where(and(eq(users.role, "qa"), inArray(factoryUsers.factoryId, factoryIds)));

  // Get products in these factories
  const productsList = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      factoryId: products.factoryId,
      factoryName: factories.name,
    })
    .from(products)
    .innerJoin(factories, eq(products.factoryId, factories.id))
    .where(and(eq(products.active, true), inArray(products.factoryId, factoryIds)));

  // Get current assignments
  const qaUserIds = qaUsers.map((q) => q.id);
  const assignments =
    qaUserIds.length > 0
      ? await db
          .select({
            qaUserId: qaAssignments.qaUserId,
            productId: qaAssignments.productId,
          })
          .from(qaAssignments)
          .where(inArray(qaAssignments.qaUserId, qaUserIds))
      : [];

  return { qaUsers, productsList, assignments };
}

const toggleQAAssignmentSchema = z
  .object({
    qaUserId: z.string().min(1),
    productId: z.string().min(1),
    assigned: z.boolean(),
  })
  .strict();

export async function toggleQAProductAssignmentAction(rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  const parsed = toggleQAAssignmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: "Invalid payload" };
  }

  const { qaUserId, productId, assigned } = parsed.data;

  try {
    if (assigned) {
      await db
        .insert(qaAssignments)
        .values({ qaUserId, productId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(qaAssignments)
        .where(
          and(
            eq(qaAssignments.qaUserId, qaUserId),
            eq(qaAssignments.productId, productId)
          )
        );
    }

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("QA assignment toggle error:", err);
    return { success: false, error: "Failed to update QA assignment" };
  }
}

// -------------------------------------------------------------
// Special Dates & Yearly Ethiopian Holiday Seeding
// -------------------------------------------------------------

export async function getStandardEthiopianHolidays(year: number) {
  const y = year;
  return [
    {
      date: `${y}-01-07`,
      nameEn: "Ethiopian Christmas (Genna)",
      nameAm: "የገና በዓል",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-01-19`,
      nameEn: "Timkat (Epiphany)",
      nameAm: "ጥምቀት በዓል",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-03-02`,
      nameEn: "Victory of Adwa",
      nameAm: "የዓድዋ ድል በዓል",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-03-20`,
      nameEn: "Eid al-Fitr (End of Ramadan)",
      nameAm: "ዒድ አልፈጥር",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-05-01`,
      nameEn: "International Workers' Day",
      nameAm: "የሠራተኞች ቀን",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-05-05`,
      nameEn: "Patriots' Victory Day",
      nameAm: "የአርበኞች ቀን",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-05-08`,
      nameEn: "Ethiopian Good Friday (Siklet)",
      nameAm: "ስቅለት",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-05-10`,
      nameEn: "Ethiopian Easter (Fasika)",
      nameAm: "ትንሣኤ (ፋሲካ)",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-05-27`,
      nameEn: "Eid al-Adha (Arafa)",
      nameAm: "ዒድ አል አድሃ (አረፋ)",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-05-28`,
      nameEn: "Downfall of Derg Day",
      nameAm: "ደርግ የወደቀበት ቀን",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-08-26`,
      nameEn: "Mawlid (Prophet's Birthday)",
      nameAm: "መውሊድ",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-09-11`,
      nameEn: "Ethiopian New Year (Enkutatash)",
      nameAm: "እንቁጣጣሽ (አዲስ ዓመት)",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
    {
      date: `${y}-09-27`,
      nameEn: "Meskel (Finding of True Cross)",
      nameAm: "መስቀል (ደመራ)",
      type: "holiday",
      isWorkingDay: false,
      year: y,
    },
  ];
}

export async function getOMSpecialDays(year?: number) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    throw new Error("Forbidden");
  }

  try {
    const query = db
      .select({
        id: specialDays.id,
        date: specialDays.date,
        nameEn: specialDays.nameEn,
        nameAm: specialDays.nameAm,
        type: specialDays.type,
        isWorkingDay: specialDays.isWorkingDay,
        year: specialDays.year,
        createdAt: specialDays.createdAt,
      })
      .from(specialDays);

    if (year) {
      return await query.where(eq(specialDays.year, year)).orderBy(asc(specialDays.date));
    }
    return await query.orderBy(asc(specialDays.date));
  } catch (err) {
    console.error("Get special days error:", err);
    return [];
  }
}

export async function seedYearlySpecialDaysAction(rawYear?: unknown) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only OM or Sys Admin can seed holidays" };
  }

  const yearNum = typeof rawYear === "number" ? rawYear : parseInt(String(rawYear || 2026), 10);
  const selectedYear = isNaN(yearNum) ? 2026 : yearNum;

  const holidays = await getStandardEthiopianHolidays(selectedYear);

  try {
    for (const h of holidays) {
      await db
        .insert(specialDays)
        .values({
          id: `sp_${selectedYear}_${h.date.replace(/-/g, "")}`,
          date: h.date,
          nameEn: h.nameEn,
          nameAm: h.nameAm,
          type: h.type,
          isWorkingDay: h.isWorkingDay,
          year: h.year,
        })
        .onConflictDoNothing();
    }

    revalidatePath("/om");
    return { success: true, count: holidays.length, year: selectedYear };
  } catch (err: any) {
    console.error("Seed yearly special days error:", err);
    return { success: false, error: "Failed to seed yearly holidays" };
  }
}

const createSpecialDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  nameEn: z.string().min(2, "English name must be at least 2 characters").max(100),
  nameAm: z.string().max(100).optional().nullable(),
  type: z.enum(["holiday", "shutdown", "custom_off_day", "working_day", "weekend", "custom"]).default("holiday"),
  isWorkingDay: z.boolean().default(false),
});

export async function createSpecialDayAction(rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  const parsed = createSpecialDaySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { date, nameEn, nameAm, type, isWorkingDay } = parsed.data;
  const year = parseInt(date.split("-")[0], 10) || new Date().getFullYear();

  try {
    const id = `sp_custom_${Date.now()}`;
    await db
      .insert(specialDays)
      .values({
        id,
        date,
        nameEn: nameEn.trim(),
        nameAm: (nameAm && nameAm.trim()) || nameEn.trim(),
        type,
        isWorkingDay,
        year,
      })
      .onConflictDoNothing();

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Create special day error:", err);
    return { success: false, error: "Failed to create special day" };
  }
}

export async function deleteSpecialDayAction(id: string) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  try {
    await db.delete(specialDays).where(eq(specialDays.id, id));
    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Delete special day error:", err);
    return { success: false, error: "Failed to delete special day" };
  }
}

// -------------------------------------------------------------
// Downtime & Non-Completion Reason Templates
// -------------------------------------------------------------

const DEFAULT_DOWNTIME_REASONS = [
  {
    code: "DOW-01",
    nameEn: "Machine Breakdown & Mechanical Failure",
    nameAm: "የማሽን ብልሽት እና ሜካኒካል ችግር",
    category: "machine" as const,
    sortOrder: 1,
  },
  {
    code: "DOW-02",
    nameEn: "Power Grid Outage / Generator Failure",
    nameAm: "የመብራት መቆራረጥ / የጄኔሬተር ችግር",
    category: "power" as const,
    sortOrder: 2,
  },
  {
    code: "DOW-03",
    nameEn: "Raw Material Shortage or Infeed Jam",
    nameAm: "የጥሬ ዕቃ እጥረት / የእቃ መዘጋት",
    category: "material" as const,
    sortOrder: 3,
  },
  {
    code: "DOW-04",
    nameEn: "Tooling & Mould Changeover Delay",
    nameAm: "የሻጋታ እና መሣሪያ ለውጥ መዘግየት",
    category: "tooling" as const,
    sortOrder: 4,
  },
  {
    code: "DOW-05",
    nameEn: "Quality Inspection Hold & Calibration",
    nameAm: "የጥራት ምርመራ መቆም እና ካሊብሬሽን",
    category: "quality" as const,
    sortOrder: 5,
  },
  {
    code: "DOW-06",
    nameEn: "Safety Incident / Emergency Drill",
    nameAm: "የደህንነት ክስተት / ድንገተኛ ልምምድ",
    category: "safety" as const,
    sortOrder: 6,
  },
  {
    code: "DOW-07",
    nameEn: "Shift Handover & Operator Absence",
    nameAm: "የሺፍት ለውጥ እና የሠራተኛ አለመኖር",
    category: "other" as const,
    sortOrder: 7,
  },
];

const downtimeReasonSchema = z.object({
  code: z.string().min(2, "Code must be at least 2 characters").max(20),
  nameEn: z.string().min(2, "English name is required").max(100),
  nameAm: z.string().max(100).optional().nullable(),
  category: z.enum([
    "tooling",
    "machine",
    "power",
    "material",
    "quality",
    "safety",
    "other",
  ]),
  active: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function getOMDowntimeReasons() {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    throw new Error("Forbidden");
  }

  try {
    const list = await db
      .select({
        id: downtimeReasons.id,
        code: downtimeReasons.code,
        nameEn: downtimeReasons.nameEn,
        nameAm: downtimeReasons.nameAm,
        category: downtimeReasons.category,
        isActive: downtimeReasons.isActive,
        sortOrder: downtimeReasons.sortOrder,
        createdAt: downtimeReasons.createdAt,
        updatedAt: downtimeReasons.updatedAt,
      })
      .from(downtimeReasons)
      .orderBy(asc(downtimeReasons.code));

    if (list.length === 0) {
      for (const d of DEFAULT_DOWNTIME_REASONS) {
        await db
          .insert(downtimeReasons)
          .values({
            id: `dtr_${d.code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
            code: d.code,
            nameEn: d.nameEn,
            nameAm: d.nameAm,
            category: d.category,
            isActive: true,
            sortOrder: d.sortOrder,
          })
          .onConflictDoNothing();
      }

      const seededList = await db
        .select({
          id: downtimeReasons.id,
          code: downtimeReasons.code,
          nameEn: downtimeReasons.nameEn,
          nameAm: downtimeReasons.nameAm,
          category: downtimeReasons.category,
          isActive: downtimeReasons.isActive,
          sortOrder: downtimeReasons.sortOrder,
          createdAt: downtimeReasons.createdAt,
          updatedAt: downtimeReasons.updatedAt,
        })
        .from(downtimeReasons)
        .orderBy(asc(downtimeReasons.code));

      return seededList.map((r) => ({
        ...r,
        active: r.isActive,
      }));
    }

    return list.map((r) => ({
      ...r,
      active: r.isActive,
    }));
  } catch (err) {
    console.error("Get downtime reasons error:", err);
    return [];
  }
}

export async function createDowntimeReasonAction(rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  const parsed = downtimeReasonSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { code, nameEn, nameAm, category, active, isActive } = parsed.data;
  const isAct = active !== undefined ? active : (isActive !== undefined ? isActive : true);

  try {
    const id = `dtr_${code.trim().toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    await db.insert(downtimeReasons).values({
      id,
      code: code.trim().toUpperCase(),
      nameEn: nameEn.trim(),
      nameAm: (nameAm && nameAm.trim()) || nameEn.trim(),
      category: category as any,
      isActive: isAct,
    });

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Create downtime reason error:", err);
    return { success: false, error: "Failed to create downtime reason" };
  }
}

export async function toggleDowntimeReasonActiveAction(id: string, active?: boolean) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  try {
    if (active !== undefined) {
      await db
        .update(downtimeReasons)
        .set({ isActive: active, updatedAt: new Date() })
        .where(eq(downtimeReasons.id, id));
    } else {
      const [current] = await db
        .select({ isActive: downtimeReasons.isActive })
        .from(downtimeReasons)
        .where(eq(downtimeReasons.id, id))
        .limit(1);

      if (current) {
        await db
          .update(downtimeReasons)
          .set({ isActive: !current.isActive, updatedAt: new Date() })
          .where(eq(downtimeReasons.id, id));
      }
    }

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Toggle downtime reason error:", err);
    return { success: false, error: "Failed to toggle downtime reason status" };
  }
}

export async function updateDowntimeReasonAction(id: string, rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "om" && user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  const parsed = downtimeReasonSchema.partial().safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  try {
    const updateData: any = { updatedAt: new Date() };
    if (parsed.data.code) updateData.code = parsed.data.code.trim().toUpperCase();
    if (parsed.data.nameEn) updateData.nameEn = parsed.data.nameEn.trim();
    if (parsed.data.nameAm !== undefined) {
      updateData.nameAm = parsed.data.nameAm ? parsed.data.nameAm.trim() : parsed.data.nameEn;
    }
    if (parsed.data.category) updateData.category = parsed.data.category;
    if (parsed.data.active !== undefined) updateData.isActive = parsed.data.active;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    await db.update(downtimeReasons).set(updateData).where(eq(downtimeReasons.id, id));

    revalidatePath("/om");
    return { success: true };
  } catch (err: any) {
    console.error("Update downtime reason error:", err);
    return { success: false, error: "Failed to update downtime reason" };
  }
}


