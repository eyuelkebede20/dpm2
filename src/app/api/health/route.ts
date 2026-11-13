import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
        uptime: process.uptime(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Health check failed:", error);
    const isProduction = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: isProduction
          ? "Database service unavailable"
          : error instanceof Error
          ? error.message
          : "Unknown error",
      },
      { status: 503 }
    );
  }
}
