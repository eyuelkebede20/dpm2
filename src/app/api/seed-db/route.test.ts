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

import { db } from "@/db";
import { seedDatabase } from "@/db/seed";
import { GET } from "./route";

describe("Seed Database API Route - GET /api/seed-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing user count and prompt when users already exist and force is not set", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { id: "usr_admin", email: "admin@dpm.local", role: "sys_admin" },
      ]),
    } as any);

    const req = new NextRequest("http://localhost:3000/api/seed-db");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.existingUsersCount).toBe(1);
    expect(seedDatabase).not.toHaveBeenCalled();
  });

  it("triggers seedDatabase when no users exist", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    } as any);

    vi.mocked(seedDatabase).mockResolvedValue({
      success: true,
      message: "Seeded",
      users: [],
      factories: 5,
      lines: 10,
      products: 12,
      plans: 9,
      servers: 3,
    });

    const req = new NextRequest("http://localhost:3000/api/seed-db");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(seedDatabase).toHaveBeenCalledWith({ reset: true });
  });

  it("triggers seedDatabase when force=true even if users already exist", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { id: "usr_admin", email: "admin@dpm.local", role: "sys_admin" },
      ]),
    } as any);

    vi.mocked(seedDatabase).mockResolvedValue({
      success: true,
      message: "Forced seed",
      users: [],
      factories: 5,
      lines: 10,
      products: 12,
      plans: 9,
      servers: 3,
    });

    const req = new NextRequest("http://localhost:3000/api/seed-db?force=true");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(seedDatabase).toHaveBeenCalledWith({ reset: true });
  });
});
