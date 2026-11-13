import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSysAdminDevToken,
  verifySysAdminDevToken,
  SYSADMIN_DEV_TOKEN_COOKIE,
} from "./dev-token";
import { db } from "@/db";

let mockUserInDb: any = null;

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(mockUserInDb ? [mockUserInDb] : [])),
        })),
      })),
    })),
  },
}));

describe("dev-token - SysAdmin DevMode Token Cryptographic Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long-1234567890";
    mockUserInDb = null;
  });

  it("creates a signed token containing user ID, email, timestamp, and HMAC signature", () => {
    const token = createSysAdminDevToken({ id: "admin_123", email: "admin@dpm.local" });
    expect(token).toBeDefined();
    expect(token).toContain("admin_123:admin@dpm.local:");

    const lastDot = token.lastIndexOf(".");
    expect(lastDot).toBeGreaterThan(0);
    const signature = token.slice(lastDot + 1);
    expect(signature.length).toBeGreaterThan(10);
  });

  it("successfully verifies valid token when user is an active sys_admin in database", async () => {
    mockUserInDb = {
      id: "admin_123",
      name: "Super Admin",
      email: "admin@dpm.local",
      role: "sys_admin",
      active: true,
    };

    const token = createSysAdminDevToken({ id: "admin_123", email: "admin@dpm.local" });
    const verified = await verifySysAdminDevToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.id).toBe("admin_123");
    expect(verified?.role).toBe("sys_admin");
  });

  it("rejects token if signature is tampered with", async () => {
    mockUserInDb = {
      id: "admin_123",
      name: "Super Admin",
      email: "admin@dpm.local",
      role: "sys_admin",
      active: true,
    };

    const token = createSysAdminDevToken({ id: "admin_123", email: "admin@dpm.local" });
    const tampered = token.slice(0, -4) + "XXXX";

    const verified = await verifySysAdminDevToken(tampered);
    expect(verified).toBeNull();
  });

  it("rejects token if user is no longer sys_admin or is inactive in database", async () => {
    mockUserInDb = {
      id: "admin_123",
      name: "Demoted Admin",
      email: "admin@dpm.local",
      role: "fm", // Demoted to Factory Manager
      active: true,
    };

    const token = createSysAdminDevToken({ id: "admin_123", email: "admin@dpm.local" });
    const verified = await verifySysAdminDevToken(token);
    expect(verified).toBeNull();
  });

  it("returns null on malformed or empty token", async () => {
    expect(await verifySysAdminDevToken("")).toBeNull();
    expect(await verifySysAdminDevToken("invalid-token-no-dots")).toBeNull();
  });
});
