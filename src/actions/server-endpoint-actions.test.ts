import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getServerEndpointsAction,
  getAllServerEndpointsForAdminAction,
  createServerEndpointAction,
  updateServerEndpointAction,
  toggleServerEndpointActiveAction,
  deleteServerEndpointAction,
  FALLBACK_SERVER_ENDPOINTS,
} from "./server-endpoint-actions";
import { cleanServerUrl } from "@/lib/backend-config";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
}));

let mockEndpointsInDb: any[] = [];
let mockInserted: any[] = [];
let mockUpdated: any[] = [];
let mockDeleted: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve(mockEndpointsInDb)),
          })),
          orderBy: vi.fn(() => Promise.resolve(mockEndpointsInDb)),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => {
          mockInserted.push(vals);
          return {
            returning: vi.fn(() => Promise.resolve([vals])),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: any) => {
          mockUpdated.push(vals);
          return {
            where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
          };
        }),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => {
          mockDeleted.push(true);
          return Promise.resolve({ rowCount: 1 });
        }),
      })),
    },
  };
});

describe("Server Endpoint Actions - Unit & Security Audit", () => {
  const adminUser = {
    id: "usr_admin_1",
    name: "System Admin",
    email: "admin@dpm.local",
    role: "sys_admin",
  };

  const regularUser = {
    id: "usr_fm_1",
    name: "Factory Manager",
    email: "fm@dpm.local",
    role: "fm",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEndpointsInDb = [
      {
        id: "srv_test_1",
        name: "Workshop 01 LAN",
        url: "http://192.168.1.50:3000",
        description: "Plant 01 Local Network",
        environment: "lan",
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockInserted = [];
    mockUpdated = [];
    mockDeleted = [];
  });

  describe("cleanServerUrl helper", () => {
    it("strips whitespace and trailing slashes correctly", () => {
      expect(cleanServerUrl("  http://192.168.1.100:3000///  ")).toBe("http://192.168.1.100:3000");
      expect(cleanServerUrl("https://dpm.homicho.et/")).toBe("https://dpm.homicho.et");
      expect(cleanServerUrl("http://localhost:3000")).toBe("http://localhost:3000");
    });
  });

  describe("getServerEndpointsAction", () => {
    it("returns database endpoints when available", async () => {
      const result = await getServerEndpointsAction();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Workshop 01 LAN");
    });

    it("falls back to FALLBACK_SERVER_ENDPOINTS when database returns empty array", async () => {
      mockEndpointsInDb = [];
      const result = await getServerEndpointsAction();
      expect(result).toEqual(FALLBACK_SERVER_ENDPOINTS);
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it("falls back gracefully when database throws an exception", async () => {
      vi.mocked(db.select).mockImplementationOnce(() => {
        throw new Error("Connection failed");
      });
      const result = await getServerEndpointsAction();
      expect(result).toEqual(FALLBACK_SERVER_ENDPOINTS);
    });
  });

  describe("getAllServerEndpointsForAdminAction", () => {
    it("allows sys_admin to retrieve all server endpoints", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser as any);
      const result = await getAllServerEndpointsForAdminAction();
      expect(result.length).toBe(1);
    });

    it("rejects non-admin users with Forbidden error", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(regularUser as any);
      await expect(getAllServerEndpointsForAdminAction()).rejects.toThrow(/Forbidden/i);
    });
  });

  describe("createServerEndpointAction", () => {
    it("creates a new server endpoint when invoked by sys_admin with valid payload", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser as any);

      const res = await createServerEndpointAction({
        name: "East Plant Edge Server",
        url: "http://192.168.1.200:3000/",
        description: "East wing manufacturing hub",
        environment: "lan",
        isDefault: false,
        isActive: true,
      });

      expect(res.success).toBe(true);
      expect(mockInserted.length).toBe(1);
      expect(mockInserted[0].name).toBe("East Plant Edge Server");
      expect(mockInserted[0].url).toBe("http://192.168.1.200:3000"); // normalized
    });

    it("rejects creation from non-admin user", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(regularUser as any);

      const res = await createServerEndpointAction({
        name: "Rogue Server",
        url: "http://10.0.0.1:3000",
        environment: "lan",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Forbidden/i);
      expect(mockInserted.length).toBe(0);
    });

    it("rejects invalid URLs missing protocol or malformed", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser as any);

      const res = await createServerEndpointAction({
        name: "Invalid Server",
        url: "not-a-valid-url",
        environment: "lan",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/valid HTTP or HTTPS/i);
    });
  });

  describe("updateServerEndpointAction", () => {
    it("updates server endpoint successfully when invoked by sys_admin", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser as any);

      const res = await updateServerEndpointAction("srv_test_1", {
        name: "Updated Workshop LAN",
        url: "http://192.168.1.55:3000",
      });

      expect(res.success).toBe(true);
      expect(mockUpdated.length).toBe(1);
      expect(mockUpdated[0].name).toBe("Updated Workshop LAN");
      expect(mockUpdated[0].url).toBe("http://192.168.1.55:3000");
    });
  });

  describe("toggleServerEndpointActiveAction & deleteServerEndpointAction", () => {
    it("toggles active state", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser as any);

      const res = await toggleServerEndpointActiveAction("srv_test_1", false);
      expect(res.success).toBe(true);
      expect(mockUpdated.some((u) => u.isActive === false)).toBe(true);
    });

    it("deletes server endpoint when requested by sys_admin", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser as any);

      const res = await deleteServerEndpointAction("srv_test_1");
      expect(res.success).toBe(true);
      expect(mockDeleted.length).toBe(1);
    });
  });
});
