import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCurrentUserContext,
  getFactoryLinesAndProducts,
  getDailyGridData,
  getMonthCalendarSummary,
  getStoreStockLedger,
} from "./data";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
  can: vi.fn(),
}));

let mockSelectData: any[] = [];
let mockProfileData: any = null;

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => ({
          innerJoin: vi.fn().mockReturnThis(),
          leftJoin: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          where: vi.fn((condition: any) => ({
            limit: vi.fn(() => Promise.resolve(mockSelectData)),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(mockSelectData)),
              then: vi.fn((resolve) => resolve(mockSelectData)),
            })),
            then: vi.fn((resolve) => resolve(mockSelectData)),
          })),
          limit: vi.fn(() => Promise.resolve(mockProfileData ? [mockProfileData] : [])),
          then: vi.fn((resolve) => resolve(mockSelectData)),
        })),
      })),
    },
  };
});

describe("Data & Calendar Workflows - data.ts", () => {
  const fmUser: authz.SessionUser = {
    id: "usr_fm_01",
    name: "Abebe FM",
    email: "fm@dpm.local",
    role: "fm",
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
    mockSelectData = [];
    mockProfileData = null;

    vi.mocked(authz.requireUser).mockResolvedValue(fmUser);
    vi.mocked(authz.can).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getCurrentUserContext", () => {
    it("resolves factory assignment for FM user and profile", async () => {
      // 1. factory lookup for FM
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              { factoryId: "fac_01", factoryName: "Addis Ababa Plant" },
            ]),
          })),
        })),
      } as any);

      // 2. industryProfile lookup
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              { companyName: "DPM Textiles", workingDays: [1, 2, 3, 4, 5, 6], units: "pcs" },
            ]),
          })),
        })),
      } as any);

      const ctx = await getCurrentUserContext();
      expect(ctx.user.id).toBe("usr_fm_01");
      expect(ctx.factoryId).toBe("fac_01");
      expect(ctx.factoryName).toBe("Addis Ababa Plant");
      expect(ctx.industryProfile.companyName).toBe("DPM Textiles");
    });

    it("resolves factory assignment for OM user", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      // factory lookup for OM
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              { id: "fac_om_1", name: "Hawassa Plant" },
            ]),
          })),
        })),
      } as any);

      // industryProfile fallback
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const ctx = await getCurrentUserContext();
      expect(ctx.factoryId).toBe("fac_om_1");
      expect(ctx.factoryName).toBe("Hawassa Plant");
      expect(ctx.industryProfile.companyName).toBe("Daily Production Manager");
    });
  });

  describe("getFactoryLinesAndProducts", () => {
    it("denies access if user lacks permission for the factory", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      await expect(getFactoryLinesAndProducts("fac_forbidden")).rejects.toThrow(
        "Unauthorized to access this factory's lines/products"
      );
    });

    it("returns lines, products, and links for authorized factory", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "line_1", name: "Line 1" }]),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "prod_1", name: "Shirt" }]),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => Promise.resolve([{ lineId: "line_1", productId: "prod_1" }])),
      } as any);

      const res = await getFactoryLinesAndProducts("fac_01");
      expect(res.lines.length).toBe(1);
      expect(res.products.length).toBe(1);
      expect(res.lineProducts.length).toBe(1);
    });
  });

  describe("getDailyGridData", () => {
    it("denies access when forbidden", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      await expect(getDailyGridData("fac_01", "2026-11-08")).rejects.toThrow(
        "Unauthorized to access factory data"
      );
    });

    it("assembles grid rows mapping lines, products, plans, and existing reports", async () => {
      // Profile
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ workingDays: [1, 2, 3, 4, 5, 6] }]),
        })),
      } as any);

      // Lines
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "line_1", name: "Line 1" }]),
        })),
      } as any);

      // Products
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: "prod_1", name: "Polo Shirt", sku: "POLO-01" },
          ]),
        })),
      } as any);

      // LineProduct links
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => Promise.resolve([{ lineId: "line_1", productId: "prod_1" }])),
      } as any);

      // Active plans
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              lineId: "line_1",
              productId: "prod_1",
              startDate: "2026-11-01",
              endDate: "2026-11-30",
              plannedQty: 2500,
            },
          ]),
        })),
      } as any);

      // Existing report entries
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              lineId: "line_1",
              productId: "prod_1",
              finishedGood: 105,
              rework: 2,
              reject: 1,
              scrap: 0,
              wip: 10,
              downtimeMinutes: 0,
              issueNote: "Good run",
            },
          ]),
        })),
      } as any);

      const gridData = await getDailyGridData("fac_01", "2026-11-08");
      expect(gridData.date).toBe("2026-11-08");
      expect(gridData.gridRows.length).toBe(1);

      const row = gridData.gridRows[0];
      expect(row.lineName).toBe("Line 1");
      expect(row.productName).toBe("Polo Shirt");
      expect(row.sku).toBe("POLO-01");
      expect(row.plan?.plannedQty).toBe(2500);
      expect(row.entry.finishedGood).toBe(105);
      expect(row.entry.rework).toBe(2);
      expect(row.entry.issueNote).toBe("Good run");
    });

    it("maps QA approvals from qaApprovals table to qaReview with status approved and inspector name", async () => {
      // 1. Profile
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ workingDays: [1, 2, 3, 4, 5, 6] }]),
        })),
      } as any);

      // 2. Lines
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "line_1", name: "Line 1" }]),
        })),
      } as any);

      // 3. Products
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "prod_1", name: "Polo Shirt", sku: "POLO-01" }]),
        })),
      } as any);

      // 4. LineProducts
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => Promise.resolve([{ lineId: "line_1", productId: "prod_1" }])),
      } as any);

      // 5. Plans
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      } as any);

      // 6. Report entries
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              id: "rep_2026-11-08_line_1_prod_1",
              date: "2026-11-08",
              lineId: "line_1",
              productId: "prod_1",
              finishedGood: 100,
              rework: 0,
              reject: 0,
              scrap: 0,
              wip: 0,
              downtimeMinutes: 0,
              issueNote: null,
            },
          ]),
        })),
      } as any);

      // 7. Special day
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      // 8. Downtime reasons
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      // 9. QA inspections
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        })),
      } as any);

      // 10. QA approvals
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([
            {
              id: "app_1",
              reportEntryId: "rep_2026-11-08_line_1_prod_1",
              status: "approved",
              note: "Quality looks good",
              qaUserId: "usr_qa_1",
              qaUserName: "Tewodros QA",
              updatedAt: new Date(),
            },
          ]),
        })),
      } as any);

      // 11. Daily report review
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const gridData = await getDailyGridData("fac_01", "2026-11-08");
      expect(gridData.gridRows.length).toBe(1);
      const row = gridData.gridRows[0];
      expect(row.qaReview?.isReviewed).toBe(true);
      expect(row.qaReview?.status).toBe("approved");
      expect(row.qaReview?.verdict).toBe("QA Approved");
      expect(row.qaReview?.inspectorName).toBe("Tewodros QA");
      expect(row.qaReview?.note).toBe("Quality looks good");
    });

    it("evaluates daily target to 0 on non-working special day and returns holiday and reasons", async () => {
      // 1. Profile
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ workingDays: [1, 2, 3, 4, 5, 6] }]),
        })),
      } as any);

      // 2. Lines
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "line_1", name: "Line 1" }]),
        })),
      } as any);

      // 3. Products
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: "prod_1", name: "Polo Shirt", sku: "POLO-01" },
          ]),
        })),
      } as any);

      // 4. LineProduct links
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => Promise.resolve([{ lineId: "line_1", productId: "prod_1" }])),
      } as any);

      // 5. Active plans
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              lineId: "line_1",
              productId: "prod_1",
              startDate: "2026-11-01",
              endDate: "2026-11-30",
              plannedQty: 2500,
            },
          ]),
        })),
      } as any);

      // 6. Existing report entries
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      } as any);

      // 7. Special day lookup
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: "sp_1",
                date: "2026-11-09",
                nameEn: "Victory Day",
                nameAm: "የድል ቀን",
                type: "holiday",
                isWorkingDay: false,
                year: 2026,
              },
            ]),
          })),
        })),
      } as any);

      // 8. Downtime reasons lookup
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "dtr_1",
                code: "DOW-01",
                nameEn: "Tool Wear",
                nameAm: "የመሳሪያ መሸርሸር",
                category: "tooling",
                isActive: true,
                sortOrder: 1,
              },
            ]),
          })),
        })),
      } as any);

      const gridData = await getDailyGridData("fac_01", "2026-11-09");
      expect(gridData.specialDay).toEqual({
        nameEn: "Victory Day",
        nameAm: "የድል ቀን",
        type: "holiday",
        isWorkingDay: false,
      });
      expect(gridData.downtimeReasons).toHaveLength(1);
      expect(gridData.downtimeReasons[0].code).toBe("DOW-01");
      expect(gridData.gridRows[0].plan?.dailyTarget).toBe(0);
    });
  });

  describe("getMonthCalendarSummary", () => {
    it("denies access when forbidden", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      await expect(
        getMonthCalendarSummary("fac_01", "2026-11-01", "2026-11-30")
      ).rejects.toThrow("Unauthorized to access calendar data");
    });

    it("returns working days, entries and plans for month range", async () => {
      // Profile
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ workingDays: [1, 2, 3, 4, 5, 6] }]),
        })),
      } as any);

      // Entries in month
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([
            {
              id: "rep_1",
              date: "2026-11-02",
              finishedGood: 100,
              lineName: "Line 1",
              productName: "Shirt",
            },
          ]),
        })),
      } as any);

      // Active products in factory
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: "prod_1", name: "Shirt", sku: "SHIRT-01" },
          ]),
        })),
      } as any);

      // Plans
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([
            {
              lineId: "line_1",
              productId: "prod_1",
              startDate: "2026-11-01",
              endDate: "2026-11-30",
              plannedQty: 2500,
            },
          ]),
        })),
      } as any);

      const summary = await getMonthCalendarSummary(
        "fac_01",
        "2026-11-01",
        "2026-11-30"
      );

      expect(summary.workingDays).toEqual([1, 2, 3, 4, 5, 6]);
      expect(summary.entries.length).toBe(1);
      expect(summary.entries[0].finishedGood).toBe(100);
      expect(summary.plans.length).toBe(1);
    });
  });

  describe("getStoreStockLedger", () => {
    it("denies access when forbidden", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      await expect(getStoreStockLedger("fac_01")).rejects.toThrow(
        "Unauthorized to access store ledger"
      );
    });

    it("returns product stock balances and transaction ledger log", async () => {
      // Balances
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn(() => ({
            groupBy: vi.fn().mockResolvedValue([
              { productId: "prod_1", productName: "Shirt", sku: "SH-01", currentStock: 450 },
            ]),
          })),
        })),
      } as any);

      // Transactions
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "stk_1",
                  productId: "prod_1",
                  productName: "Shirt",
                  delta: 100,
                  createdAt: new Date(),
                },
              ]),
            })),
          })),
        })),
      } as any);

      const ledger = await getStoreStockLedger("fac_01");
      expect(ledger.balances.length).toBe(1);
      expect(ledger.balances[0].currentStock).toBe(450);
      expect(ledger.transactions.length).toBe(1);
      expect(ledger.transactions[0].delta).toBe(100);
    });
  });
});
