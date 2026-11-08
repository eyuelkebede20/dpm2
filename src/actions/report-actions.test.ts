import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveDailyReportEntryAction } from "./report-actions";
import { saveDailyReportEntry, saveDailyReportBatch } from "./report-entries";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
  can: vi.fn(),
}));

// We'll mock db and capture transaction operations
let mockSelectResult: any[] = [];
let mockExistingEntry: any = null;
let mockInsertedStockLedger: any[] = [];
let mockUpsertedReportEntry: any[] = [];

vi.mock("@/db", () => {
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mockExistingEntry ? [mockExistingEntry] : [])),
        })),
      })),
    })),
    insert: vi.fn((table: any) => ({
      values: vi.fn((vals: any) => {
        if (vals.delta !== undefined) {
          mockInsertedStockLedger.push(vals);
        } else {
          mockUpsertedReportEntry.push(vals);
        }
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: vals.id }]),
          returning: vi.fn().mockResolvedValue([{ id: vals.id }]),
        };
      }),
    })),
    update: vi.fn((table: any) => ({
      set: vi.fn((vals: any) => {
        mockUpsertedReportEntry.push(vals);
        return {
          where: vi.fn().mockResolvedValue([{ id: "updated" }]),
        };
      }),
    })),
  };

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockSelectResult)),
          })),
        })),
      })),
      transaction: vi.fn(async (callback: any) => {
        return await callback(tx);
      }),
    },
  };
});

describe("Report Workflows - Daily Production Reporting & Stock Ledger", () => {
  const mockUser: authz.SessionUser = {
    id: "usr_fm_01",
    name: "Factory Manager",
    email: "fm@factory.com",
    role: "fm",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult = [{ factoryId: "fac_01", id: "line_01" }];
    mockExistingEntry = null;
    mockInsertedStockLedger = [];
    mockUpsertedReportEntry = [];

    vi.mocked(authz.requireUser).mockResolvedValue(mockUser);
    vi.mocked(authz.can).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("saveDailyReportEntryAction validation", () => {
    it("fails when date format is invalid", async () => {
      const res = await saveDailyReportEntryAction({
        date: "08-11-2026", // Invalid format
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 100,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid date format");
    });

    it("fails when finishedGood is negative", async () => {
      const res = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: -5,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Finished good must be non-negative");
    });

    it("fails when rework, reject, scrap, wip, or downtime is negative", async () => {
      const res1 = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 50,
        rework: -1,
      });
      expect(res1.success).toBe(false);

      const res2 = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 50,
        downtimeMinutes: -10,
      });
      expect(res2.success).toBe(false);
    });

    it("fails when line is not found in database", async () => {
      mockSelectResult = []; // Line not found

      const res = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_nonexistent",
        productId: "prod_01",
        finishedGood: 50,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Production line not found");
    });

    it("fails when user is forbidden from recording entry", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      const res = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 50,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });
  });

  describe("Stock Ledger Delta Calculations (Atomic Transaction)", () => {
    it("creates report entry and inserts initial stock delta equal to finishedGood", async () => {
      mockExistingEntry = null; // First entry for this date/line/product

      const res = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 120,
        rework: 5,
        reject: 2,
        scrap: 1,
        wip: 10,
        downtimeMinutes: 30,
        issueNote: "Minor conveyor issue",
      });

      expect(res.success).toBe(true);
      expect(mockUpsertedReportEntry.length).toBeGreaterThan(0);
      expect(mockUpsertedReportEntry[0].finishedGood).toBe(120);

      // Stock ledger delta should be exactly +120
      expect(mockInsertedStockLedger.length).toBe(1);
      expect(mockInsertedStockLedger[0].delta).toBe(120);
      expect(mockInsertedStockLedger[0].factoryId).toBe("fac_01");
      expect(mockInsertedStockLedger[0].productId).toBe("prod_01");
    });

    it("does not insert into stock ledger if initial finishedGood is 0", async () => {
      mockExistingEntry = null;

      const res = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 0,
        wip: 15,
        downtimeMinutes: 120,
      });

      expect(res.success).toBe(true);
      // delta is 0 - 0 = 0, so no stock ledger entry
      expect(mockInsertedStockLedger.length).toBe(0);
    });

    it("inserts positive delta into stock ledger when finishedGood is revised upwards", async () => {
      mockExistingEntry = {
        id: "rep_2026-11-08_line_01_prod_01",
        finishedGood: 100,
      };

      const res = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 140, // Increased by 40
      });

      expect(res.success).toBe(true);
      expect(mockInsertedStockLedger.length).toBe(1);
      expect(mockInsertedStockLedger[0].delta).toBe(40);
    });

    it("inserts negative delta into stock ledger when finishedGood is revised downwards", async () => {
      mockExistingEntry = {
        id: "rep_2026-11-08_line_01_prod_01",
        finishedGood: 100,
      };

      const res = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 75, // Decreased by 25
      });

      expect(res.success).toBe(true);
      expect(mockInsertedStockLedger.length).toBe(1);
      expect(mockInsertedStockLedger[0].delta).toBe(-25);
    });

    it("does not write to stock ledger when finishedGood is unchanged", async () => {
      mockExistingEntry = {
        id: "rep_2026-11-08_line_01_prod_01",
        finishedGood: 100,
      };

      const res = await saveDailyReportEntryAction({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 100, // Same quantity
        rework: 8, // Only rework modified
      });

      expect(res.success).toBe(true);
      // delta is 100 - 100 = 0
      expect(mockInsertedStockLedger.length).toBe(0);
    });
  });

  describe("saveDailyReportEntry and saveDailyReportBatch (report-entries.ts)", () => {
    it("successfully runs saveDailyReportEntry and records delta", async () => {
      mockExistingEntry = null;

      const res = await saveDailyReportEntry({
        date: "2026-11-08",
        lineId: "line_01",
        productId: "prod_01",
        finishedGood: 250,
        rework: 0,
        reject: 0,
        scrap: 0,
        wip: 50,
        downtimeMinutes: 0,
      });

      expect(res.success).toBe(true);
      expect(res.deltaRecorded).toBe(250);
      expect(res.reportEntryId).toBe("rep_2026-11-08_line_01_prod_01");
    });

    it("throws error in saveDailyReportEntry if line is missing", async () => {
      mockSelectResult = [];

      await expect(
        saveDailyReportEntry({
          date: "2026-11-08",
          lineId: "missing_line",
          productId: "prod_01",
          finishedGood: 50,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
        })
      ).rejects.toThrow("Line not found");
    });

    it("throws error in saveDailyReportEntry if unauthorized", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      await expect(
        saveDailyReportEntry({
          date: "2026-11-08",
          lineId: "line_01",
          productId: "prod_01",
          finishedGood: 50,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("processes batch of daily report entries via saveDailyReportBatch", async () => {
      mockExistingEntry = null;

      const batchResult = await saveDailyReportBatch([
        {
          date: "2026-11-08",
          lineId: "line_01",
          productId: "prod_01",
          finishedGood: 100,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
        },
        {
          date: "2026-11-08",
          lineId: "line_01",
          productId: "prod_02",
          finishedGood: 150,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
        },
      ]);

      expect(batchResult.success).toBe(true);
      expect(batchResult.count).toBe(2);
    });
  });
});
