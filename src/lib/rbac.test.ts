import { describe, it, expect } from "vitest";
import { ac, roles, hasRolePermission, statements } from "./rbac";
import { authClient } from "./auth-client";

describe("Better Auth RBAC Configuration", () => {
  describe("Statements and Roles Initialization", () => {
    it("exports access control instance with all required resources", () => {
      expect(ac).toBeDefined();
      expect(statements.industry_profile).toBeDefined();
      expect(statements.factory).toBeDefined();
      expect(statements.line).toBeDefined();
      expect(statements.product).toBeDefined();
      expect(statements.plan).toBeDefined();
      expect(statements.report_entry).toBeDefined();
      expect(statements.qa_inspection).toBeDefined();
      expect(statements.stock_ledger).toBeDefined();
      expect(statements.user).toBeDefined();
      expect(statements.session).toBeDefined();
    });

    it("initializes all 4 system roles", () => {
      expect(roles.sys_admin).toBeDefined();
      expect(roles.om).toBeDefined();
      expect(roles.fm).toBeDefined();
      expect(roles.qa).toBeDefined();
    });
  });

  describe("System Administrator (sys_admin) RBAC Permissions", () => {
    it("has full permissions across all domain resources", () => {
      expect(hasRolePermission("sys_admin", "industry_profile", "update")).toBe(true);
      expect(hasRolePermission("sys_admin", "industry_profile", "manage_settings")).toBe(true);
      expect(hasRolePermission("sys_admin", "factory", "create")).toBe(true);
      expect(hasRolePermission("sys_admin", "factory", "delete")).toBe(true);
      expect(hasRolePermission("sys_admin", "user", "create")).toBe(true);
      expect(hasRolePermission("sys_admin", "user", "impersonate")).toBe(true);
      expect(hasRolePermission("sys_admin", "report_entry", "record_entry")).toBe(true);
      expect(hasRolePermission("sys_admin", "qa_inspection", "record_inspection")).toBe(true);
      expect(hasRolePermission("sys_admin", "stock_ledger", "read")).toBe(true);
    });

    it("authorizes directly via Better Auth role object", () => {
      const res = roles.sys_admin.authorize({
        factory: ["create", "delete"],
        user: ["create", "set-role"],
      });
      expect(res.success).toBe(true);
    });
  });

  describe("Operation Manager (om) RBAC Permissions", () => {
    it("can manage factories, lines, products, plans, and users (FM/QA)", () => {
      expect(hasRolePermission("om", "factory", "create")).toBe(true);
      expect(hasRolePermission("om", "factory", "read")).toBe(true);
      expect(hasRolePermission("om", "factory", "update")).toBe(true);
      expect(hasRolePermission("om", "user", "create")).toBe(true);
      expect(hasRolePermission("om", "line", "create")).toBe(true);
      expect(hasRolePermission("om", "product", "create")).toBe(true);
      expect(hasRolePermission("om", "plan", "create")).toBe(true);
      expect(hasRolePermission("om", "report_entry", "read")).toBe(true);
      expect(hasRolePermission("om", "stock_ledger", "read")).toBe(true);
    });

    it("is denied system-level and dev permissions", () => {
      expect(hasRolePermission("om", "industry_profile", "update")).toBe(false);
      expect(hasRolePermission("om", "industry_profile", "read")).toBe(false);
      expect(hasRolePermission("om", "user", "impersonate")).toBe(false);
      expect(hasRolePermission("om", "user", "delete")).toBe(false);
      expect(hasRolePermission("om", "qa_inspection", "create")).toBe(false);
    });
  });

  describe("Factory Manager (fm) RBAC Permissions", () => {
    it("can create lines, products, plans, and record production entries", () => {
      expect(hasRolePermission("fm", "factory", "read")).toBe(true);
      expect(hasRolePermission("fm", "line", "create")).toBe(true);
      expect(hasRolePermission("fm", "product", "create")).toBe(true);
      expect(hasRolePermission("fm", "plan", "create")).toBe(true);
      expect(hasRolePermission("fm", "report_entry", "create")).toBe(true);
      expect(hasRolePermission("fm", "report_entry", "record_entry")).toBe(true);
      expect(hasRolePermission("fm", "stock_ledger", "read")).toBe(true);
    });

    it("is denied user provisioning, industry profile edits, and QA inspection", () => {
      expect(hasRolePermission("fm", "user", "create")).toBe(false);
      expect(hasRolePermission("fm", "user", "delete")).toBe(false);
      expect(hasRolePermission("fm", "industry_profile", "update")).toBe(false);
      expect(hasRolePermission("fm", "industry_profile", "read")).toBe(false);
      expect(hasRolePermission("fm", "qa_inspection", "record_inspection")).toBe(false);
      expect(hasRolePermission("fm", "qa_inspection", "create")).toBe(false);
    });
  });

  describe("Quality Assurance (qa) RBAC Permissions", () => {
    it("can record QA inspections and view lines and products", () => {
      expect(hasRolePermission("qa", "qa_inspection", "create")).toBe(true);
      expect(hasRolePermission("qa", "qa_inspection", "record_inspection")).toBe(true);
      expect(hasRolePermission("qa", "qa_inspection", "read")).toBe(true);
      expect(hasRolePermission("qa", "line", "read")).toBe(true);
      expect(hasRolePermission("qa", "product", "read")).toBe(true);
      expect(hasRolePermission("qa", "report_entry", "read")).toBe(true);
    });

    it("is denied factory modifications, line creation, plan creation, and user management", () => {
      expect(hasRolePermission("qa", "factory", "create")).toBe(false);
      expect(hasRolePermission("qa", "line", "create")).toBe(false);
      expect(hasRolePermission("qa", "product", "create")).toBe(false);
      expect(hasRolePermission("qa", "plan", "create")).toBe(false);
      expect(hasRolePermission("qa", "report_entry", "record_entry")).toBe(false);
      expect(hasRolePermission("qa", "user", "create")).toBe(false);
      expect(hasRolePermission("qa", "stock_ledger", "read")).toBe(false);
    });
  });

  describe("Client-Side Better Auth RBAC (authClient.admin)", () => {
    it("has admin plugin mounted on authClient", () => {
      expect(authClient.admin).toBeDefined();
      expect(typeof authClient.admin.checkRolePermission).toBe("function");
    });

    it("evaluates role permissions correctly on the client", () => {
      expect(
        authClient.admin.checkRolePermission({
          role: "sys_admin",
          permissions: { industry_profile: ["update"] },
        } as any)
      ).toBe(true);

      expect(
        authClient.admin.checkRolePermission({
          role: "om",
          permissions: { factory: ["create"] },
        } as any)
      ).toBe(true);

      expect(
        authClient.admin.checkRolePermission({
          role: "om",
          permissions: { industry_profile: ["update"] },
        } as any)
      ).toBe(false);

      expect(
        authClient.admin.checkRolePermission({
          role: "fm",
          permissions: { report_entry: ["record_entry"] },
        } as any)
      ).toBe(true);

      expect(
        authClient.admin.checkRolePermission({
          role: "fm",
          permissions: { qa_inspection: ["record_inspection"] },
        } as any)
      ).toBe(false);

      expect(
        authClient.admin.checkRolePermission({
          role: "qa",
          permissions: { qa_inspection: ["record_inspection"] },
        } as any)
      ).toBe(true);

      expect(
        authClient.admin.checkRolePermission({
          role: "qa",
          permissions: { factory: ["create"] },
        } as any)
      ).toBe(false);
    });
  });
});
