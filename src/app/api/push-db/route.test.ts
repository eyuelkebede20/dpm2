import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/db", () => ({
  db: {},
}));

vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("fs", () => {
  const actualFs = vi.importActual("fs");
  return {
    ...actualFs,
    default: {
      existsSync: vi.fn().mockReturnValue(true),
      readdirSync: vi.fn().mockReturnValue([
        "0000_complex_thena.sql",
        "0001_nifty_peter_quill.sql",
        "0002_low_hedge_knight.sql",
      ]),
    },
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue([
      "0000_complex_thena.sql",
      "0001_nifty_peter_quill.sql",
      "0002_low_hedge_knight.sql",
    ]),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { GET, POST } from "./route";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { auth } from "@/lib/auth";

describe("Push Database API Route - /api/push-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MIGRATION_API_SECRET;
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: "admin-1", email: "admin@dpm.local", role: "sys_admin" },
    });
  });

  it("returns 401 when unauthenticated and no valid token provided", async () => {
    (auth.api.getSession as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/push-db");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unauthorized");
  });

  it("returns 403 when authenticated as a non-admin role (e.g. OM)", async () => {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: "om-1", email: "om@dpm.local", role: "om" },
    });

    const req = new NextRequest("http://localhost:3000/api/push-db");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Forbidden");
  });

  it("applies migrations when authenticated as sys_admin", async () => {
    const req = new NextRequest("http://localhost:3000/api/push-db");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.latestMigration).toBe("0002_low_hedge_knight.sql");
    expect(data.schemaTables).toContain("notifications");
    expect(migrate).toHaveBeenCalledTimes(1);
  });

  it("applies migrations when valid MIGRATION_API_SECRET bearer token is provided", async () => {
    process.env.MIGRATION_API_SECRET = "secure-migration-token-xyz-123";
    (auth.api.getSession as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/push-db", {
      headers: {
        authorization: "Bearer secure-migration-token-xyz-123",
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("handles migration failure with 500 error", async () => {
    vi.mocked(migrate).mockRejectedValueOnce(new Error("Connection refused"));

    const req = new NextRequest("http://localhost:3000/api/push-db");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Connection refused");
  });

  it("masks migration error in production environment", async () => {
    const origEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = "production";
      vi.mocked(migrate).mockRejectedValueOnce(new Error("FATAL: relation does not exist at postgres:5432"));

      const req = new NextRequest("http://localhost:3000/api/push-db");
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("Database migration failed");
    } finally {
      (process.env as any).NODE_ENV = origEnv;
    }
  });
});
