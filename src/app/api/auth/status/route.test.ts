import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import * as authz from "@/lib/authz";

vi.mock("@/lib/authz", () => ({
  getSessionContext: vi.fn(),
}));

describe("Auth Status API Route - GET /api/auth/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 with { authenticated: false } when no session exists", async () => {
    vi.mocked(authz.getSessionContext).mockResolvedValue({
      user: null,
      rawAdminUser: null,
      isImpersonating: false,
      canSwitchRole: false,
    });

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.authenticated).toBe(false);
    expect(data.user).toBeUndefined();
  });

  it("returns 200 with sanitized user session information when authenticated", async () => {
    vi.mocked(authz.getSessionContext).mockResolvedValue({
      user: {
        id: "usr_om_01",
        name: "Solomon Tadesse",
        email: "solomon@dpm.local",
        role: "om",
        active: true,
        mustChangePassword: false,
      },
      rawAdminUser: null,
      isImpersonating: false,
      canSwitchRole: false,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(true);
    expect(data.user).toEqual({
      id: "usr_om_01",
      name: "Solomon Tadesse",
      email: "solomon@dpm.local",
      role: "om",
      mustChangePassword: false,
    });
    // Ensure no secret fields or internal tokens leaked
    expect((data.user as any).password).toBeUndefined();
    expect((data.user as any).token).toBeUndefined();
  });
});
