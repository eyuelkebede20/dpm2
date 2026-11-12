import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getFMFactory,
  getLines,
  createLineAction,
  toggleLineActiveAction,
  getProducts,
  createProductAction,
  toggleProductActiveAction,
  toggleLineProductAction,
  createPlanAction,
  getStoreStockData,
} from "./fm-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
  can: vi.fn(),
}));

let mockUserFactoryAssoc: any = null;
let mockFirstActiveFactory: any = null;
let mockLinesInDb: any[] = [];
let mockProductsInDb: any[] = [];
let mockInsertedLines: any[] = [];
let mockInsertedProducts: any[] = [];
let mockInsertedPlans: any[] = [];
let mockLineProductLinks: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => ({
          innerJoin: vi.fn().mockReturnThis(),
          leftJoin: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          where: vi.fn((condition: any) => ({
            limit: vi.fn(() => {
              if (mockUserFactoryAssoc) return Promise.resolve([mockUserFactoryAssoc]);
              if (mockFirstActiveFactory) return Promise.resolve([mockFirstActiveFactory]);
              return Promise.resolve([]);
            }),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
              then: vi.fn((res) => res(mockLinesInDb)),
            })),
            groupBy: vi.fn().mockReturnThis(),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          if (vals.plannedQty) mockInsertedPlans.push(vals);
          else if (vals.sku) mockInsertedProducts.push(vals);
          else if (vals.name) mockInsertedLines.push(vals);
          else if (vals.lineId && vals.productId) mockLineProductLinks.push(vals);

          return {
            onConflictDoNothing: vi.fn().mockResolvedValue([{ id: "ok" }]),
            returning: vi.fn().mockResolvedValue([{ id: vals.id || "ok" }]),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      })),
    },
  };
});

describe("FM Workflows - Factory Manager Operations", () => {
  const fmUser: authz.SessionUser = {
    id: "usr_fm_01",
    name: "Abebe FM",
    email: "fm@dpm.local",
    role: "fm",
    active: true,
    mustChangePassword: false,
  };

  const adminUser: authz.SessionUser = {
    id: "usr_admin_01",
    name: "Sys Admin",
    email: "admin@dpm.local",
    role: "sys_admin",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFactoryAssoc = { factoryId: "fac_01", factoryName: "Addis Ababa Plant" };
    mockFirstActiveFactory = { id: "fac_01", name: "Addis Ababa Plant" };
    mockLinesInDb = [{ id: "line_01", name: "Line 1", factoryId: "fac_01", active: true }];
    mockProductsInDb = [{ id: "prod_01", name: "Shirt", sku: "SH-01", factoryId: "fac_01" }];
    mockInsertedLines = [];
    mockInsertedProducts = [];
    mockInsertedPlans = [];
    mockLineProductLinks = [];

    vi.mocked(authz.requireUser).mockResolvedValue(fmUser);
    vi.mocked(authz.can).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getFMFactory Helper", () => {
    it("returns factory associated with FM user", async () => {
      const fac = await getFMFactory();
      expect(fac.id).toBe("fac_01");
      expect(fac.name).toBe("Addis Ababa Plant");
    });

    it("throws error if FM has no factory assignment", async () => {
      mockUserFactoryAssoc = null;
      mockFirstActiveFactory = null;

      await expect(getFMFactory()).rejects.toThrow(
        "No factory associated with your user account"
      );
    });

    it("returns first active factory for Sys Admin or OM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);
      mockUserFactoryAssoc = null;
      mockFirstActiveFactory = { id: "fac_99", name: "Hawassa Plant" };

      const fac = await getFMFactory();
      expect(fac.id).toBe("fac_99");
      expect(fac.name).toBe("Hawassa Plant");
    });

    it("throws if no active factories in system for Sys Admin", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);
      mockUserFactoryAssoc = null;
      mockFirstActiveFactory = null;

      await expect(getFMFactory()).rejects.toThrow("No factories found in system");
    });
  });

  describe("Lines Management", () => {
    it("denies line creation when user lacks authorization", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      const res = await createLineAction({ name: "Line 2" });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });

    it("fails line creation with name shorter than 2 characters", async () => {
      const res = await createLineAction({ name: "L" });
      expect(res.success).toBe(false);
      expect(res.error).toContain("at least 2 characters");
    });

    it("successfully creates line in factory", async () => {
      const res = await createLineAction({ name: "Assembly Line 3" });
      expect(res.success).toBe(true);
      expect(mockInsertedLines.length).toBe(1);
      expect(mockInsertedLines[0].name).toBe("Assembly Line 3");
      expect(mockInsertedLines[0].factoryId).toBe("fac_01");
      expect(mockInsertedLines[0].active).toBe(true);
    });

    it("toggles line active status", async () => {
      const res = await toggleLineActiveAction("line_01", false);
      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it("denies toggling line active status when forbidden", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      const res = await toggleLineActiveAction("line_01", false);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });
  });

  describe("Products Management", () => {
    it("denies product creation when forbidden", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      const res = await createProductAction({ name: "Trousers", sku: "TR-01" });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });

    it("validates product inputs (short name, short SKU)", async () => {
      const res1 = await createProductAction({ name: "A", sku: "SKU1" });
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("at least 2 characters");

      const res2 = await createProductAction({ name: "Valid Product", sku: "S" });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("at least 2 characters");
    });

    it("successfully creates product and uppercases SKU", async () => {
      const res = await createProductAction({
        name: "Cotton Polo Shirt",
        sku: "polo-wht-m",
      });

      expect(res.success).toBe(true);
      expect(mockInsertedProducts.length).toBe(1);
      expect(mockInsertedProducts[0].name).toBe("Cotton Polo Shirt");
      expect(mockInsertedProducts[0].sku).toBe("POLO-WHT-M");
      expect(mockInsertedProducts[0].factoryId).toBe("fac_01");
    });

    it("toggles product active status", async () => {
      const res = await toggleProductActiveAction("prod_01", false);
      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("Line-Product Linking", () => {
    it("links product to line when linked = true", async () => {
      const res = await toggleLineProductAction({
        lineId: "line_01",
        productId: "prod_01",
        linked: true,
      });

      expect(res.success).toBe(true);
      expect(mockLineProductLinks.length).toBe(1);
      expect(mockLineProductLinks[0]).toEqual({
        lineId: "line_01",
        productId: "prod_01",
      });
    });

    it("unlinks product from line when linked = false", async () => {
      const res = await toggleLineProductAction({
        lineId: "line_01",
        productId: "prod_01",
        linked: false,
      });

      expect(res.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it("denies linking when forbidden", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      const res = await toggleLineProductAction({
        lineId: "line_01",
        productId: "prod_01",
        linked: true,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });
  });

  describe("Production Plans Management", () => {
    it("denies plan creation when FM role attempts to create plan", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await createPlanAction({
        lineId: "line_01",
        productId: "prod_01",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 2500,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Factory Managers cannot create production plans");
    });

    it("denies plan creation when forbidden by authorization", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);
      vi.mocked(authz.can).mockResolvedValue(false);

      const res = await createPlanAction({
        lineId: "line_01",
        productId: "prod_01",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 2500,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });

    it("fails plan creation when end date is before start date", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);

      const res = await createPlanAction({
        lineId: "line_01",
        productId: "prod_01",
        startDate: "2026-11-30",
        endDate: "2026-11-01", // earlier than start date
        plannedQty: 2500,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("End date must be on or after start date");
    });

    it("fails plan creation when plannedQty is zero or negative", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);

      const res1 = await createPlanAction({
        lineId: "line_01",
        productId: "prod_01",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 0,
      });
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("greater than 0");

      const res2 = await createPlanAction({
        lineId: "line_01",
        productId: "prod_01",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: -100,
      });
      expect(res2.success).toBe(false);
    });

    it("fails plan creation when date format is invalid", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);

      const res = await createPlanAction({
        lineId: "line_01",
        productId: "prod_01",
        startDate: "01/11/2026",
        endDate: "30/11/2026",
        plannedQty: 1000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid start date format");
    });

    it("successfully creates production plan with valid parameters", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);

      const res = await createPlanAction({
        lineId: "line_01",
        productId: "prod_01",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 2500,
      });

      expect(res.success).toBe(true);
      expect(mockInsertedPlans.length).toBe(1);
      expect(mockInsertedPlans[0].lineId).toBe("line_01");
      expect(mockInsertedPlans[0].productId).toBe("prod_01");
      expect(mockInsertedPlans[0].plannedQty).toBe(2500);
    });
  });

  describe("Store Stock Ledger View", () => {
    it("returns factory information and ledger queries", async () => {
      const data = await getStoreStockData();
      expect(data.factory.id).toBe("fac_01");
      expect(Array.isArray(data.productBalances)).toBe(true);
      expect(Array.isArray(data.transactions)).toBe(true);
    });
  });
});
