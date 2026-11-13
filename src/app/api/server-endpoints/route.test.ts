import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import * as serverActions from "@/actions/server-endpoint-actions";

vi.mock("@/actions/server-endpoint-actions", () => ({
  getServerEndpointsAction: vi.fn(),
  createServerEndpointAction: vi.fn(),
}));

describe("Server Endpoints API Route - /api/server-endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it("returns 201 on successful endpoint creation", async () => {
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

    it("returns 400 when creation fails due to validation or permissions", async () => {
      vi.mocked(serverActions.createServerEndpointAction).mockResolvedValue({
        success: false,
        error: "Forbidden: Only Sys Admin can create server presets",
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
      expect(json.error).toMatch(/Forbidden/i);
    });
  });
});
