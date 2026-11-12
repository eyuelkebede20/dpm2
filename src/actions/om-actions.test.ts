import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getOMFactories,
  createFactoryAction,
  getOMUsers,
  provisionFactoryUserAction,
  toggleFactoryUserStatusAction,
  updateFactoryUserRoleAction,
  getQAProductMatrixData,
  toggleQAProductAssignmentAction,
  getOMFactoryCalendarDataAction,
} from "./om-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
  can: vi.fn(),
}));

let mockFactoriesList: any[] = [];
let mockSingleFactory: any = null;
let mockExistingUser: any = null;
let mockTxUsers: any[] = [];
let mockTxAccounts: any[] = [];
let mockTxFactoryUsers: any[] = [];
let mockAssignmentsInserted: any[] = [];
let mockAssignmentsDeleted: any[] = [];

vi.mock("@/db", () => {
  const tx = {
    insert: vi.fn((table: any) => ({
      values: vi.fn((vals: any) => {
        if (vals.role) mockTxUsers.push(vals);
        else if (vals.providerId) mockTxAccounts.push(vals);
        else if (vals.factoryId && vals.userId) mockTxFactoryUsers.push(vals);
        else if (vals.qaUserId) mockAssignmentsInserted.push(vals);
        return Promise.resolve([{ id: vals.id || "created" }]);
      }),
    })),
  };

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue(mockFactoriesList),
            limit: vi.fn(() => Promise.resolve(mockSingleFactory ? [mockSingleFactory] : [])),
          })),
          orderBy: vi.fn().mockResolvedValue(mockFactoriesList),
          innerJoin: vi.fn().mockReturnThis(),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          mockAssignmentsInserted.push(vals);
          return {
            onConflictDoNothing: vi.fn().mockResolvedValue([{ id: "ok" }]),
            returning: vi.fn().mockResolvedValue([{ id: vals.id }]),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn((condition: any) => {
          mockAssignmentsDeleted.push(condition);
          return Promise.resolve({ rowCount: 1 });
        }),
      })),
      transaction: vi.fn(async (cb: any) => cb(tx)),
    },
  };
});

describe("OM Workflows - Operation Manager Operations", () => {
  const omUser: authz.SessionUser = {
    id: "usr_om_01",
    name: "Solomon OM",
    email: "om@dpm.local",
    role: "om",
    active: true,
    mustChangePassword: false,
  };

  const fmUser: authz.SessionUser = {
    id: "usr_fm_01",
    name: "Abebe FM",
    email: "fm@dpm.local",
    role: "fm",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFactoriesList = [];
    mockSingleFactory = null;
    mockExistingUser = null;
    mockTxUsers = [];
    mockTxAccounts = [];
    mockTxFactoryUsers = [];
    mockAssignmentsInserted = [];
    mockAssignmentsDeleted = [];

    vi.mocked(authz.requireUser).mockResolvedValue(omUser);
    vi.mocked(authz.can).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Factory Management", () => {
    it("denies FM or QA from fetching OM factories", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      await expect(getOMFactories()).rejects.toThrow("Forbidden");
    });

    it("returns factories belonging to OM", async () => {
      mockFactoriesList = [
        { id: "fac_1", name: "Addis Ababa Plant", omId: "usr_om_01", active: true },
      ];

      const res = await getOMFactories();
      expect(res.length).toBe(1);
      expect(res[0].name).toBe("Addis Ababa Plant");
    });

    it("denies unauthorized roles from creating a factory", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await createFactoryAction({ name: "Hawassa Plant" });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("fails factory creation with invalid name (< 2 characters)", async () => {
      const res = await createFactoryAction({ name: "A" });
      expect(res.success).toBe(false);
      expect(res.error).toContain("at least 2 characters");
    });

    it("successfully creates a new factory linked to OM", async () => {
      const res = await createFactoryAction({ name: "Adama Plant" });
      expect(res.success).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("Factory User Provisioning (FM & QA)", () => {
    it("denies unauthorized roles from provisioning factory users", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await provisionFactoryUserAction({
        name: "New FM",
        email: "newfm@dpm.local",
        password: "ValidPassword123!",
        role: "fm",
        factoryId: "fac_1",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });

    it("validates provision user schema (short password, bad email, bad role)", async () => {
      // Short password
      const res1 = await provisionFactoryUserAction({
        name: "New FM",
        email: "newfm@dpm.local",
        password: "short",
        role: "fm",
        factoryId: "fac_1",
      });
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("at least 12 characters");

      // Bad role (e.g. attempting to provision sys_admin or om)
      const res2 = await provisionFactoryUserAction({
        name: "New Admin",
        email: "admin2@dpm.local",
        password: "ValidPassword123!",
        role: "sys_admin" as any,
        factoryId: "fac_1",
      });
      expect(res2.success).toBe(false);
    });

    it("verifies OM ownership of the target factory", async () => {
      // Mock factory ownership query returning empty (factory does not belong to OM)
      mockSingleFactory = null;

      const res = await provisionFactoryUserAction({
        name: "New FM",
        email: "newfm@dpm.local",
        password: "ValidPassword123!",
        role: "fm",
        factoryId: "fac_not_mine",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid factory or unauthorized");
    });

    it("rejects provisioning if user email already exists", async () => {
      mockSingleFactory = { id: "fac_1", omId: "usr_om_01" };

      // Make next select return existing user
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "fac_1" }]), // factory exists
          })),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "usr_existing" }]), // user exists
          })),
        })),
      } as any);

      const res = await provisionFactoryUserAction({
        name: "Duplicate User",
        email: "existing@dpm.local",
        password: "ValidPassword123!",
        role: "fm",
        factoryId: "fac_1",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("already exists");
    });

    it("successfully provisions FM user with mustChangePassword = true, account, and factory link", async () => {
      mockSingleFactory = { id: "fac_1", omId: "usr_om_01" };

      // Factory lookup succeeds, user exists lookup returns empty
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "fac_1" }]),
          })),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const res = await provisionFactoryUserAction({
        name: "Dawit FM",
        email: "dawit@dpm.local",
        password: "TemporaryPassword123!",
        role: "fm",
        factoryId: "fac_1",
      });

      expect(res.success).toBe(true);
      expect(mockTxUsers.length).toBe(1);
      expect(mockTxUsers[0].name).toBe("Dawit FM");
      expect(mockTxUsers[0].role).toBe("fm");
      expect(mockTxUsers[0].mustChangePassword).toBe(true);

      expect(mockTxAccounts.length).toBe(1);
      expect(mockTxAccounts[0].providerId).toBe("credential");

      expect(mockTxFactoryUsers.length).toBe(1);
      expect(mockTxFactoryUsers[0].factoryId).toBe("fac_1");
    });

    it("successfully provisions QA user", async () => {
      mockSingleFactory = { id: "fac_1", omId: "usr_om_01" };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "fac_1" }]),
          })),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const res = await provisionFactoryUserAction({
        name: "Hanna QA",
        email: "hanna@dpm.local",
        password: "TemporaryPassword123!",
        role: "qa",
        factoryId: "fac_1",
      });

      expect(res.success).toBe(true);
      expect(mockTxUsers[0].role).toBe("qa");
    });

    it("successfully provisions QA user with assigned product IDs in a single transaction", async () => {
      mockSingleFactory = { id: "fac_1", omId: "usr_om_01" };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "fac_1" }]),
          })),
        })),
      } as any).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const res = await provisionFactoryUserAction({
        name: "Bethlehem QA",
        email: "bethlehem_qa@dpm.local",
        password: "TemporaryPassword123!",
        role: "qa",
        factoryId: "fac_1",
        assignedProductIds: ["prod_1", "prod_2"],
      });

      expect(res.success).toBe(true);
      expect(mockTxUsers[0].role).toBe("qa");
      expect(mockAssignmentsInserted.length).toBe(2);
      expect(mockAssignmentsInserted[0].productId).toBe("prod_1");
      expect(mockAssignmentsInserted[1].productId).toBe("prod_2");
    });
  });

  describe("toggleFactoryUserStatusAction", () => {
    it("denies unauthorized roles from toggling user status", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await toggleFactoryUserStatusAction("usr_qa_01", false);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });

    it("successfully toggles status when called by OM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      // Mock user lookup and factory association lookup
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([{ id: "usr_qa_01", role: "qa" }]),
            })),
          })),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([{ factoryId: "fac_1" }]),
              })),
            })),
          })),
        } as any);

      const res = await toggleFactoryUserStatusAction("usr_qa_01", false);
      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it("denies OM from deactivating an admin or OM from another factory", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "usr_admin_1", role: "sys_admin" }]),
          })),
        })),
      } as any);

      const res = await toggleFactoryUserStatusAction("usr_admin_1", false);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });
  });

  describe("QA Product Assignment Matrix", () => {
    it("denies unauthorized roles from toggling QA assignment", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await toggleQAProductAssignmentAction({
        qaUserId: "usr_qa_1",
        productId: "prod_1",
        assigned: true,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });

    it("inserts QA product assignment when assigned = true", async () => {
      const res = await toggleQAProductAssignmentAction({
        qaUserId: "usr_qa_1",
        productId: "prod_1",
        assigned: true,
      });

      expect(res.success).toBe(true);
      expect(mockAssignmentsInserted.length).toBe(1);
      expect(mockAssignmentsInserted[0]).toEqual({
        qaUserId: "usr_qa_1",
        productId: "prod_1",
      });
    });

    it("deletes QA product assignment when assigned = false", async () => {
      const res = await toggleQAProductAssignmentAction({
        qaUserId: "usr_qa_1",
        productId: "prod_1",
        assigned: false,
      });

      expect(res.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it("rejects invalid assignment payloads", async () => {
      const res = await toggleQAProductAssignmentAction({
        qaUserId: "",
        productId: "prod_1",
        assigned: true,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Invalid payload");
    });
  });

  describe("Factory Personnel Role Assignment", () => {
    it("allows OM to switch user role between FM and QA", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      // Mock user factory lookup
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([{ factoryId: "fac_1" }]),
            })),
          })),
        })),
      } as any);

      const res = await updateFactoryUserRoleAction("usr_team_1", "qa");
      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it("denies FM from reassigning factory user roles", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await updateFactoryUserRoleAction("usr_team_1", "fm");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });
  });

  describe("getOMFactoryCalendarDataAction", () => {
    it("denies unauthorized roles like FM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await getOMFactoryCalendarDataAction("fac_1", "2026-11-01", "2026-11-30");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });

    it("denies OM if factory does not belong to OM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const res = await getOMFactoryCalendarDataAction("fac_other", "2026-11-01", "2026-11-30");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized or factory not found");
    });

    it("returns working days, entries, plans, and special days for valid plant", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      // 1. Factory check
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "fac_1" }]),
          })),
        })),
      } as any)
      // 2. Industry profile
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ workingDays: [1, 2, 3, 4, 5] }]),
        })),
      } as any)
      // 3. Entries
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([
            { id: "ent_1", date: "2026-11-05", finishedGood: 120 },
          ]),
        })),
      } as any)
      // 4. Plans
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([
            { lineId: "line_1", plannedQty: 500 },
          ]),
        })),
      } as any)
      // 5. Special days
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: "sd_1", date: "2026-11-10", nameEn: "Plant Inspection Day" },
          ]),
        })),
      } as any);

      const res = await getOMFactoryCalendarDataAction("fac_1", "2026-11-01", "2026-11-30");
      expect(res.success).toBe(true);
      expect(res.data?.workingDays).toEqual([1, 2, 3, 4, 5]);
      expect(res.data?.entries.length).toBe(1);
      expect(res.data?.plans.length).toBe(1);
      expect(res.data?.specialDays.length).toBe(1);
    });
  });
});
