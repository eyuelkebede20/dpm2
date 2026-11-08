export type Role = "sys_admin" | "om" | "fm" | "qa";

export interface RoleMetadata {
  id: Role;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  allowedAssigners: Role[];
}

export const ROLES_METADATA: Record<Role, RoleMetadata> = {
  sys_admin: {
    id: "sys_admin",
    label: "System Administrator",
    shortLabel: "Sys Admin",
    description: "Full system administration, tenant configuration, and user management",
    badgeClass: "badge-primary text-white",
    allowedAssigners: ["sys_admin"],
  },
  om: {
    id: "om",
    label: "Operation Manager",
    shortLabel: "OM",
    description: "Multi-factory oversight, factory creation, and personnel management",
    badgeClass: "badge-info text-white",
    allowedAssigners: ["sys_admin"],
  },
  fm: {
    id: "fm",
    label: "Factory Manager",
    shortLabel: "FM",
    description: "Factory production lines, products, plans, and daily reporting",
    badgeClass: "badge-secondary text-white",
    allowedAssigners: ["sys_admin", "om"],
  },
  qa: {
    id: "qa",
    label: "Quality Assurance Inspector",
    shortLabel: "QA",
    description: "Defect inspection, product verification, and quality reporting",
    badgeClass: "badge-accent text-white",
    allowedAssigners: ["sys_admin", "om"],
  },
};

export const ALL_ROLES: Role[] = ["sys_admin", "om", "fm", "qa"];
export const OM_ASSIGNABLE_ROLES: Role[] = ["fm", "qa"];
