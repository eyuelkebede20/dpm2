import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getQAWorkspaceData,
  createQAInspectionAction,
  getQAInspectionsHistory,
} from "./qa-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
  can: vi.fn(),
}));

let mockAssignedProducts: any[] = [];
let mockAllProducts: any[] = [];
let mockLines: any[] = [];
let mockInspections: any[] = [];
let mockInsertedInspections: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn((condition: any) => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(mockInspections)),
            })),
            then: vi.fn((resolve) => {
              if (mockAssignedProducts.length > 0) return resolve(mockAssignedProducts);
              return resolve(mockLines);
            }),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockInspections)),
          })),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          mockInsertedInspections.push(vals);
          return Promise.resolve([{ id: vals.id }]);
        }),
      })),
    },
  };
});

describe("QA Workflows - Quality Assurance Operations", () => {
  const qaUser: authz.SessionUser = {
    id: "usr_qa_01",
    name: "Hanna QA",
    email: "qa@dpm.local",
    role: "qa",
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
    mockAssignedProducts = [];
    mockAllProducts = [];
    mockLines = [];
    mockInspections = [];
    mockInsertedInspections = [];

    vi.mocked(authz.requireUser).mockResolvedValue(qaUser);
    vi.mocked(authz.can).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getQAWorkspaceData", () => {
    it("returns assigned products and available lines for QA user", async () => {
      mockAssignedProducts = [
        { id: "prod_01", name: "T-Shirt", sku: "TS-01", factoryId: "fac_01" },
      ];
      mockLines = [{ id: "line_01", name: "Sewing Line 1", factoryId: "fac_01" }];

      const data = await getQAWorkspaceData();
      expect(data.user.id).toBe("usr_qa_01");
      expect(data.assignedProducts.length).toBe(1);
      expect(data.assignedProducts[0].name).toBe("T-Shirt");
    });
  });

  describe("createQAInspectionAction validation", () => {
    it("fails when date format is invalid", async () => {
      const res = await createQAInspectionAction({
        date: "08-11-2026",
        productId: "prod_01",
        lineId: "line_01",
        checked: 100,
        defects: 5,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid date format");
    });

    it("fails when checked quantity is less than 1", async () => {
      const res = await createQAInspectionAction({
        date: "2026-11-08",
        productId: "prod_01",
        lineId: "line_01",
        checked: 0,
        defects: 0,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("at least 1");
    });

    it("fails when defects is negative", async () => {
      const res = await createQAInspectionAction({
        date: "2026-11-08",
        productId: "prod_01",
        lineId: "line_01",
        checked: 50,
        defects: -1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("cannot be negative");
    });

    it("fails when defects exceed checked quantity", async () => {
      const res = await createQAInspectionAction({
        date: "2026-11-08",
        productId: "prod_01",
        lineId: "line_01",
        checked: 50,
        defects: 55, // Greater than checked!
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Defects cannot exceed total quantity checked");
    });

    it("fails when note exceeds 500 characters", async () => {
      const longNote = "X".repeat(501);
      const res = await createQAInspectionAction({
        date: "2026-11-08",
        productId: "prod_01",
        lineId: "line_01",
        checked: 50,
        defects: 2,
        note: longNote,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Notes cannot exceed 500 characters");
    });
  });

  describe("QA Assignment Authorization", () => {
    it("rejects inspection if QA user is not assigned to the product", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      const res = await createQAInspectionAction({
        date: "2026-11-08",
        productId: "prod_unassigned",
        lineId: "line_01",
        checked: 100,
        defects: 3,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("You are not assigned to inspect this product");
      expect(mockInsertedInspections.length).toBe(0);
    });

    it("successfully creates QA inspection when authorized", async () => {
      const res = await createQAInspectionAction({
        date: "2026-11-08",
        productId: "prod_01",
        lineId: "line_01",
        checked: 100,
        defects: 4,
        note: "Minor stitching defect on 4 pieces",
      });

      expect(res.success).toBe(true);
      expect(mockInsertedInspections.length).toBe(1);
      expect(mockInsertedInspections[0].checked).toBe(100);
      expect(mockInsertedInspections[0].defects).toBe(4);
      expect(mockInsertedInspections[0].createdBy).toBe("usr_qa_01");
      expect(mockInsertedInspections[0].note).toBe("Minor stitching defect on 4 pieces");
    });

    it("allows 0 defects (100% pass inspection)", async () => {
      const res = await createQAInspectionAction({
        date: "2026-11-08",
        productId: "prod_01",
        lineId: "line_01",
        checked: 200,
        defects: 0,
      });

      expect(res.success).toBe(true);
      expect(mockInsertedInspections.length).toBe(1);
      expect(mockInsertedInspections[0].defects).toBe(0);
    });
  });

  describe("getQAInspectionsHistory", () => {
    it("returns inspections history filtered for QA user", async () => {
      mockInspections = [
        {
          id: "qa_01",
          date: "2026-11-08",
          checked: 100,
          defects: 2,
          note: "All good",
          productName: "T-Shirt",
          productSku: "TS-01",
          lineName: "Line 1",
        },
      ];

      const history = await getQAInspectionsHistory();
      expect(history.length).toBe(1);
      expect(history[0].checked).toBe(100);
      expect(history[0].defects).toBe(2);
    });
  });
});
