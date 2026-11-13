import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { auth } from "@/lib/auth";

const DEFAULT_ROUTES: Record<string, string> = {
  sys_admin: "/admin",
  om: "/om",
  fm: "/entry",
  qa: "/qa",
};

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { enabled: false, error: "Dev role switcher is strictly disabled in production" },
      { status: 403 }
    );
  }

  try {
    // Strict Access Control: Only authenticated sys_admin can view dev user list
    let currentUser = null;
    try {
      const reqHeaders = await headers();
      const session = await auth.api.getSession({ headers: reqHeaders });
      if (session?.user) {
        currentUser = {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: (session.user as any).role || "qa",
        };
      }
    } catch {}

    if (!currentUser || currentUser.role !== "sys_admin") {
      return NextResponse.json(
        { enabled: false, error: "Forbidden: Only authenticated System Administrators can access developer switch role" },
        { status: 403 }
      );
    }

    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
      })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(users.role, users.name);

    return NextResponse.json({
      enabled: true,
      currentUser,
      users: allUsers,
    });
  } catch (err: any) {
    console.error("Failed to load dev users:", err);
    return NextResponse.json({ error: "Failed to load dev users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Dev role switcher is strictly disabled in production" },
      { status: 403 }
    );
  }

  try {
    // Strict Access Control: Only authenticated sys_admin can switch developer roles
    let callerRole: string | null = null;
    try {
      const reqHeaders = await headers();
      const session = await auth.api.getSession({ headers: reqHeaders });
      if (session?.user) {
        callerRole = (session.user as any).role || null;
      }
    } catch {}

    if (callerRole !== "sys_admin") {
      return NextResponse.json(
        { error: "Forbidden: Only authenticated System Administrators can switch developer roles" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { role, userId, targetRoute } = body;

    let targetUser = null;

    if (userId) {
      const [found] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      targetUser = found;
    } else if (role) {
      // Find the first active user with this role
      const [found] = await db
        .select()
        .from(users)
        .where(and(eq(users.role, role), eq(users.active, true)))
        .orderBy(desc(users.createdAt))
        .limit(1);
      targetUser = found;
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: `No active user found for ${userId || role}` },
        { status: 404 }
      );
    }

    // Generate secure session token and session record
    const token = crypto.randomBytes(24).toString("base64url");
    const sessionId = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(sessions).values({
      id: sessionId,
      token,
      userId: targetUser.id,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: req.headers.get("user-agent") || "dev-role-switcher",
    });

    // Better Auth signs cookies using HMAC SHA-256 with BETTER_AUTH_SECRET
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      throw new Error("BETTER_AUTH_SECRET environment variable is missing");
    }
    const signature = crypto
      .createHmac("sha256", secret)
      .update(token)
      .digest("base64");
    const signedToken = `${token}.${signature}`;

    // Set cookie on response
    const cookieStore = await cookies();
    cookieStore.set("dpm.session_token", signedToken, {
      httpOnly: true,
      secure: (process.env.NODE_ENV as string) === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    // Clear any previous impersonation cookie
    cookieStore.delete("dpm_impersonate_user_id");

    const destination = targetRoute || DEFAULT_ROUTES[targetUser.role] || "/dashboard";

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
      redirectTo: destination,
    });
  } catch (err: any) {
    console.error("Dev switch-role error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to switch role" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Dev role switcher is strictly disabled in production" },
      { status: 403 }
    );
  }
  try {
    const cookieStore = await cookies();
    cookieStore.delete("dpm.session_token");
    cookieStore.delete("dpm_impersonate_user_id");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Dev logout error:", err);
    return NextResponse.json({ error: "Failed to clear session" }, { status: 500 });
  }
}
