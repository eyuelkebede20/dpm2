import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getQAWorkspaceData,
  createQAInspectionAction,
  getQAInspectionsHistory,
  getQAEntriesAction,
  reviewQAEntryAction,
} from "./qa-actions";
import {
  factoryUsers,
  qaAssignments,
  reportEntries,
  qaApprovals,
} from "@/db/schema";
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
let mockUserFactories: any[] = [];
let mockReportEntriesRows: any[] = [];
let mockApprovalsByEntry: any[] = [];
let mockInsertedApprovals: any[] = [];
let mockUpdatedApprovals: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn((fields?: any) => {
        const query: any = {
          _table: null,
          from: vi.fn((table: any) => {
            query._table = table;
            return query;
          }),
          innerJoin: vi.fn().mockReturnThis(),
          leftJoin: vi.fn().mockReturnThis(),
          where: vi.fn((condition: any) => query),
          orderBy: vi.fn(() => query),
          limit: vi.fn((n?: number) => {
            if (query._table === qaApprovals) {
              return Promise.resolve(mockApprovalsByEntry);
            }
            if (query._table === reportEntries) {
              return Promise.resolve(mockReportEntriesRows);
            }
            return Promise.resolve(mockInspections);
          }),
          then: vi.fn((resolve: any, reject?: any) => {
            let res = mockInspections;
            if (query._table === factoryUsers) {
              res = mockUserFactories;
            } else if (query._table === qaAssignments) {
              res = mockAssignedProducts;
            } else if (query._table === reportEntries) {
              res = mockReportEntriesRows;
            } else if (query._table === qaApprovals) {
              res = mockApprovalsByEntry;
            } else if (mockAssignedProducts.length > 0) {
              res = mockAssignedProducts;
            } else if (mockLines.length > 0) {
              res = mockLines;
            }
            return Promise.resolve(res).then(resolve, reject);
          }),
        };
        return query;
      }),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          if (table === qaApprovals || vals.reportEntryId) {
            mockInsertedApprovals.push(vals);
            return Promise.resolve([{ id: vals.id }]);
          }
          mockInsertedInspections.push(vals);
          return Promise.resolve([{ id: vals.id }]);
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn((condition: any) => {
            mockUpdatedApprovals.push(vals);
            return Promise.resolve([{ id: "updated" }]);
          }),
        })),
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
    mockUserFactories = [];
    mockReportEntriesRows = [];
    mockApprovalsByEntry = [];
    mockInsertedApprovals = [];
    mockUpdatedApprovals = [];

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

  describe("getQAEntriesAction - Simple FM Entry Approval Retrieval", () => {
    it("returns all entries for OM or sys_admin without assignment restriction", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);
      mockReportEntriesRows = [
        {
          id: "entry_1",
          date: "2026-11-09",
          lineId: "line_1",
          lineName: "Line A",
          productId: "prod_1",
          productName: "T-Shirt",
          productSku: "TS-01",
          factoryId: "fac_1",
          factoryName: "Hawassa Plant",
          finishedGood: 250,
          rework: 5,
          reject: 2,
          scrap: 1,
          wip: 20,
          downtimeMinutes: 15,
          issueNote: "Needle broken",
          downtimeReasonCode: "MCH_BRK",
          downtimeReasonName: "Machine Breakdown",
          downtimeReasonNameAm: "የማሽን ብልሽት",
          reporterName: "Abebe FM",
          updatedAt: new Date(),
          qaApprovalId: null,
          status: null,
          qaNote: null,
          qaReviewerName: null,
          qaReviewedAt: null,
        },
      ];

      const res = await getQAEntriesAction();
      expect(res.success).toBe(true);
      expect(res.entries.length).toBe(1);
      expect(res.entries[0].status).toBe("pending");
      expect(res.entries[0].finishedGood).toBe(250);
      expect(res.entries[0].reporterName).toBe("Abebe FM");
      expect(res.userRole).toBe("om");
    });

    it("filters entries by assigned products for QA role", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(qaUser);
      mockAssignedProducts = [{ productId: "prod_assigned" }];
      mockReportEntriesRows = [
        {
          id: "entry_1",
          date: "2026-11-09",
          lineId: "line_1",
          lineName: "Line A",
          productId: "prod_assigned",
          productName: "Assigned Polo",
          productSku: "AP-01",
          factoryId: "fac_1",
          factoryName: "Hawassa Plant",
          finishedGood: 300,
          rework: 0,
          reject: 1,
          scrap: 0,
          wip: 10,
          downtimeMinutes: 0,
          issueNote: null,
          status: "approved",
          qaApprovalId: "qapp_1",
          qaNote: "Passed",
          qaReviewerName: "Hanna QA",
          updatedAt: new Date(),
        },
        {
          id: "entry_2",
          date: "2026-11-09",
          lineId: "line_2",
          lineName: "Line B",
          productId: "prod_other",
          productName: "Unassigned Denim",
          productSku: "UD-01",
          factoryId: "fac_1",
          factoryName: "Hawassa Plant",
          finishedGood: 150,
          rework: 2,
          reject: 4,
          scrap: 0,
          wip: 5,
          downtimeMinutes: 30,
          issueNote: null,
          status: null,
          qaApprovalId: null,
          updatedAt: new Date(),
        },
      ];

      const res = await getQAEntriesAction();
      expect(res.success).toBe(true);
      expect(res.entries.length).toBe(1);
      expect(res.entries[0].productId).toBe("prod_assigned");
      expect(res.entries[0].status).toBe("approved");
    });
  });

  describe("reviewQAEntryAction - 1-Click Approve / Reject", () => {
    it("rejects unauthorized user roles like fm or sk", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue({
        id: "usr_fm_01",
        name: "FM User",
        email: "fm@dpm.local",
        role: "fm",
        active: true,
        mustChangePassword: false,
      });

      const res = await reviewQAEntryAction({
        reportEntryId: "entry_1",
        status: "approved",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("inserts new approval when no prior decision exists", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(qaUser);
      mockApprovalsByEntry = [];

      const res = await reviewQAEntryAction({
        reportEntryId: "entry_100",
        status: "approved",
        note: "All finished goods checked and conform to tolerance",
      });

      expect(res.success).toBe(true);
      expect(mockInsertedApprovals.length).toBe(1);
      expect(mockInsertedApprovals[0].reportEntryId).toBe("entry_100");
      expect(mockInsertedApprovals[0].status).toBe("approved");
      expect(mockInsertedApprovals[0].qaUserId).toBe("usr_qa_01");
      expect(mockInsertedApprovals[0].note).toBe("All finished goods checked and conform to tolerance");
    });

    it("updates existing approval record when reversing or changing decision", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(qaUser);
      mockApprovalsByEntry = [{ id: "existing_qapp_01" }];

      const res = await reviewQAEntryAction({
        reportEntryId: "entry_100",
        status: "rejected",
        note: "Defects higher than allowable threshold",
      });

      expect(res.success).toBe(true);
      expect(mockUpdatedApprovals.length).toBe(1);
      expect(mockUpdatedApprovals[0].status).toBe("rejected");
      expect(mockUpdatedApprovals[0].note).toBe("Defects higher than allowable threshold");
    });

    it("validates input parameters (invalid status or missing reportEntryId)", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(qaUser);

      const res1 = await reviewQAEntryAction({
        reportEntryId: "",
        status: "approved",
      });
      expect(res1.success).toBe(false);

      const res2 = await reviewQAEntryAction({
        reportEntryId: "entry_1",
        status: "maybe" as any,
      });
      expect(res2.success).toBe(false);
    });
  });
});
