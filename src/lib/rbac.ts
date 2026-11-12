import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";
import { Role, ROLES_METADATA, ALL_ROLES, OM_ASSIGNABLE_ROLES } from "./rbac-types";

export * from "./rbac-types";

/**
 * Access Control Statements for Better Auth RBAC.
 * Combines Better Auth built-in statements with DPM business resources.
 */
export const statements = {
  ...defaultStatements,
  industry_profile: ["read", "update", "manage_settings"],
  factory: ["create", "read", "update", "delete"],
  line: ["create", "read", "update", "delete"],
  product: ["create", "read", "update", "delete"],
  plan: ["create", "read", "update", "delete"],
  report_entry: ["create", "read", "update", "delete", "record_entry"],
  qa_inspection: ["create", "read", "update", "delete", "record_inspection"],
  stock_ledger: ["create", "read"],
} as const;

export type StatementMap = typeof statements;
export type ResourceType = keyof StatementMap;
export type Action<R extends ResourceType = ResourceType> = StatementMap[R][number];

/**
 * Better Auth Access Control instance
 */
export const ac = createAccessControl(statements);

/**
 * Role Definitions configured with Better Auth Access Control
 */
export const roles = {
  sys_admin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "impersonate-admins",
      "delete",
      "set-password",
      "set-email",
      "set-phone",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
    industry_profile: ["read", "update", "manage_settings"],
    factory: ["create", "read", "update", "delete"],
    line: ["create", "read", "update", "delete"],
    product: ["create", "read", "update", "delete"],
    plan: ["create", "read", "update", "delete"],
    report_entry: ["create", "read", "update", "delete", "record_entry"],
    qa_inspection: ["create", "read", "update", "delete", "record_inspection"],
    stock_ledger: ["create", "read"],
  }),

  om: ac.newRole({
    user: ["create", "list", "get", "update"],
    session: [],
    industry_profile: [],
    factory: ["create", "read", "update"],
    line: ["create", "read", "update"],
    product: ["create", "read", "update"],
    plan: ["create", "read", "update", "delete"],
    report_entry: ["read"],
    qa_inspection: ["read"],
    stock_ledger: ["create", "read"],
  }),

  fm: ac.newRole({
    user: ["get"],
    session: [],
    industry_profile: [],
    factory: ["read"],
    line: ["create", "read", "update"],
    product: ["create", "read", "update"],
    plan: ["read"],
    report_entry: ["create", "read", "update", "record_entry"],
    qa_inspection: ["read"],
    stock_ledger: ["create", "read"],
  }),

  qa: ac.newRole({
    user: [],
    session: [],
    industry_profile: [],
    factory: [],
    line: ["read"],
    product: ["read"],
    plan: [],
    report_entry: ["read"],
    qa_inspection: ["create", "read", "record_inspection"],
    stock_ledger: [],
  }),
};

/**
 * Fast helper to evaluate role permission using Better Auth's authorize logic.
 */
export function hasRolePermission(
  role: Role | string | undefined | null,
  resource: ResourceType | string,
  action: string
): boolean {
  if (!role) return false;
  const roleDef = roles[role as Role];
  if (!roleDef) return false;

  const result = roleDef.authorize({
    [resource]: [action],
  } as any);

  return result.success;
}
