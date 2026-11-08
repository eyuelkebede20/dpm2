"use server";

import { z } from "zod";
import { requireUser, can } from "@/lib/authz";
import { Role } from "@/lib/rbac";
import { db } from "@/db";
import { industryProfile, users, accounts, factories, sessions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";

// -------------------------------------------------------------
// Industry Profile
// -------------------------------------------------------------
const updateIndustryProfileSchema = z
  .object({
    companyName: z.string().min(1, "Company name is required").max(100),
    workingDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "At least one working day must be selected"),
    units: z.string().min(1, "Units is required").max(20),
    calendarSystem: z.enum(["ethiopian", "gregorian"]).default("ethiopian"),
  })
  .strict();

export async function getIndustryProfile() {
  const user = await requireUser();
  const allowed = await can(user, "read", { type: "industry_profile" });
  if (!allowed) throw new Error("Forbidden: Insufficient permissions");

  let [profile] = await db
    .select()
    .from(industryProfile)
    .where(eq(industryProfile.id, "default"))
    .limit(1);

  if (!profile) {
    [profile] = await db
      .insert(industryProfile)
      .values({
        id: "default",
        companyName: "Daily Production Manager",
        workingDays: [1, 2, 3, 4, 5, 6],
        units: "pcs",
        calendarSystem: "ethiopian",
      })
      .returning();
  }

  return profile;
}

export async function updateIndustryProfileAction(rawInput: unknown) {
  const user = await requireUser();
  const allowed = await can(user, "update", { type: "industry_profile" });
  if (!allowed) return { success: false, error: "Forbidden: Only Sys Admin can update settings" };

  const parsed = updateIndustryProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { companyName, workingDays, units, calendarSystem } = parsed.data;

  try {
    await db
      .insert(industryProfile)
      .values({
        id: "default",
        companyName,
        workingDays,
        units,
        calendarSystem,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: industryProfile.id,
        set: {
          companyName,
          workingDays,
          units,
          calendarSystem,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/admin");
    revalidatePath("/calendar");
    revalidatePath("/entry");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update industry profile:", err);
    return { success: false, error: "Database error updating profile" };
  }
}

// -------------------------------------------------------------
// Operation Managers Management
// -------------------------------------------------------------
const createOMSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(12, "Temporary password must be at least 12 characters")
      .max(128),
  })
  .strict();

export async function getOperationManagers() {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    throw new Error("Forbidden");
  }

  const oms = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "om"))
    .orderBy(desc(users.createdAt));

  return oms;
}

export async function getAllUsersForAdmin() {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    throw new Error("Forbidden");
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return allUsers;
}

const createUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(12, "Temporary password must be at least 12 characters")
      .max(128),
    role: z.enum(["sys_admin", "om", "fm", "qa"]),
  })
  .strict();

export async function createUserAction(rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only Sys Admin can create users" };
  }

  const parsed = createUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { name, email, password, role } = parsed.data;

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "A user with this email already exists" };
    }

    const newUserId = `usr_${role}_${Date.now()}`;
    const hashedPassword = await hashPassword(password);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: newUserId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        active: true,
        mustChangePassword: true,
        createdBy: user.id,
      });

      await tx.insert(accounts).values({
        id: `acc_${newUserId}`,
        accountId: newUserId,
        providerId: "credential",
        userId: newUserId,
        password: hashedPassword,
      });
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to create user:", err);
    return { success: false, error: "Failed to create user" };
  }
}

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["sys_admin", "om", "fm", "qa"]),
});

export async function updateUserRoleAction(userId: string, newRole: Role) {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only Sys Admin can assign system roles" };
  }

  // Prevent admin from removing their own sys_admin role to prevent lock out
  if (user.id === userId && newRole !== "sys_admin") {
    return { success: false, error: "Cannot demote your own Sys Admin account" };
  }

  const parsed = updateRoleSchema.safeParse({ userId, role: newRole });
  if (!parsed.success) {
    return { success: false, error: "Invalid role specified" };
  }

  try {
    await db
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId));

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update user role:", err);
    return { success: false, error: "Failed to update user role" };
  }
}

export async function createOperationManagerAction(rawInput: unknown) {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only Sys Admin can create Operation Managers" };
  }

  const parsed = createOMSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "A user with this email already exists" };
    }

    const newUserId = `usr_om_${Date.now()}`;
    const hashedPassword = await hashPassword(password);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: newUserId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: "om",
        active: true,
        mustChangePassword: true,
        createdBy: user.id,
      });

      await tx.insert(accounts).values({
        id: `acc_${newUserId}`,
        accountId: newUserId,
        providerId: "credential",
        userId: newUserId,
        password: hashedPassword,
      });
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to create OM:", err);
    return { success: false, error: "Failed to create Operation Manager" };
  }
}

export async function toggleUserActiveAction(userId: string, active: boolean) {
  const user = await requireUser();
  if (user.role !== "sys_admin") {
    return { success: false, error: "Forbidden" };
  }

  try {
    await db
      .update(users)
      .set({ active, updatedAt: new Date() })
      .where(eq(users.id, userId));

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to toggle user status:", err);
    return { success: false, error: "Failed to update user status" };
  }
}

// -------------------------------------------------------------
// Admin Password Reset
// -------------------------------------------------------------
const adminResetPasswordSchema = z
  .object({
    userId: z.string().min(1, "User ID is required"),
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters long")
      .max(128, "Password is too long"),
    mustChangePassword: z.boolean().default(true),
  })
  .strict();

export async function adminResetPasswordAction(rawInput: unknown) {
  const admin = await requireUser();
  if (admin.role !== "sys_admin") {
    return { success: false, error: "Forbidden: Only Sys Admin can reset user passwords" };
  }

  const parsed = adminResetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { userId, newPassword, mustChangePassword } = parsed.data;

  try {
    const [targetUser] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.transaction(async (tx) => {
      // 1. Update or create credentials account
      const [existingAccount] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.providerId, "credential")
          )
        )
        .limit(1);

      if (existingAccount) {
        await tx
          .update(accounts)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, existingAccount.id));
      } else {
        await tx.insert(accounts).values({
          id: `acc_${userId}_${Date.now()}`,
          accountId: userId,
          providerId: "credential",
          userId,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // 2. Set mustChangePassword flag on user record
      await tx
        .update(users)
        .set({
          mustChangePassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // 3. Invalidate active sessions for target user
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Password for ${targetUser.name} (${targetUser.email}) reset successfully.`,
    };
  } catch (err: any) {
    console.error("Admin reset password error:", err);
    return { success: false, error: "Failed to reset password. Please try again." };
  }
}

// -------------------------------------------------------------
// Dev Impersonation Helper
// -------------------------------------------------------------
export async function getImpersonationCandidates() {
  const user = await requireUser();
  if (user.role !== "sys_admin") return [];

  const isDev = process.env.NODE_ENV !== "production";
  const enabled = process.env.ENABLE_DEV_IMPERSONATION === "true";
  if (!isDev || !enabled) return [];

  const candidates = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.active, true)))
    .orderBy(users.role, users.name);

  return candidates.filter((c) => ["om", "fm"].includes(c.role));
}
