import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPlanAction, updatePlanAction } from "./plan-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
  can: vi.fn(),
}));

let mockExistingPlansInDb: any[] = [];
let mockInsertedPlans: any[] = [];
let mockUpdatedPlans: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn((cond: any) => ({
            limit: vi.fn(() => Promise.resolve(mockExistingPlansInDb)),
          })),
        })),
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
});
