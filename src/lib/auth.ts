import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ac, roles } from "@/lib/rbac";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  trustedOrigins: (request) => {
    const isDev = process.env.NODE_ENV !== "production";
    const allowed = new Set<string>();

    // Standard local dev origins (allowed in non-production)
    if (isDev) {
      allowed.add("http://localhost:3000");
      allowed.add("http://127.0.0.1:3000");
    }

    // Configured production origins
    const addIfValid = (urlStr?: string) => {
      if (!urlStr) return;
      try {
        const u = new URL(urlStr);
        allowed.add(u.origin);
      } catch {
        // ignore malformed URL
      }
    };

    addIfValid(process.env.BETTER_AUTH_URL);
    addIfValid(process.env.NEXT_PUBLIC_APP_URL);

    if (process.env.TRUSTED_ORIGINS) {
      process.env.TRUSTED_ORIGINS.split(",")
        .map((s) => s.trim())
        .forEach(addIfValid);
    }

    // In local development only, allow private RFC1918 LAN addresses for PWA testing
    const originHeader =
      request?.headers?.get("origin") || request?.headers?.get("referer");
    if (originHeader && isDev) {
      try {
        const u = new URL(originHeader);
        const hostname = u.hostname;
        const isLocalOrLan =
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
          /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);
        if (isLocalOrLan) {
          allowed.add(u.origin);
        }
      } catch {
        // ignore invalid URL
      }
    }

    return Array.from(allowed);
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "qa",
      adminRoles: ["sys_admin"],
    }),
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "qa",
      },
      createdBy: {
        type: "string",
        required: false,
      },
      active: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    cookiePrefix: "dpm",
    useSecureCookies:
      process.env.COOKIE_SECURE === "true"
        ? true
        : process.env.COOKIE_SECURE === "false"
        ? false
        : (process.env.BETTER_AUTH_URL || "").startsWith("https://"),
  },
});
