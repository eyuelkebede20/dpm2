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

import { GET } from "./route";
import { migrate } from "drizzle-orm/node-postgres/migrator";

describe("Push Database API Route - GET /api/push-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies migrations and returns list of applied migration files", async () => {
    const req = new NextRequest("http://localhost:3000/api/push-db");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.latestMigration).toBe("0002_low_hedge_knight.sql");
    expect(data.schemaTables).toContain("notifications");
    expect(migrate).toHaveBeenCalledTimes(1);
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
});
