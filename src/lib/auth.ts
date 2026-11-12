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
    const origin =
      request?.headers?.get("origin") || request?.headers?.get("referer");
    const host = request?.headers?.get("host");
    const origins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];
    if (origin) {
      try {
        const u = new URL(origin);
        origins.push(u.origin);
      } catch {
        // ignore invalid URL
      }
    }
    if (host) {
      origins.push(`http://${host}`);
      origins.push(`https://${host}`);
    }
    if (process.env.BETTER_AUTH_URL) origins.push(process.env.BETTER_AUTH_URL);
    if (process.env.NEXT_PUBLIC_APP_URL) origins.push(process.env.NEXT_PUBLIC_APP_URL);
    if (process.env.TRUSTED_ORIGINS) {
      origins.push(
        ...process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim())
      );
    }
    return Array.from(new Set(origins));
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
