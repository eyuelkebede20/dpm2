import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";
import { createSysAdminDevToken, setSysAdminDevCookie } from "@/lib/dev-token";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, canSwitchRole } = await getSessionContext();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // If authenticated as sys_admin, ensure dev token cookie is active
  if (user.role === "sys_admin") {
    const token = createSysAdminDevToken({ id: user.id, email: user.email });
    await setSysAdminDevCookie(token);
  }

  return NextResponse.json({
    authenticated: true,
    canSwitchRole,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
