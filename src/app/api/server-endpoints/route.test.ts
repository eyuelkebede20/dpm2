import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import * as serverActions from "@/actions/server-endpoint-actions";
import * as authz from "@/lib/authz";

vi.mock("@/actions/server-endpoint-actions", () => ({
  getServerEndpointsAction: vi.fn(),
  createServerEndpointAction: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
}));

describe("Server Endpoints API Route - /api/server-endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authz.requireUser).mockResolvedValue({
      id: "admin-1",
      name: "Admin User",
      email: "admin@dpm.local",
      role: "sys_admin",
      active: true,
      mustChangePassword: false,
    });
  });

  describe("GET /api/server-endpoints", () => {
    it("returns list of server endpoints with HTTP 200 and cache headers", async () => {
      vi.mocked(serverActions.getServerEndpointsAction).mockResolvedValue([
        {
          id: "srv_test_1",
          name: "Factory LAN",
          url: "http://192.168.1.100:3000",
          description: null,
          environment: "lan",
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.endpoints.length).toBe(1);
      expect(json.endpoints[0].name).toBe("Factory LAN");
      expect(res.headers.get("Cache-Control")).toContain("max-age=60");
    });
  });

  describe("POST /api/server-endpoints", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(authz.requireUser).mockRejectedValue(new Error("Unauthorized"));

      const req = new NextRequest("http://localhost:3000/api/server-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hub", url: "https://hub.dpm.local" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Unauthorized");
    });

    it("returns 403 when authenticated user is not sys_admin", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue({
        id: "om-1",
        name: "OM",
        email: "om@dpm.local",
        role: "om",
        active: true,
        mustChangePassword: false,
      });

      const req = new NextRequest("http://localhost:3000/api/server-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hub", url: "https://hub.dpm.local" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Forbidden");
    });

    it("returns 201 on successful endpoint creation as sys_admin", async () => {
      vi.mocked(serverActions.createServerEndpointAction).mockResolvedValue({
        success: true,
        endpoint: {
          id: "srv_new",
          name: "New Cloud Hub",
          url: "https://cloud.dpm.et",
          description: null,
          environment: "cloud",
          isDefault: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      });

      const req = new NextRequest("http://localhost:3000/api/server-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Cloud Hub",
          url: "https://cloud.dpm.et",
          environment: "cloud",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("returns 400 when creation fails due to schema validation", async () => {
      vi.mocked(serverActions.createServerEndpointAction).mockResolvedValue({
        success: false,
        error: "URL must be a valid HTTP or HTTPS address",
      });

      const req = new NextRequest("http://localhost:3000/api/server-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Invalid",
          url: "bad-url",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("valid HTTP");
    });
  });
});
