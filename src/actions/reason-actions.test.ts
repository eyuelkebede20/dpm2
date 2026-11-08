import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDowntimeReasonsAction,
  createDowntimeReasonAction,
  updateDowntimeReasonAction,
  toggleDowntimeReasonActiveAction,
} from "./reason-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
}));

let mockReasonsStore: Array<{
  id: string;
  code: string;
  nameEn: string;
  nameAm: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}> = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn((condition: any) => ({
            orderBy: vi.fn().mockImplementation(() => {
              // Simulating filter where isActive === true
              return Promise.resolve(mockReasonsStore.filter((r) => r.isActive));
            }),
            limit: vi.fn().mockImplementation((n: number) => {
              return Promise.resolve(mockReasonsStore.slice(0, n));
            }),
          })),
          orderBy: vi.fn().mockImplementation(() => {
            return Promise.resolve([...mockReasonsStore]);
          }),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => ({
          returning: vi.fn().mockImplementation(() => {
            const newRecord = {
              id: "gen-id-" + Math.random().toString(36).substring(2, 7),
              ...vals,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockReasonsStore.push(newRecord);
            return Promise.resolve([newRecord]);
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((updates: any) => ({
          where: vi.fn((condition: any) => {
            if (mockReasonsStore.length > 0) {
              Object.assign(mockReasonsStore[0], updates);
            }
            return Promise.resolve([{ id: "updated" }]);
          }),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ id: "deleted" }])),
      })),
    },
  };
});

describe("Downtime Reason Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReasonsStore = [
      {
        id: "reason-1",
        code: "DOW-01",
        nameEn: "Tool Wear / Broken Insert",
        nameAm: "የመሳሪያ መበላሸት",
        category: "tooling",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "reason-2",
        code: "DOW-02",
        nameEn: "Power Outage / Generator Lag",
        nameAm: "የኤሌክትሪክ ኃይል መቋረጥ",
        category: "power",
        isActive: false,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("getDowntimeReasonsAction", () => {
    it("fetches only active reasons by default", async () => {
      const activeReasons = await getDowntimeReasonsAction();
      expect(Array.isArray(activeReasons)).toBe(true);
      expect(activeReasons.length).toBe(1);
      expect(activeReasons[0].code).toBe("DOW-01");
    });

    it("fetches all reasons including inactive when includeInactive is true", async () => {
      const allReasons = await getDowntimeReasonsAction(true);
      expect(allReasons.length).toBe(2);
    });
  });

  describe("createDowntimeReasonAction", () => {
    it("rejects unauthorized users (FM / QA)", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-qa",
        role: "qa",
        name: "QA Inspector",
        email: "qa@dpm.et",
      } as any);

      const res = await createDowntimeReasonAction({
        code: "DOW-03",
        nameEn: "Material Shortage",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("rejects input with missing code or nameEn", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "Operations Manager",
        email: "om@dpm.et",
      } as any);

      const res = await createDowntimeReasonAction({
        code: "",
        nameEn: "  ",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("required");
    });

    it("creates reason successfully for OM and defaults nameAm to nameEn", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "Operations Manager",
        email: "om@dpm.et",
      } as any);

      const res = await createDowntimeReasonAction({
        code: "DOW-04",
        nameEn: "Coolant Low",
        category: "machine",
      });

      expect(res.success).toBe(true);
      expect(res.reason?.code).toBe("DOW-04");
      expect(res.reason?.nameAm).toBe("Coolant Low");
      expect(res.reason?.isActive).toBe(true);
    });

    it("allows sys_admin to create reason", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-admin",
        role: "sys_admin",
        name: "System Admin",
        email: "admin@dpm.et",
      } as any);

      const res = await createDowntimeReasonAction({
        code: "DOW-05",
        nameEn: "Sensor Failure",
        nameAm: "የሴንሰር ብልሽት",
        category: "machine",
        sortOrder: 5,
      });

      expect(res.success).toBe(true);
      expect(res.reason?.code).toBe("DOW-05");
      expect(res.reason?.nameAm).toBe("የሴንሰር ብልሽት");
    });
  });

  describe("updateDowntimeReasonAction", () => {
    it("rejects unauthorized users", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-fm",
        role: "fm",
        name: "Factory Manager",
        email: "fm@dpm.et",
      } as any);

      const res = await updateDowntimeReasonAction("reason-1", {
        nameEn: "Updated Name",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("rejects missing reason ID", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await updateDowntimeReasonAction("", {
        nameEn: "Updated Name",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("required");
    });

    it("updates reason for OM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await updateDowntimeReasonAction("reason-1", {
        nameEn: "Hydraulic Fluid Leak",
        category: "machine",
      });

      expect(res.success).toBe(true);
    });
  });

  describe("toggleDowntimeReasonActiveAction", () => {
    it("rejects unauthorized roles", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-qa",
        role: "qa",
        name: "QA Inspector",
        email: "qa@dpm.et",
      } as any);

      const res = await toggleDowntimeReasonActiveAction("reason-1");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("toggles active status correctly", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      // reason-1 starts with isActive: true, so toggling should result in isActive: false
      const res = await toggleDowntimeReasonActiveAction("reason-1");
      expect(res.success).toBe(true);
      expect(res.isActive).toBe(false);
    });

    it("returns error if reason is not found", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      mockReasonsStore = []; // Empty store
      const res = await toggleDowntimeReasonActiveAction("nonexistent-id");
      expect(res.success).toBe(false);
      expect(res.error).toContain("not found");
    });
  });
});
