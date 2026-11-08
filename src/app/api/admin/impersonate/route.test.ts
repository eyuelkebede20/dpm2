import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, DELETE } from "./route";
import { NextRequest } from "next/server";
import * as authz from "@/lib/authz";
import { db } from "@/db";

const mockCookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
}));

let mockTargetUserInDb: any = null;

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockTargetUserInDb ? [mockTargetUserInDb] : [])),
          })),
        })),
      })),
    },
  };
});

describe("Dev Impersonation API Workflow - /api/admin/impersonate", () => {
  const adminUser: authz.SessionUser = {
    id: "usr_admin_01",
    name: "Sys Admin",
    email: "admin@dpm.local",
    role: "sys_admin",
    active: true,
    mustChangePassword: false,
  };

  const omUser: authz.SessionUser = {
    id: "usr_om_01",
    name: "Solomon OM",
    email: "om@dpm.local",
    role: "om",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTargetUserInDb = null;
    (process.env as any).NODE_ENV = "development";
    process.env.ENABLE_DEV_IMPERSONATION = "true";

    vi.mocked(authz.requireUser).mockResolvedValue(adminUser);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("POST /api/admin/impersonate", () => {
    it("denies access with 403 if caller is not Sys Admin", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const req = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ targetUserId: "usr_fm_01" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Sys Admin only");
    });

    it("denies access with 403 when impersonation is disabled in environment", async () => {
      process.env.ENABLE_DEV_IMPERSONATION = "false";

      const req = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ targetUserId: "usr_fm_01" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("disabled in this environment");
    });

    it("denies access with 403 in production environment", async () => {
      (process.env as any).NODE_ENV = "production";

      const req = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ targetUserId: "usr_fm_01" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid payload (missing targetUserId)", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid payload");
    });

    it("returns 404 if target user is not found or inactive", async () => {
      mockTargetUserInDb = null;

      const req = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ targetUserId: "usr_nonexistent" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("not found or not eligible");
    });

    it("returns 404 if target user is another Sys Admin or QA", async () => {
      mockTargetUserInDb = {
        id: "usr_qa_01",
        name: "Hanna QA",
        email: "qa@dpm.local",
        role: "qa", // QA cannot be impersonated
        active: true,
      };

      const req = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ targetUserId: "usr_qa_01" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it("successfully sets impersonation cookie for active OM or FM target", async () => {
      mockTargetUserInDb = {
        id: "usr_fm_01",
        name: "Abebe FM",
        email: "fm@dpm.local",
        role: "fm",
        active: true,
      };

      const req = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ targetUserId: "usr_fm_01" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.id).toBe("usr_fm_01");
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "dpm_impersonate_user_id",
        "usr_fm_01",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
        })
      );
    });
  });

  describe("DELETE /api/admin/impersonate", () => {
    it("deletes impersonation cookie when exiting impersonation", async () => {
      const res = await DELETE();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockCookieStore.delete).toHaveBeenCalledWith("dpm_impersonate_user_id");
    });
  });
});
