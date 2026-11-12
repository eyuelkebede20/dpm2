import { NextRequest, NextResponse } from "next/server";
import { getServerEndpointsAction, createServerEndpointAction } from "@/actions/server-endpoint-actions";

export const dynamic = "force-dynamic";

/**
 * GET /api/server-endpoints
 * Publicly queryable list of active backend server endpoints for the PWA client.
 */
export async function GET() {
  try {
    const endpoints = await getServerEndpointsAction();
    return NextResponse.json(
      {
        success: true,
        endpoints,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/server-endpoints failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load server endpoints",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/server-endpoints
 * Creates a new server endpoint (Admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createServerEndpointAction(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/server-endpoints failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error creating endpoint",
      },
      { status: 500 }
    );
  }
}
