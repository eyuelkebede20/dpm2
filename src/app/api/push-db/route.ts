import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Schema push failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
