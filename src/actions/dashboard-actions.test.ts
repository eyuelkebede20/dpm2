import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSysAdminDashboardData,
  getOMDashboardData,
  getFMDashboardData,
  getQADashboardData,
} from "./dashboard-actions";
import { db } from "@/db";

let mockProfiles: any[] = [];
let mockFactories: any[] = [];
let mockUsers: any[] = [];
let mockLines: any[] = [];
let mockReportSums: any[] = [];
let mockActivePlans: any[] = [];
let mockTodayEntries: any[] = [];
let mockInspections: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => ({
          limit: vi.fn(() => Promise.resolve(mockProfiles)),
          orderBy: vi.fn(() => {
            if (fields && fields.totalChecked) return Promise.resolve(mockInspections);
            return Promise.resolve(mockFactories.length > 0 ? mockFactories : mockUsers);
          }),
          where: vi.fn((condition: any) => ({
            orderBy: vi.fn(() => Promise.resolve(mockInspections)),
            limit: vi.fn(() => Promise.resolve(mockReportSums)),
            then: vi.fn((resolve) => {
              if (mockLines.length > 0) return resolve(mockLines);
              if (mockActivePlans.length > 0) return resolve(mockActivePlans);
              if (mockTodayEntries.length > 0) return resolve(mockTodayEntries);
              if (mockReportSums.length > 0) return resolve(mockReportSums);
              return resolve([]);
            }),
          })),
          innerJoin: vi.fn().mockReturnThis(),
        })),
      })),
    },
  };
});

describe("Dashboard Workflows - Role Dashboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfiles = [];
    mockFactories = [];
    mockUsers = [];
    mockLines = [];
    mockReportSums = [];
    mockActivePlans = [];
    mockTodayEntries = [];
    mockInspections = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Sys Admin Dashboard", () => {
    it("aggregates system stats, user counts, and active factories correctly", async () => {
      mockProfiles = [
        {
          id: "default",
          companyName: "Acme Industrial",
          units: "pcs",
          workingDays: [1, 2, 3, 4, 5, 6],
        },
      ];

      // Provide factories and users
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(mockProfiles),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([
            { id: "fac_1", active: true },
            { id: "fac_2", active: false },
            { id: "fac_3", active: true },
          ]),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([
            { id: "u_1", role: "om" },
            { id: "u_2", role: "om" },
            { id: "u_3", role: "fm" },
            { id: "u_4", role: "qa" },
            { id: "u_5", role: "qa" },
            { id: "u_6", role: "qa" },
          ]),
        })),
      } as any);

      const data = await getSysAdminDashboardData();
      expect(data.profile.companyName).toBe("Acme Industrial");
      expect(data.stats.totalFactories).toBe(3);
      expect(data.stats.activeFactories).toBe(2);
      expect(data.stats.totalOMs).toBe(2);
      expect(data.stats.totalFMs).toBe(1);
      expect(data.stats.totalQAs).toBe(3);
      expect(data.stats.totalUsers).toBe(6);
    });

    it("uses default profile fallback when none is in database", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      } as any);

      const data = await getSysAdminDashboardData();
      expect(data.profile.companyName).toBe("Daily Production Manager");
      expect(data.stats.totalFactories).toBe(0);
    });
  });

  describe("OM Dashboard", () => {
    it("computes OM factory monthly output, targets, and performance percentages", async () => {
      // 1. Profile
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            { workingDays: [1, 2, 3, 4, 5, 6] },
          ]),
        })),
      } as any);

      // 2. OM Factories
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: "fac_1", name: "Plant North", active: true },
          ]),
        })),
      } as any);

      // 3. Lines for factory
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "line_1" }]),
        })),
      } as any);

      // 4. MTD output sums
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              totalOutput: 2400,
              totalRework: 50,
              totalReject: 20,
              totalScrap: 10,
            },
          ]),
        })),
      } as any);

      // 5. Active plans
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: "plan_1", plannedQty: 2500 },
          ]),
        })),
      } as any);

      const data = await getOMDashboardData("usr_om_01");
      expect(data.totalOMOutput).toBe(2400);
      expect(data.totalOMTarget).toBe(2500);
      // Performance: 2400 / 2500 = 96.0%
      expect(data.overallPerformance).toBe(96.0);
      expect(data.factories.length).toBe(1);
      expect(data.factories[0].factoryName).toBe("Plant North");
      expect(data.factories[0].mtdRework).toBe(50);
    });

    it("handles OM with zero target gracefully (null performance)", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: "fac_2", name: "Plant South", active: true },
          ]),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]), // No lines
        })),
      } as any);

      const data = await getOMDashboardData("usr_om_02");
      expect(data.totalOMOutput).toBe(0);
      expect(data.totalOMTarget).toBe(0);
      expect(data.overallPerformance).toBeNull();
    });
  });

  describe("FM Dashboard", () => {
    it("returns zeros when factory has no lines configured", async () => {
      // Profile
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      } as any);

      // Lines
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      } as any);

      const data = await getFMDashboardData("fac_empty");
      expect(data.todayActual).toBe(0);
      expect(data.todayTarget).toBe(0);
      expect(data.todayVariance).toBe(0);
      expect(data.lineBreakdowns).toEqual([]);
    });

    it("calculates today actual vs target, variance, and MTD progress", async () => {
      // 1. Profile (Mon-Sat working)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            { workingDays: [1, 2, 3, 4, 5, 6] },
          ]),
        })),
      } as any);

      // 2. Lines
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "line_1", name: "Line 1" }]),
        })),
      } as any);

      // 3. Today's entries
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([
            {
              id: "rep_1",
              lineId: "line_1",
              lineName: "Line 1",
              productId: "prod_1",
              productName: "Shirt",
              productSku: "SH-01",
              finishedGood: 110,
              rework: 5,
              reject: 2,
              scrap: 1,
              wip: 10,
              downtimeMinutes: 15,
            },
          ]),
        })),
      } as any);

      // 4. Active plans for today (target = 100)
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              startDate: todayStr,
              endDate: todayStr,
              plannedQty: 100,
            },
          ]),
        })),
      } as any);

      // 5. MTD sums
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              totalOutput: 2200,
              totalRework: 50,
              totalReject: 15,
              totalScrap: 10,
              totalWip: 80,
            },
          ]),
        })),
      } as any);

      // 6. Month plans
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ plannedQty: 2500 }]),
        })),
      } as any);

      const data = await getFMDashboardData("fac_1");
      expect(data.todayActual).toBe(110);
      expect(data.todayRework).toBe(5);
      expect(data.todayReject).toBe(2);
      expect(data.todayScrap).toBe(1);
      expect(data.todayWip).toBe(10);
      expect(data.mtdActual).toBe(2200);
      expect(data.mtdTarget).toBe(2500);
    });
  });

  describe("QA Dashboard", () => {
    it("calculates today defect rate and inspection count correctly", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "qa_1",
                checked: 100,
                defects: 3,
                date: "2026-11-08",
                note: null,
                createdAt: new Date(),
                productName: "Shirt",
                productSku: "SH-01",
                lineName: "Line 1",
              },
              {
                id: "qa_2",
                checked: 200,
                defects: 3,
                date: "2026-11-08",
                note: null,
                createdAt: new Date(),
                productName: "Pants",
                productSku: "PA-01",
                lineName: "Line 2",
              },
            ]),
          })),
        })),
      } as any);

      const data = await getQADashboardData("usr_qa_01");
      expect(data.inspectionCount).toBe(2);
      expect(data.totalChecked).toBe(300);
      expect(data.totalDefects).toBe(6);
      // Defect rate: 6 / 300 = 2.0%
      expect(data.defectRate).toBe(2.0);
    });

    it("returns defect rate 0 when no inspections performed", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const data = await getQADashboardData("usr_qa_01");
      expect(data.inspectionCount).toBe(0);
      expect(data.totalChecked).toBe(0);
      expect(data.totalDefects).toBe(0);
      expect(data.defectRate).toBe(0);
    });
  });
});
