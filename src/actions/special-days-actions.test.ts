import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSpecialDaysAction,
  saveSpecialDayAction,
  deleteSpecialDayAction,
  seedYearlySpecialDaysAction,
} from "./special-days-actions";
import * as authz from "@/lib/authz";
import * as holidaysLib from "@/lib/ethiopian-holidays";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
}));

let mockSpecialDaysStore: Array<{
  id: string;
  date: string;
  nameEn: string;
  nameAm: string;
  type: string;
  isWorkingDay: boolean;
  year: number;
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
              return Promise.resolve([...mockSpecialDaysStore]);
            }),
          })),
          orderBy: vi.fn().mockImplementation(() => {
            return Promise.resolve(
              [...mockSpecialDaysStore].sort((a, b) => a.date.localeCompare(b.date))
            );
          }),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockImplementation(() => {
              const existingIdx = mockSpecialDaysStore.findIndex((s) => s.date === vals.date);
              if (existingIdx >= 0) {
                mockSpecialDaysStore[existingIdx] = {
                  ...mockSpecialDaysStore[existingIdx],
                  ...vals,
                  updatedAt: new Date(),
                };
                return Promise.resolve([mockSpecialDaysStore[existingIdx]]);
              }
              const newRecord = {
                id: "sd-" + Math.random().toString(36).substring(2, 7),
                ...vals,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              mockSpecialDaysStore.push(newRecord);
              return Promise.resolve([newRecord]);
            }),
          })),
          returning: vi.fn().mockImplementation(() => {
            const newRecord = {
              id: "sd-" + Math.random().toString(36).substring(2, 7),
              ...vals,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockSpecialDaysStore.push(newRecord);
            return Promise.resolve([newRecord]);
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((updates: any) => ({
          where: vi.fn((condition: any) => ({
            returning: vi.fn().mockImplementation(() => {
              if (mockSpecialDaysStore.length > 0) {
                Object.assign(mockSpecialDaysStore[0], updates);
                return Promise.resolve([mockSpecialDaysStore[0]]);
              }
              return Promise.resolve([]);
            }),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ id: "deleted" }])),
      })),
    },
  };
});

describe("Special Days Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpecialDaysStore = [
      {
        id: "sd-1",
        date: "2026-01-07",
        nameEn: "Genna (Ethiopian Christmas)",
        nameAm: "ገና",
        type: "holiday",
        isWorkingDay: false,
        year: 2026,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "sd-2",
        date: "2026-03-02",
        nameEn: "Adwa Victory Day",
        nameAm: "የዓድዋ ድል በዓል",
        type: "holiday",
        isWorkingDay: false,
        year: 2026,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("getSpecialDaysAction", () => {
    it("returns special days sorted by date ascending", async () => {
      const results = await getSpecialDaysAction();
      expect(results.length).toBe(2);
      expect(results[0].date).toBe("2026-01-07");
      expect(results[1].date).toBe("2026-03-02");
    });

    it("accepts year and date range filters without error", async () => {
      const results = await getSpecialDaysAction(2026, "2026-01-01", "2026-03-31");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("saveSpecialDayAction", () => {
    it("rejects unauthorized users (FM / QA)", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-fm",
        role: "fm",
        name: "Factory Manager",
        email: "fm@dpm.et",
      } as any);

      const res = await saveSpecialDayAction({
        date: "2026-05-01",
        nameEn: "International Workers' Day",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("rejects invalid date format", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await saveSpecialDayAction({
        date: "invalid-date",
        nameEn: "Some Day",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("date");
    });

    it("rejects missing names", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await saveSpecialDayAction({
        date: "2026-05-01",
        nameEn: "",
        nameAm: " ",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("name is required");
    });

    it("saves special day for OM, deriving year and defaulting nameAm to nameEn", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await saveSpecialDayAction({
        date: "2026-05-05",
        nameEn: "Patriots Day",
        type: "holiday",
        isWorkingDay: false,
      });

      expect(res.success).toBe(true);
      expect(res.specialDay).toBeDefined();
      expect(res.specialDay?.year).toBe(2026);
      expect(res.specialDay?.nameEn).toBe("Patriots Day");
      expect(res.specialDay?.nameAm).toBe("Patriots Day");
    });

    it("updates existing special day when id is provided", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-admin",
        role: "sys_admin",
        name: "Admin",
        email: "admin@dpm.et",
      } as any);

      const res = await saveSpecialDayAction({
        id: "sd-1",
        date: "2026-01-07",
        nameEn: "Ethiopian Christmas (Genna)",
        nameAm: "የገና በዓል",
        isWorkingDay: false,
      });

      expect(res.success).toBe(true);
      expect(res.specialDay?.nameEn).toBe("Ethiopian Christmas (Genna)");
      expect(res.specialDay?.nameAm).toBe("የገና በዓል");
    });
  });

  describe("deleteSpecialDayAction", () => {
    it("rejects unauthorized users", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-qa",
        role: "qa",
        name: "QA Inspector",
        email: "qa@dpm.et",
      } as any);

      const res = await deleteSpecialDayAction("sd-1");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("rejects missing ID", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await deleteSpecialDayAction("");
      expect(res.success).toBe(false);
      expect(res.error).toContain("required");
    });

    it("deletes special day for OM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await deleteSpecialDayAction("sd-1");
      expect(res.success).toBe(true);
    });
  });

  describe("seedYearlySpecialDaysAction", () => {
    it("rejects unauthorized users", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-fm",
        role: "fm",
        name: "FM",
        email: "fm@dpm.et",
      } as any);

      const res = await seedYearlySpecialDaysAction(2026);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("rejects invalid year", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await seedYearlySpecialDaysAction(NaN);
      expect(res.success).toBe(false);
      expect(res.error).toContain("valid Gregorian year");
    });

    it("seeds yearly holidays successfully for OM using getEthiopianHolidaysForYear", async () => {
      vi.mocked(authz.requireUser).mockResolvedValueOnce({
        id: "user-om",
        role: "om",
        name: "OM",
        email: "om@dpm.et",
      } as any);

      const res = await seedYearlySpecialDaysAction(2026);
      expect(res.success).toBe(true);
      expect(res.count).toBeGreaterThanOrEqual(12);
      expect(Array.isArray(res.holidays)).toBe(true);
      expect(res.holidays?.some((h: any) => h.nameAm === "ገና")).toBe(true);
      expect(res.holidays?.some((h: any) => h.nameAm === "ጥምቀት")).toBe(true);
    });
  });
});
