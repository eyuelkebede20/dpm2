import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Strict Access Control: Require Sys Admin authentication or valid MIGRATION_API_SECRET
    const authHeader = request.headers.get("authorization");
    const migrationSecret = process.env.MIGRATION_API_SECRET;
    const isSecretValid =
      migrationSecret &&
      authHeader &&
      authHeader.startsWith("Bearer ") &&
      authHeader.slice(7) === migrationSecret;

    if (!isSecretValid) {
      let caller = null;
      try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (session?.user) {
          caller = session.user;
        }
      } catch {}

      if (!caller) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: Authentication required" },
          { status: 401 }
        );
      }

      if ((caller as any).role !== "sys_admin") {
        return NextResponse.json(
          { success: false, error: "Forbidden: System Administrator access required" },
          { status: 403 }
        );
      }
    }

    const migrationsFolder = path.resolve(process.cwd(), "drizzle");

    if (!fs.existsSync(migrationsFolder)) {
      return NextResponse.json(
        {
          success: false,
          error: `Migrations folder not found at ${migrationsFolder}`,
        },
        { status: 404 }
      );
    }

    // Apply migrations
    await migrate(db as any, { migrationsFolder });

    // Read list of applied migration files
    const migrationFiles = fs
      .readdirSync(migrationsFolder)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    return NextResponse.json(
      {
        success: true,
        message: "Database schema migrations applied successfully.",
        appliedMigrations: migrationFiles,
        latestMigration: migrationFiles[migrationFiles.length - 1] || null,
        schemaTables: [
          "notifications",
          "server_endpoints",
          "special_days",
          "downtime_reasons",
          "daily_report_reviews",
          "qa_approvals",
          "industry_profile",
          "factories",
          "factory_users",
          "lines",
          "products",
          "line_products",
          "plans",
          "report_entries",
          "stock_ledger",
          "qa_inspections",
          "qa_assignments",
          "users",
          "accounts",
          "sessions",
          "verifications",
        ],
        nextStep: "Visit /api/seed-db?force=true to seed initial Homicho Munitions dataset.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Database push API error:", error);
    const isProduction = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        success: false,
        error: isProduction
          ? "Database migration failed"
          : error instanceof Error
          ? error.message
          : "Schema push failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
