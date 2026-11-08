import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, factoryUsers, qaAssignments, lines, factories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hasRolePermission, ac, roles, ResourceType as RbacResourceType, Action as RbacAction } from "@/lib/rbac";

export { hasRolePermission, ac, roles };

export type Role = "sys_admin" | "om" | "fm" | "qa";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  impersonatedBy?: string; // If Sys Admin is impersonating
}

export type Action =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "impersonate"
  | "record_entry"
  | "record_inspection"
  | "manage_settings";

export type ResourceType =
  | "industry_profile"
  | "user"
  | "factory"
  | "line"
  | "product"
  | "plan"
  | "report_entry"
  | "qa_inspection"
  | "stock_ledger";

export interface ResourceContext {
  type: ResourceType;
  factoryId?: string;
  omId?: string;
  productId?: string;
  lineId?: string;
  targetRole?: Role;
  targetUserId?: string;
}

/**
 * Server-side helper to retrieve the authenticated session user.
 * Supports Dev Impersonation for Sys Admin when enabled.
 * Throws or returns null if not authenticated.
 */
export async function requireUser(): Promise<SessionUser> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session || !session.user) {
    throw new Error("Unauthorized: Authentication required");
  }

  const rawUser = session.user as unknown as {
    id: string;
    name: string;
    email: string;
    role: Role;
    active: boolean;
    mustChangePassword: boolean;
  };

  if (!rawUser.active) {
    throw new Error("Forbidden: User account is inactive");
  }

  // Check Dev Impersonation if Sys Admin
  if (
    rawUser.role === "sys_admin" &&
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_IMPERSONATION === "true"
  ) {
    const cookieStore = await cookies();
    const impersonateUserId = cookieStore.get("dpm_impersonate_user_id")?.value;
    if (impersonateUserId) {
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, impersonateUserId))
        .limit(1);

      if (targetUser && targetUser.active && ["om", "fm"].includes(targetUser.role)) {
        return {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role as Role,
          active: targetUser.active,
          mustChangePassword: targetUser.mustChangePassword,
          impersonatedBy: rawUser.id,
        };
      }
    }
  }

  return {
    id: rawUser.id,
    name: rawUser.name,
    email: rawUser.email,
    role: rawUser.role || "qa",
    active: rawUser.active ?? true,
    mustChangePassword: rawUser.mustChangePassword ?? false,
  };
}

/**
 * Gets session details including impersonation status if Sys Admin.
 */
export async function getSessionContext(): Promise<{
  user: SessionUser | null;
  rawAdminUser: SessionUser | null;
  isImpersonating: boolean;
}> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session || !session.user) {
      return { user: null, rawAdminUser: null, isImpersonating: false };
    }

    const rawUser = session.user as unknown as {
      id: string;
      name: string;
      email: string;
      role: Role;
      active: boolean;
      mustChangePassword: boolean;
    };

    if (!rawUser.active) {
      return { user: null, rawAdminUser: null, isImpersonating: false };
    }

    if (
      rawUser.role === "sys_admin" &&
      process.env.NODE_ENV !== "production" &&
      process.env.ENABLE_DEV_IMPERSONATION === "true"
    ) {
      const cookieStore = await cookies();
      const impersonateUserId = cookieStore.get("dpm_impersonate_user_id")?.value;
      if (impersonateUserId) {
        const [targetUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, impersonateUserId))
          .limit(1);

        if (targetUser && targetUser.active && ["om", "fm"].includes(targetUser.role)) {
          return {
            user: {
              id: targetUser.id,
              name: targetUser.name,
              email: targetUser.email,
              role: targetUser.role as Role,
              active: targetUser.active,
              mustChangePassword: targetUser.mustChangePassword,
              impersonatedBy: rawUser.id,
            },
            rawAdminUser: {
              id: rawUser.id,
              name: rawUser.name,
              email: rawUser.email,
              role: rawUser.role,
              active: rawUser.active,
              mustChangePassword: rawUser.mustChangePassword,
            },
            isImpersonating: true,
          };
        }
      }
    }

    const standardUser: SessionUser = {
      id: rawUser.id,
      name: rawUser.name,
      email: rawUser.email,
      role: rawUser.role || "qa",
      active: rawUser.active ?? true,
      mustChangePassword: rawUser.mustChangePassword ?? false,
    };

    return {
      user: standardUser,
      rawAdminUser: rawUser.role === "sys_admin" ? standardUser : null,
      isImpersonating: false,
    };
  } catch {
    return { user: null, rawAdminUser: null, isImpersonating: false };
  }
}

/**
 * Pure authorization check: can(user, action, resource)
 * Deny by default. Enforces role and factory/product scope.
 */
export async function can(
  user: SessionUser | null | undefined,
  action: Action,
  resource: ResourceContext
): Promise<boolean> {
  if (!user || !user.active) return false;

  // 1. Sys Admin privileges
  if (user.role === "sys_admin") {
    // Sys Admin can impersonate OM/FM in dev mode
    if (action === "impersonate") {
      const isDev = process.env.NODE_ENV !== "production";
      const impersonationEnabled = process.env.ENABLE_DEV_IMPERSONATION === "true";
      return isDev && impersonationEnabled && (resource.targetRole === "om" || resource.targetRole === "fm");
    }
    return true; // Sys Admin can access all resources
  }

  // 2. Evaluate Role-Based Access Control (RBAC) via Better Auth Access Control
  if (!hasRolePermission(user.role, resource.type, action)) {
    return false;
  }

  // 3. Resource-specific scoping & tenancy checks (ABAC / Tenancy)
  // Operation Manager (OM) scoping
  if (user.role === "om") {
    // OM managing users: can only manage FM and QA (cannot provision sys_admin or other OMs)
    if (resource.type === "user") {
      if (resource.targetRole && ["sys_admin", "om"].includes(resource.targetRole)) {
        return false;
      }
      return true;
    }

    // Scoped to factories owned by this OM
    if (resource.factoryId) {
      const [factory] = await db
        .select({ id: factories.id, omId: factories.omId })
        .from(factories)
        .where(eq(factories.id, resource.factoryId))
        .limit(1);

      if (!factory || factory.omId !== user.id) {
        return false;
      }
    }

    return true;
  }

  // Factory Manager (FM) scoping
  if (user.role === "fm") {
    // Must be scoped to factory the FM belongs to
    let userFactoryId = resource.factoryId;
    if (!userFactoryId && resource.lineId) {
      const [line] = await db
        .select({ factoryId: lines.factoryId })
        .from(lines)
        .where(eq(lines.id, resource.lineId))
        .limit(1);
      if (line) userFactoryId = line.factoryId;
    }

    if (userFactoryId) {
      const [assoc] = await db
        .select()
        .from(factoryUsers)
        .where(
          and(
            eq(factoryUsers.factoryId, userFactoryId),
            eq(factoryUsers.userId, user.id)
          )
        )
        .limit(1);

      if (!assoc) return false;
    }

    return true;
  }

  // Quality Assurance (QA) scoping
  if (user.role === "qa") {
    if (resource.type === "qa_inspection") {
      if (!resource.productId) return false;
      // Verify product assignment
      const [assignment] = await db
        .select()
        .from(qaAssignments)
        .where(
          and(
            eq(qaAssignments.qaUserId, user.id),
            eq(qaAssignments.productId, resource.productId)
          )
        )
        .limit(1);

      return !!assignment;
    }

    return true;
  }

  return false;
}

/**
 * Safe Page Guard for Next.js Server Components.
 * Redirects unauthenticated visitors to /login instead of throwing a 500 error.
 * Redirects mustChangePassword users to /change-password.
 * Redirects unauthorized roles to /dashboard.
 */
export async function requireAuthPage(allowedRoles?: Role[]): Promise<SessionUser> {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

