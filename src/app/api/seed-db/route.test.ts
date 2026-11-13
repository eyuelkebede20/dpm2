import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(),
      delete: vi.fn(),
      insert: vi.fn(),
    },
  };
});

vi.mock("@/db/seed", () => {
  return {
    seedDatabase: vi.fn(),
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

import { db } from "@/db";
import { seedDatabase } from "@/db/seed";
import { auth } from "@/lib/auth";
import { GET, POST } from "./route";

describe("Seed Database API Route - /api/seed-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SEED_API_SECRET;
    (process.env as any).NODE_ENV = "development";
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: "admin-1", email: "admin@dpm.local", role: "sys_admin" },
    });
  });

  it("returns 403 when accessed in production environment", async () => {
    (process.env as any).NODE_ENV = "production";

    const req = new NextRequest("http://localhost:3000/api/seed-db");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("disabled in production");
  });

  it("returns 401 when unauthenticated and no valid token provided", async () => {
    (auth.api.getSession as any).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/seed-db");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Unauthorized");
  });

  it("returns 403 when authenticated as non-admin role", async () => {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: "om-1", email: "om@dpm.local", role: "om" },
    });

    const req = new NextRequest("http://localhost:3000/api/seed-db");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Forbidden");
  });

  it("GET returns initialized status without leaking user PII to sys_admin", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { id: "usr_admin" },
        { id: "usr_om" },
      ]),
    } as any);

    const req = new NextRequest("http://localhost:3000/api/seed-db");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.initialized).toBe(true);
    expect(data.existingUsersCount).toBe(2);
    // Crucial security check: PII (emails/passwords) must NOT be leaked
    expect(data.users).toBeUndefined();
    expect(seedDatabase).not.toHaveBeenCalled();
  });

  it("POST triggers seedDatabase when authenticated as sys_admin with { reset: true }", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue([{ id: "usr_admin" }]),
    } as any);

    vi.mocked(seedDatabase).mockResolvedValue({
      success: true,
      message: "Database seeded successfully",
      users: [],
      factories: 5,
      lines: 10,
      products: 12,
      plans: 9,
      servers: 3,
    });

    const req = new NextRequest("http://localhost:3000/api/seed-db", {
      method: "POST",
      body: JSON.stringify({ reset: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(seedDatabase).toHaveBeenCalledWith({ reset: true });
  });

  it("allows execution with valid SEED_API_SECRET bearer token", async () => {
    process.env.SEED_API_SECRET = "ci-secret-token-123";
    (auth.api.getSession as any).mockResolvedValue(null);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    } as any);

    vi.mocked(seedDatabase).mockResolvedValue({
      success: true,
      message: "Seeded",
      users: [],
      factories: 1,
      lines: 1,
      products: 1,
      plans: 1,
      servers: 1,
    });

    const req = new NextRequest("http://localhost:3000/api/seed-db", {
      method: "POST",
      headers: {
        authorization: "Bearer ci-secret-token-123",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(seedDatabase).toHaveBeenCalled();
  });
});
