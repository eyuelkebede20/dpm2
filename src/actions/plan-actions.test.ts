import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlanAction, updatePlanAction, batchCreatePlansAction } from "./plan-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";
import { plans, products, lines, lineProducts } from "@/db/schema";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
  can: vi.fn(),
}));

let mockExistingPlansInDb: any[] = [];
let mockProductsInDb: any[] = [];
let mockLinesInDb: any[] = [];
let mockLineProductsInDb: any[] = [];
let mockInsertedPlans: any[] = [];
let mockUpdatedPlans: any[] = [];

function createQueryMock(getData: () => any[]) {
  const query: any = {
    then: (resolve: any, reject: any) => Promise.resolve(getData()).then(resolve, reject),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(getData())),
  };
  return query;
}

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => {
          if (table === plans) return createQueryMock(() => mockExistingPlansInDb);
          if (table === products) return createQueryMock(() => mockProductsInDb);
          if (table === lines) return createQueryMock(() => mockLinesInDb);
          if (table === lineProducts) return createQueryMock(() => mockLineProductsInDb);
          return createQueryMock(() => mockExistingPlansInDb);
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => {
          mockInsertedPlans.push(vals);
          return Promise.resolve([{ id: vals.id }]);
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn(() => {
            mockUpdatedPlans.push(vals);
            return Promise.resolve([{ id: "plan_1" }]);
          }),
        })),
      })),
    },
  };
});

describe("plan-actions Server Actions - One Plan Per Product Rule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistingPlansInDb = [];
    mockProductsInDb = [];
    mockLinesInDb = [];
    mockLineProductsInDb = [];
    mockInsertedPlans = [];
    mockUpdatedPlans = [];

    vi.mocked(authz.requireUser).mockResolvedValue({
      id: "usr_om_1",
      name: "Operation Manager",
      email: "om@dpm.local",
      role: "om",
      active: true,
      mustChangePassword: false,
    });
    vi.mocked(authz.can).mockResolvedValue(true);
  });

  describe("createPlanAction", () => {
    it("rejects FM role with forbidden error", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue({
        id: "usr_fm_1",
        name: "Factory Manager",
        email: "fm@dpm.local",
        role: "fm",
        active: true,
        mustChangePassword: false,
      });

      const res = await createPlanAction({
        lineId: "line_1",
        productId: "prod_1",
        startDate: "2026-07-08",
        endDate: "2026-09-05",
        plannedQty: 15000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("rejects creating a plan if a plan already exists for the product", async () => {
      mockExistingPlansInDb = [
        { id: "plan_existing", lineId: "line_1", startDate: "2026-01-01", endDate: "2026-06-30" },
      ];

      const res = await createPlanAction({
        lineId: "line_1",
        productId: "prod_1",
        startDate: "2026-07-08",
        endDate: "2026-09-05",
        plannedQty: 15000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Only one plan per product is allowed");
      expect(mockInsertedPlans.length).toBe(0);
    });

    it("successfully creates plan when product does not have an existing plan", async () => {
      mockExistingPlansInDb = [];

      const res = await createPlanAction({
        lineId: "line_1",
        productId: "prod_new",
        startDate: "2026-07-08",
        endDate: "2026-09-05",
        plannedQty: 25000,
      });

      expect(res.success).toBe(true);
      expect(mockInsertedPlans.length).toBe(1);
      expect(mockInsertedPlans[0].productId).toBe("prod_new");
      expect(mockInsertedPlans[0].plannedQty).toBe(25000);
    });
  });

  describe("updatePlanAction", () => {
    it("rejects updating plan if target product already has another plan", async () => {
      mockExistingPlansInDb = [{ id: "plan_other_conflict" }];

      const res = await updatePlanAction({
        id: "plan_1",
        lineId: "line_1",
        productId: "prod_taken_by_other",
        startDate: "2026-07-08",
        endDate: "2026-09-05",
        plannedQty: 30000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Only one plan per product is allowed");
      expect(mockUpdatedPlans.length).toBe(0);
    });

    it("successfully updates plan when no conflict exists", async () => {
      mockExistingPlansInDb = [];

      const res = await updatePlanAction({
        id: "plan_1",
        lineId: "line_1",
        productId: "prod_1",
        startDate: "2026-07-08",
        endDate: "2026-09-05",
        plannedQty: 35000,
      });

      expect(res.success).toBe(true);
      expect(mockUpdatedPlans.length).toBe(1);
      expect(mockUpdatedPlans[0].plannedQty).toBe(35000);
    });
  });

  describe("batchCreatePlansAction", () => {
    it("rejects FM role with forbidden error", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue({
        id: "usr_fm_1",
        name: "Factory Manager",
        email: "fm@dpm.local",
        role: "fm",
        active: true,
        mustChangePassword: false,
      });

      const res = await batchCreatePlansAction({
        factoryId: "fac_1",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        defaultPlannedQty: 10000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("skips products that already have plans and initializes plans for unplanned products", async () => {
      // prod_1 already has a plan
      mockExistingPlansInDb = [{ productId: "prod_1" }];

      // 3 active products in plant
      mockProductsInDb = [
        { id: "prod_1", name: "Polo T-Shirt" },
        { id: "prod_2", name: "Denim Jeans" },
        { id: "prod_3", name: "Chino Pants" },
      ];

      // Lines in factory
      mockLinesInDb = [{ id: "line_default", factoryId: "fac_1" }];
      mockLineProductsInDb = [];

      const res = await batchCreatePlansAction({
        factoryId: "fac_1",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        defaultPlannedQty: 12000,
      });

      expect(res.success).toBe(true);
      expect(res.count).toBe(2); // Only prod_2 and prod_3
      expect(mockInsertedPlans.length).toBe(2);
      expect(mockInsertedPlans.map((p) => p.productId)).toEqual(["prod_2", "prod_3"]);
      expect(mockInsertedPlans[0].plannedQty).toBe(12000);
    });

    it("returns count 0 if all products already have plans", async () => {
      mockExistingPlansInDb = [{ productId: "prod_1" }, { productId: "prod_2" }];
      mockProductsInDb = [
        { id: "prod_1", name: "Polo T-Shirt" },
        { id: "prod_2", name: "Denim Jeans" },
      ];

      const res = await batchCreatePlansAction({
        factoryId: "fac_1",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        defaultPlannedQty: 10000,
      });

      expect(res.success).toBe(true);
      expect(res.count).toBe(0);
      expect(mockInsertedPlans.length).toBe(0);
    });
  });
});
