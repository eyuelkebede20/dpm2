import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/authz";

export async function GET() {
  const { user } = await getSessionContext();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
