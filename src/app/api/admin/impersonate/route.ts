import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/authz";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const impersonateSchema = z
  .object({
    targetUserId: z.string().min(1),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const caller = await requireUser();

    // Must be Sys Admin
    if (caller.role !== "sys_admin") {
      return NextResponse.json({ error: "Forbidden: Sys Admin only" }, { status: 403 });
    }

    // Must be in Dev mode and enabled
    const isDev = process.env.NODE_ENV !== "production";
    const isEnabled = process.env.ENABLE_DEV_IMPERSONATION === "true";
    if (!isDev || !isEnabled) {
      return NextResponse.json(
        { error: "Dev impersonation is disabled in this environment" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = impersonateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { targetUserId } = parsed.data;

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser || !targetUser.active || !["om", "fm"].includes(targetUser.role)) {
      return NextResponse.json(
        { error: "Target user not found or not eligible for impersonation" },
        { status: 404 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("dpm_impersonate_user_id", targetUserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({ success: true, user: targetUser });
  } catch (err: any) {
    console.error("Impersonation failed:", err);
    return NextResponse.json({ error: "Unauthorized or server error" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    await requireUser();
    const cookieStore = await cookies();
    cookieStore.delete("dpm_impersonate_user_id");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Exit impersonation failed:", err);
    return NextResponse.json({ error: "Unauthorized or server error" }, { status: 401 });
  }
}
