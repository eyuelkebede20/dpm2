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
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
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
