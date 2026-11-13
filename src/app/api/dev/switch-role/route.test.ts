import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "./route";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { auth } from "@/lib/auth";

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
      getSession: vi.fn(),
    },
  },
}));

let mockUsersInDb: any[] = [];
let mockInsertedSessions: any[] = [];
let mockDevAdminResult: any = null;

vi.mock("@/lib/dev-token", () => ({
  SYSADMIN_DEV_TOKEN_COOKIE: "dpm_dev_sysadmin_token",
  createSysAdminDevToken: vi.fn(() => "mock-signed-dev-token"),
  verifySysAdminDevToken: vi.fn(async () => mockDevAdminResult),
  setSysAdminDevCookie: vi.fn(),
  clearSysAdminDevCookie: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn((cond: any) => {
            const queryObj: any = {
              orderBy: vi.fn(() => queryObj),
              limit: vi.fn(() => Promise.resolve(mockUsersInDb.slice(0, 1))),
              then: (resolve: any, reject?: any) => Promise.resolve(mockUsersInDb).then(resolve, reject),
            };
            return queryObj;
          }),
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
    mockDevAdminResult = null;
    mockCookieStore.get.mockReturnValue(undefined);
    (process.env as any).NODE_ENV = "development";
    process.env.ENABLE_DEV_IMPERSONATION = "true";
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long-abc-123";
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: "admin-1", email: "admin@dpm.local", role: "sys_admin" },
    });
  });

  describe("GET /api/dev/switch-role", () => {
    it("returns 403 when session user is not sys_admin and no dev token present, even in production", async () => {
      (process.env as any).NODE_ENV = "production";
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "om-1", email: "om@dpm.local", role: "om" },
      });
      mockCookieStore.get.mockReturnValue(undefined);

      const res = await GET();
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
    });

    it("returns 403 when session user is not sys_admin and no dev token present", async () => {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "om-1", email: "om@dpm.local", role: "om" },
      });
      mockCookieStore.get.mockReturnValue(undefined);

      const res = await GET();
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
    });

    it("returns list of active users when caller has non-admin session role but presents valid sysadmin dev token", async () => {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "om-1", email: "om@dpm.local", role: "om" },
      });
      mockCookieStore.get.mockReturnValue({ value: "valid-dev-token" });
      mockDevAdminResult = { id: "admin-1", email: "admin@dpm.local", role: "sys_admin", name: "Admin" };
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

    it("returns list of active users when sys_admin is authenticated in dev mode", async () => {
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
    it("allows authenticated sys_admin to switch roles in production", async () => {
      (process.env as any).NODE_ENV = "production";
      mockUsersInDb = [
        { id: "usr_om", name: "OM User", email: "om@dpm.local", role: "om", active: true },
      ];

      const req = new NextRequest("http://localhost:3000/api/dev/switch-role", {
        method: "POST",
        body: JSON.stringify({ role: "om" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.role).toBe("om");
    });

    it("returns 403 when caller is not sys_admin and no dev token present", async () => {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "fm-1", email: "fm@dpm.local", role: "fm" },
      });
      mockCookieStore.get.mockReturnValue(undefined);

      const req = new NextRequest("http://localhost:3000/api/dev/switch-role", {
        method: "POST",
        body: JSON.stringify({ role: "om" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
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

    it("successfully creates session and sets cookies when switching by role as sys_admin", async () => {
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
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "dpm_dev_sysadmin_token",
        expect.any(String),
        expect.objectContaining({ path: "/", httpOnly: true })
      );
      expect(mockCookieStore.delete).toHaveBeenCalledWith("dpm_impersonate_user_id");
    });

    it("successfully switches role when caller has non-admin session role (e.g. om) but presents valid sysadmin dev token", async () => {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "om-1", email: "om@dpm.local", role: "om" },
      });
      mockCookieStore.get.mockReturnValue({ value: "valid-dev-token" });
      mockDevAdminResult = { id: "admin-1", email: "admin@dpm.local", role: "sys_admin", name: "Admin" };
      mockUsersInDb = [
        { id: "usr_qa_01", name: "Hanna QA", email: "qa@dpm.local", role: "qa", active: true },
      ];

      const req = new NextRequest("http://localhost:3000/api/dev/switch-role", {
        method: "POST",
        body: JSON.stringify({ role: "qa" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.role).toBe("qa");
      expect(data.redirectTo).toBe("/qa");

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "dpm_dev_sysadmin_token",
        expect.any(String),
        expect.objectContaining({ path: "/", httpOnly: true })
      );
    });

    it("successfully creates session when switching by specific userId as sys_admin", async () => {
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
    it("clears session and sysadmin dev token cookies on logout", async () => {
      const res = await DELETE();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockCookieStore.delete).toHaveBeenCalledWith("dpm.session_token");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("dpm_impersonate_user_id");
      expect(mockCookieStore.delete).toHaveBeenCalledWith("dpm_dev_sysadmin_token");
    });
  });
});
