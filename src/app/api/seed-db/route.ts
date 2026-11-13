import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Helper to enforce Sys Admin authorization or SEED_API_SECRET
 */
async function authorizeSeeding(
  request: NextRequest
): Promise<{ authorized: boolean; error?: string; status?: number }> {
  // 1. Strictly block in production environments
  if (process.env.NODE_ENV === "production") {
    return {
      authorized: false,
      error: "Database seeding endpoint is disabled in production environments.",
      status: 403,
    };
  }

  // 2. Allow with explicit SEED_API_SECRET header (for local CI/CD automated setup)
  const authHeader = request.headers.get("authorization");
  const seedSecret = process.env.SEED_API_SECRET;
  if (
    seedSecret &&
    authHeader &&
    authHeader.startsWith("Bearer ") &&
    authHeader.slice(7) === seedSecret
  ) {
    return { authorized: true };
  }

  // 3. Otherwise require authenticated sys_admin session
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) {
      return {
        authorized: false,
        error: "Unauthorized: Authentication required",
        status: 401,
      };
    }
    if ((session.user as any).role !== "sys_admin") {
      return {
        authorized: false,
        error: "Forbidden: Sys Admin access required",
        status: 403,
      };
    }
    return { authorized: true };
  } catch {
    return {
      authorized: false,
      error: "Unauthorized: Authentication required",
      status: 401,
    };
  }
}

/**
 * GET /api/seed-db
 * Returns initialization status (counts only, zero user PII exposure)
 */
export async function GET(request: NextRequest) {
  const authCheck = await authorizeSeeding(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: authCheck.status || 403 }
    );
  }

  try {
    const existingUsers = await db.select({ id: users.id }).from(users);

    return NextResponse.json({
      success: true,
      initialized: existingUsers.length > 0,
      existingUsersCount: existingUsers.length,
      message:
        existingUsers.length > 0
          ? "Database is initialized. Send POST /api/seed-db with { reset: true } to re-seed."
          : "Database is empty. Send POST /api/seed-db to seed initial dataset.",
    });
  } catch (error) {
    console.error("Seeding API GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check database initialization status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/seed-db
 * Executes database seeding. Requires POST and Sys Admin authorization.
 */
export async function POST(request: NextRequest) {
  const authCheck = await authorizeSeeding(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: authCheck.status || 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const reset = body.reset === true;

    // Check if database already has users
    const existingUsers = await db.select({ id: users.id }).from(users);

    if (existingUsers.length > 0 && !reset) {
      return NextResponse.json({
        success: true,
        message:
          "Database already initialized. Pass { reset: true } in POST body to re-seed.",
        existingUsersCount: existingUsers.length,
      });
    }

    const result = await seedDatabase({ reset: true });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Seeding API POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal seeding error",
      },
      { status: 500 }
    );
  }
}
