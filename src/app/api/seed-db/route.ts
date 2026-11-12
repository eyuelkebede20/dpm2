import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { seedDatabase } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force =
      searchParams.get("force") === "true" ||
      searchParams.get("reset") === "true";

    // Check if database already has users
    const existingUsers = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users);

    if (existingUsers.length > 0 && !force) {
      return NextResponse.json({
        success: true,
        message:
          "Database already initialized with user accounts. To re-seed, add ?force=true to this URL.",
        existingUsersCount: existingUsers.length,
        users: existingUsers,
        hint: "Visit /api/seed-db?force=true to reset and re-seed the Homicho Munitions dataset.",
      });
    }

    const result = await seedDatabase({ reset: true });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Seeding API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal seeding error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
