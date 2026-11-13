import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SessionUser } from "./authz";

export const SYSADMIN_DEV_TOKEN_COOKIE = "dpm_dev_sysadmin_token";

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return "dpm-development-fallback-secret-for-sysadmin-dev-tokens-at-least-32-chars";
    }
    throw new Error("BETTER_AUTH_SECRET environment variable is missing");
  }
  return secret;
}

/**
 * Creates an HMAC-SHA256 signed developer token tying the browser session
 * to the authenticated System Administrator.
 */
export function createSysAdminDevToken(adminUser: { id: string; email: string }): string {
  const secret = getSecret();
  const timestamp = Date.now();
  const payload = `${adminUser.id}:${adminUser.email}:${timestamp}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Verifies a developer token.
 * Validates HMAC signature, confirms user still exists in PostgreSQL,
 * is active, and possesses the 'sys_admin' role.
 */
export async function verifySysAdminDevToken(token: string): Promise<SessionUser | null> {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const lastDotIndex = token.lastIndexOf(".");
  const payload = token.slice(0, lastDotIndex);
  const signature = token.slice(lastDotIndex + 1);

  const secret = getSecret();
  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  const parts = payload.split(":");
  if (parts.length < 3) return null;
  const [adminUserId] = parts;

  try {
    const [adminUserRecord] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
      })
      .from(users)
      .where(eq(users.id, adminUserId))
      .limit(1);

    if (
      !adminUserRecord ||
      !adminUserRecord.active ||
      adminUserRecord.role !== "sys_admin"
    ) {
      return null;
    }

    return {
      id: adminUserRecord.id,
      name: adminUserRecord.name,
      email: adminUserRecord.email,
      role: "sys_admin",
      active: adminUserRecord.active,
      mustChangePassword: false,
    };
  } catch (err) {
    console.error("verifySysAdminDevToken database error:", err);
    return null;
  }
}

/**
 * Helper to set the sysadmin dev token cookie on a response or cookie store.
 */
export async function setSysAdminDevCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SYSADMIN_DEV_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days until sysadmin logs out or clears cookie
    });
  } catch (err) {
    // If called in a context where cookies cannot be set (e.g. Server Component render)
  }
}

/**
 * Clears the sysadmin dev token cookie upon logout or manual reset.
 */
export async function clearSysAdminDevCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SYSADMIN_DEV_TOKEN_COOKIE);
  } catch (err) {
    // No-op
  }
}
