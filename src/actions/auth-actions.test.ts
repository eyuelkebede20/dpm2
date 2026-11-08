import { describe, it, expect, vi, beforeEach } from "vitest";
import { changePasswordAction } from "./auth-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/db", () => {
  const mockTx = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };

  return {
    db: {
      transaction: vi.fn(async (callback: any) => {
        return await callback(mockTx);
      }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    },
  };
});

describe("Auth Workflows - changePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authz.requireUser).mockResolvedValue({
      id: "usr_123",
      name: "Test User",
      email: "user@dpm.local",
      role: "fm",
      active: true,
      mustChangePassword: true,
    });
  });

  it("fails if new password is too short (< 12 characters)", async () => {
    const res = await changePasswordAction({
      newPassword: "short",
      confirmPassword: "short",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("at least 12 characters");
  });

  it("fails if passwords do not match", async () => {
    const res = await changePasswordAction({
      newPassword: "ValidPassword123!",
      confirmPassword: "DifferentPassword123!",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Passwords do not match");
  });

  it("fails if password exceeds 128 characters", async () => {
    const tooLong = "A".repeat(129);
    const res = await changePasswordAction({
      newPassword: tooLong,
      confirmPassword: tooLong,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("too long");
  });

  it("successfully updates password and clears mustChangePassword", async () => {
    const res = await changePasswordAction({
      newPassword: "NewSecurePassword123!",
      confirmPassword: "NewSecurePassword123!",
    });

    expect(res.success).toBe(true);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("handles database transaction failure gracefully", async () => {
    vi.mocked(db.transaction).mockRejectedValueOnce(new Error("DB connection error"));

    const res = await changePasswordAction({
      newPassword: "NewSecurePassword123!",
      confirmPassword: "NewSecurePassword123!",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Failed to update password. Please try again.");
  });
});
