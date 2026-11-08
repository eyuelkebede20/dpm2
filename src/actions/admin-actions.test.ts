import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getIndustryProfile,
  updateIndustryProfileAction,
  getOperationManagers,
  getAllUsersForAdmin,
  createOperationManagerAction,
  createUserAction,
  updateUserRoleAction,
  toggleUserActiveAction,
  getImpersonationCandidates,
  adminResetPasswordAction,
} from "./admin-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
  can: vi.fn(),
}));

let mockProfileInDb: any = null;
let mockUsersInDb: any[] = [];
let mockInsertedUsers: any[] = [];
let mockInsertedAccounts: any[] = [];
let mockUpdatedUsers: any[] = [];

vi.mock("@/db", () => {
  const tx = {
    select: vi.fn((fields?: any) => ({
      from: vi.fn((table: any) => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ id: "acc_existing" }])),
        })),
      })),
    })),
    insert: vi.fn((table: any) => ({
      values: vi.fn((vals: any) => {
        if (vals.role) {
          mockInsertedUsers.push(vals);
        } else if (vals.providerId) {
          mockInsertedAccounts.push(vals);
        }
        return Promise.resolve([{ id: vals.id }]);
      }),
    })),
    update: vi.fn((table: any) => ({
      set: vi.fn((vals: any) => ({
        where: vi.fn((condition: any) => {
          mockUpdatedUsers.push(vals);
          return Promise.resolve({ rowCount: 1 });
        }),
      })),
    })),
    delete: vi.fn((table: any) => ({
      where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
    })),
  };

  return {
    db: {
      select: vi.fn((fields?: any) => ({
        from: vi.fn((table: any) => ({
          where: vi.fn((condition: any) => ({
            limit: vi.fn(() => Promise.resolve(mockProfileInDb ? [mockProfileInDb] : [])),
            orderBy: vi.fn(() => Promise.resolve(mockUsersInDb)),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
            filter: vi.fn(() => []),
          })),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => ({
          returning: vi.fn().mockResolvedValue([vals]),
          onConflictDoUpdate: vi.fn().mockResolvedValue([vals]),
        })),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn((condition: any) => {
            mockUpdatedUsers.push(vals);
            return Promise.resolve({ rowCount: 1 });
          }),
        })),
      })),
      transaction: vi.fn(async (cb: any) => cb(tx)),
    },
  };
});

describe("Admin Workflows - Sys Admin Operations", () => {
  const adminUser: authz.SessionUser = {
    id: "usr_admin_01",
    name: "System Admin",
    email: "admin@dpm.local",
    role: "sys_admin",
    active: true,
    mustChangePassword: false,
  };

  const omUser: authz.SessionUser = {
    id: "usr_om_01",
    name: "Operation Manager",
    email: "om@dpm.local",
    role: "om",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileInDb = null;
    mockUsersInDb = [];
    mockInsertedUsers = [];
    mockInsertedAccounts = [];
    mockUpdatedUsers = [];

    vi.mocked(authz.requireUser).mockResolvedValue(adminUser);
    vi.mocked(authz.can).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Industry Profile Management", () => {
    it("returns existing industry profile", async () => {
      mockProfileInDb = {
        id: "default",
        companyName: "Acme Manufacturing",
        workingDays: [1, 2, 3, 4, 5],
        units: "kg",
      };

      const profile = await getIndustryProfile();
      expect(profile.companyName).toBe("Acme Manufacturing");
      expect(profile.units).toBe("kg");
      expect(profile.workingDays).toEqual([1, 2, 3, 4, 5]);
    });

    it("creates and returns default profile if none exists", async () => {
      mockProfileInDb = null;

      const profile = await getIndustryProfile();
      expect(profile.id).toBe("default");
      expect(profile.companyName).toBe("Daily Production Manager");
      expect(profile.units).toBe("pcs");
      expect(profile.workingDays).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("throws when user is not authorized to read industry profile", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      await expect(getIndustryProfile()).rejects.toThrow("Forbidden");
    });

    it("fails updating profile when caller lacks permission", async () => {
      vi.mocked(authz.can).mockResolvedValue(false);

      const res = await updateIndustryProfileAction({
        companyName: "Updated Name",
        workingDays: [1, 2, 3, 4, 5],
        units: "pcs",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("fails updating profile with invalid inputs", async () => {
      // Empty company name
      const res1 = await updateIndustryProfileAction({
        companyName: "",
        workingDays: [1, 2],
        units: "pcs",
      });
      expect(res1.success).toBe(false);

      // Empty working days
      const res2 = await updateIndustryProfileAction({
        companyName: "Valid Name",
        workingDays: [],
        units: "pcs",
      });
      expect(res2.success).toBe(false);

      // Invalid working day (<0 or >6)
      const res3 = await updateIndustryProfileAction({
        companyName: "Valid Name",
        workingDays: [7],
        units: "pcs",
      });
      expect(res3.success).toBe(false);
    });

    it("successfully updates industry profile with valid inputs", async () => {
      const res = await updateIndustryProfileAction({
        companyName: "Ethiopian Garment Factory",
        workingDays: [1, 2, 3, 4, 5, 6],
        units: "meters",
      });

      expect(res.success).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("Operation Manager Creation & Listing", () => {
    it("denies non-Sys Admin from viewing OM list", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      await expect(getOperationManagers()).rejects.toThrow("Forbidden");
    });

    it("returns list of OMs for Sys Admin", async () => {
      mockUsersInDb = [
        {
          id: "usr_om_1",
          name: "Manager 1",
          email: "m1@dpm.local",
          active: true,
          mustChangePassword: false,
          createdAt: new Date(),
        },
      ];

      const list = await getOperationManagers();
      expect(list.length).toBe(1);
      expect(list[0].email).toBe("m1@dpm.local");
    });

    it("denies non-Sys Admin from creating an OM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await createOperationManagerAction({
        name: "New OM",
        email: "newom@dpm.local",
        password: "ValidSecurePassword123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("fails OM creation when password is too short (< 12 characters)", async () => {
      const res = await createOperationManagerAction({
        name: "New OM",
        email: "newom@dpm.local",
        password: "shortpass",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("at least 12 characters");
    });

    it("fails OM creation with invalid email", async () => {
      const res = await createOperationManagerAction({
        name: "New OM",
        email: "invalid-email-address",
        password: "ValidSecurePassword123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid email");
    });

    it("fails OM creation if email already exists", async () => {
      // Mock existing user query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "usr_existing" }]),
          })),
        })),
      } as any);

      const res = await createOperationManagerAction({
        name: "Duplicate OM",
        email: "existing@dpm.local",
        password: "ValidSecurePassword123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("already exists");
    });

    it("successfully creates OM with mustChangePassword = true in transaction", async () => {
      // No existing user
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const res = await createOperationManagerAction({
        name: "Solomon OM",
        email: "solomon@dpm.local",
        password: "TemporaryPassword123!",
      });

      expect(res.success).toBe(true);
      expect(mockInsertedUsers.length).toBe(1);
      expect(mockInsertedUsers[0].name).toBe("Solomon OM");
      expect(mockInsertedUsers[0].role).toBe("om");
      expect(mockInsertedUsers[0].mustChangePassword).toBe(true);
      expect(mockInsertedUsers[0].active).toBe(true);

      expect(mockInsertedAccounts.length).toBe(1);
      expect(mockInsertedAccounts[0].providerId).toBe("credential");
    });
  });

  describe("User Deactivation / Activation", () => {
    it("denies non-Sys Admin from toggling user status", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await toggleUserActiveAction("usr_target", false);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden");
    });

    it("allows Sys Admin to toggle user active status", async () => {
      const res = await toggleUserActiveAction("usr_target", false);
      expect(res.success).toBe(true);
      expect(mockUpdatedUsers.length).toBe(1);
      expect(mockUpdatedUsers[0].active).toBe(false);
    });
  });

  describe("Dev Impersonation Candidates", () => {
    it("returns empty array for non-Sys Admin", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const candidates = await getImpersonationCandidates();
      expect(candidates).toEqual([]);
    });

    it("returns empty array when dev impersonation flag is not true", async () => {
      (process.env as any).NODE_ENV = "development";
      process.env.ENABLE_DEV_IMPERSONATION = "false";

      const candidates = await getImpersonationCandidates();
      expect(candidates).toEqual([]);
    });

    it("returns OM and FM candidates when dev impersonation is enabled", async () => {
      (process.env as any).NODE_ENV = "development";
      process.env.ENABLE_DEV_IMPERSONATION = "true";

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([
              { id: "usr_om", name: "OM User", email: "om@dpm.local", role: "om" },
              { id: "usr_fm", name: "FM User", email: "fm@dpm.local", role: "fm" },
              { id: "usr_qa", name: "QA User", email: "qa@dpm.local", role: "qa" },
            ]),
          })),
        })),
      } as any);

      const candidates = await getImpersonationCandidates();
      expect(candidates.length).toBe(2);
      expect(candidates.map((c) => c.role)).toEqual(["om", "fm"]);
    });
  });

  describe("Role Assigning Table & User Provisioning (RBAC)", () => {
    it("allows Sys Admin to provision users with any supported role", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);

      const res = await createUserAction({
        name: "Abebe FM",
        email: "abebe.fm@dpm.local",
        password: "TemporaryPass123!",
        role: "fm",
      });

      expect(res.success).toBe(true);
      expect(mockInsertedUsers.length).toBe(1);
      expect(mockInsertedUsers[0].name).toBe("Abebe FM");
      expect(mockInsertedUsers[0].role).toBe("fm");
      expect(mockInsertedUsers[0].mustChangePassword).toBe(true);
    });

    it("allows Sys Admin to reassign any user role", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);

      const res = await updateUserRoleAction("usr_target_01", "om");
      expect(res.success).toBe(true);
      expect(mockUpdatedUsers.length).toBe(1);
      expect(mockUpdatedUsers[0].role).toBe("om");
    });

    it("prevents Sys Admin from demoting their own admin account", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);

      const res = await updateUserRoleAction("usr_admin_01", "qa");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot demote your own Sys Admin account");
    });

    it("rejects non-admin from reassigning roles", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await updateUserRoleAction("usr_target_01", "sys_admin");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });
  });

  describe("Admin Password Reset", () => {
    it("denies non-Sys Admin from resetting user passwords", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await adminResetPasswordAction({
        userId: "usr_target_01",
        newPassword: "NewSecurePassword123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("fails reset when password is too short (< 12 characters)", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);

      const res = await adminResetPasswordAction({
        userId: "usr_target_01",
        newPassword: "short",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("at least 12 characters");
    });

    it("fails reset when target user is not found in database", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      } as any);

      const res = await adminResetPasswordAction({
        userId: "usr_nonexistent",
        newPassword: "NewSecurePassword123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("User not found");
    });

    it("successfully resets user password, updates mustChangePassword flag, and revokes active sessions", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(adminUser);
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              { id: "usr_target_01", name: "Target User", email: "target@dpm.local" },
            ]),
          })),
        })),
      } as any);

      const res = await adminResetPasswordAction({
        userId: "usr_target_01",
        newPassword: "NewSecurePassword123!",
        mustChangePassword: true,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("Target User");
      expect(mockUpdatedUsers.some((u) => u.mustChangePassword === true)).toBe(true);
    });
  });
});
