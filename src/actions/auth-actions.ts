"use server";

import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { db } from "@/db";
import { users, accounts, sessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { redirect } from "next/navigation";

const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters long")
      .max(128, "Password is too long"),
    confirmPassword: z
      .string()
      .min(12, "Confirm password must be at least 12 characters long"),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export async function changePasswordAction(formData: unknown) {
  const user = await requireUser();

  const parseResult = changePasswordSchema.safeParse(formData);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.errors[0]?.message || "Invalid input data",
    };
  }

  const { newPassword } = parseResult.data;

  try {
    const hashedPassword = await hashPassword(newPassword);

    await db.transaction(async (tx) => {
      // 1. Update account password
      await tx
        .update(accounts)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accounts.userId, user.id),
            eq(accounts.providerId, "credential")
          )
        );

      // 2. Mark mustChangePassword as false
      await tx
        .update(users)
        .set({
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    });

    return { success: true };
  } catch (err: any) {
    console.error("Change password error:", err);
    return {
      success: false,
      error: "Failed to update password. Please try again.",
    };
  }
}
