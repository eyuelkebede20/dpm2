import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "./route";
import { NextRequest } from "next/server";
import { db } from "@/db";

const mockCookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

let mockUsersInDb: any[] = [];
let mockInsertedSessions: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn((cond: any) => ({
            orderBy: vi.fn(() => Promise.resolve(mockUsersInDb)),
            limit: vi.fn(() => Promise.resolve(mockUsersInDb.slice(0, 1))),
          })),
          orderBy: vi.fn(() => Promise.resolve(mockUsersInDb)),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => {
          mockInsertedSessions.push(vals);
          return Promise.resolve([{ id: vals.id }]);
        }),
      })),
    },
  };
});

describe("Dev Role Switcher API - /api/dev/switch-role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersInDb = [];
    mockInsertedSessions = [];
    (process.env as any).NODE_ENV = "development";
    process.env.ENABLE_DEV_IMPERSONATION = "true";
  });

  describe("GET /api/dev/switch-role", () => {
    it("returns 403 when dev mode and impersonation are disabled in production", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.ENABLE_DEV_IMPERSONATION = "false";

      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns list of active users in dev mode", async () => {
      mockUsersInDb = [
        { id: "usr_admin", name: "Admin", email: "admin@dpm.local", role: "sys_admin", active: true },
        { id: "usr_om", name: "OM User", email: "om@dpm.local", role: "om", active: true },
      ];

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.enabled).toBe(true);
      expect(data.users.length).toBe(2);
    });
  });

  describe("POST /api/dev/switch-role", () => {
    it("returns 403 when disabled in production", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.ENABLE_DEV_IMPERSONATION = "false";

      const req = new NextRequest("http://localhost:3000/api/dev/switch-role", {
        method: "POST",
        body: JSON.stringify({ role: "om" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("returns 404 when no user matches requested role", async () => {
      mockUsersInDb = [];

      const req = new NextRequest("http://localhost:3000/api/dev/switch-role", {
        method: "POST",
        body: JSON.stringify({ role: "qa" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it("successfully creates session and sets cookie when switching by role", async () => {
      mockUsersInDb = [
        { id: "usr_fm_01", name: "Abebe FM", email: "fm@dpm.local", role: "fm", active: true },
      ];

      const req = new NextRequest("http://localhost:3000/api/dev/switch-role", {
        method: "POST",
        body: JSON.stringify({ role: "fm" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.role).toBe("fm");
      expect(data.redirectTo).toBe("/entry");

      expect(mockInsertedSessions.length).toBe(1);
      expect(mockInsertedSessions[0].userId).toBe("usr_fm_01");

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "dpm.session_token",
        expect.any(String),
        expect.objectContaining({ path: "/", httpOnly: true })
      );
      expect(mockCookieStore.delete).toHaveBeenCalledWith("dpm_impersonate_user_id");
    });

    it("successfully creates session when switching by specific userId", async () => {
      mockUsersInDb = [
        { id: "usr_custom_om", name: "Custom OM", email: "custom@dpm.local", role: "om", active: true },
      ];

      const req = new NextRequest("http://localhost:3000/api/dev/switch-role", {
        method: "POST",
        body: JSON.stringify({ userId: "usr_custom_om", targetRoute: "/dashboard" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.id).toBe("usr_custom_om");
      expect(data.redirectTo).toBe("/dashboard");

      expect(mockInsertedSessions.length).toBe(1);
      expect(mockInsertedSessions[0].userId).toBe("usr_custom_om");
    });
  });

  describe("DELETE /api/dev/switch-role", () => {
    it("clears cookies on logout", async () => {
      const res = await DELETE();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockCookieStore.delete).toHaveBeenCalledWith("dpm.session_token");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("dpm_impersonate_user_id");
    });
  });
});
