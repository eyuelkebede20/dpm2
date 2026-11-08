import { describe, it, expect, vi, beforeEach } from "vitest";
import { can, SessionUser } from "./authz";

describe("authz.ts - Central Authorization Guard", () => {
  const adminUser: SessionUser = {
    id: "usr_admin_01",
    name: "Admin User",
    email: "admin@dpm.local",
    role: "sys_admin",
    active: true,
    mustChangePassword: false,
  };

  const omUser: SessionUser = {
    id: "usr_om_01",
    name: "Solomon (OM)",
    email: "om@dpm.local",
    role: "om",
    active: true,
    mustChangePassword: false,
  };

  const fmUser: SessionUser = {
    id: "usr_fm_01",
    name: "Abebe (FM)",
    email: "fm@dpm.local",
    role: "fm",
    active: true,
    mustChangePassword: false,
  };

  const qaUser: SessionUser = {
    id: "usr_qa_01",
    name: "Hanna (QA)",
    email: "qa@dpm.local",
    role: "qa",
    active: true,
    mustChangePassword: false,
  };

  describe("Deny by default and Inactive users", () => {
    it("denies access if user is null or undefined", async () => {
      expect(await can(null, "read", { type: "factory" })).toBe(false);
      expect(await can(undefined, "read", { type: "factory" })).toBe(false);
    });

    it("denies access if user account is deactivated", async () => {
      const inactiveUser = { ...fmUser, active: false };
      expect(await can(inactiveUser, "read", { type: "factory" })).toBe(false);
      expect(await can(inactiveUser, "record_entry", { type: "report_entry" })).toBe(false);
    });
  });

  describe("Sys Admin Permissions", () => {
    it("grants Sys Admin access to manage industry profile", async () => {
      expect(await can(adminUser, "update", { type: "industry_profile" })).toBe(true);
    });

    it("allows Sys Admin to impersonate OM/FM in dev mode", async () => {
      (process.env as any).NODE_ENV = "development";
      process.env.ENABLE_DEV_IMPERSONATION = "true";

      expect(
        await can(adminUser, "impersonate", {
          type: "user",
          targetRole: "om",
        })
      ).toBe(true);

      expect(
        await can(adminUser, "impersonate", {
          type: "user",
          targetRole: "fm",
        })
      ).toBe(true);
    });

    it("disallows Sys Admin from impersonating another Sys Admin or QA", async () => {
      (process.env as any).NODE_ENV = "development";
      process.env.ENABLE_DEV_IMPERSONATION = "true";

      expect(
        await can(adminUser, "impersonate", {
          type: "user",
          targetRole: "sys_admin",
        })
      ).toBe(false);

      expect(
        await can(adminUser, "impersonate", {
          type: "user",
          targetRole: "qa",
        })
      ).toBe(false);
    });
  });

  describe("Operation Manager (OM) Permissions", () => {
    it("denies OM from updating industry profile", async () => {
      expect(await can(omUser, "update", { type: "industry_profile" })).toBe(false);
      expect(await can(omUser, "read", { type: "industry_profile" })).toBe(false);
    });

    it("denies OM from dev impersonation", async () => {
      expect(
        await can(omUser, "impersonate", {
          type: "user",
          targetRole: "fm",
        })
      ).toBe(false);
    });

    it("allows OM to manage FM and QA users", async () => {
      expect(
        await can(omUser, "create", {
          type: "user",
          targetRole: "fm",
        })
      ).toBe(true);

      expect(
        await can(omUser, "create", {
          type: "user",
          targetRole: "qa",
        })
      ).toBe(true);
    });

    it("denies OM from creating Sys Admin or other OMs", async () => {
      expect(
        await can(omUser, "create", {
          type: "user",
          targetRole: "sys_admin",
        })
      ).toBe(false);

      expect(
        await can(omUser, "create", {
          type: "user",
          targetRole: "om",
        })
      ).toBe(false);
    });
  });

  describe("Factory Manager (FM) Permissions", () => {
    it("denies FM from modifying industry profile or creating users", async () => {
      expect(await can(fmUser, "update", { type: "industry_profile" })).toBe(false);
      expect(await can(fmUser, "create", { type: "user" })).toBe(false);
    });

    it("denies FM from submitting QA inspections directly", async () => {
      expect(
        await can(fmUser, "record_inspection", {
          type: "qa_inspection",
          productId: "prod_1",
        })
      ).toBe(false);
    });
  });

  describe("QA Inspector Permissions", () => {
    it("denies QA from managing factories, lines, products, or plans", async () => {
      expect(await can(qaUser, "create", { type: "factory" })).toBe(false);
      expect(await can(qaUser, "create", { type: "line" })).toBe(false);
      expect(await can(qaUser, "create", { type: "product" })).toBe(false);
      expect(await can(qaUser, "create", { type: "plan" })).toBe(false);
    });

    it("allows QA to read lines and products", async () => {
      expect(await can(qaUser, "read", { type: "line" })).toBe(true);
      expect(await can(qaUser, "read", { type: "product" })).toBe(true);
    });
  });
});
