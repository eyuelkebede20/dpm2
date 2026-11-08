import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { RoleSwitcher } from "./role-switcher";
import { authClient } from "@/lib/auth-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: vi.fn().mockResolvedValue({ success: true }),
    signIn: {
      email: vi.fn().mockResolvedValue({ data: { user: { id: "1" } } }),
    },
  },
}));

describe("Button Interaction Tests - RoleSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("opens and closes the role switcher drawer via the floating action button and Close button", () => {
    render(<RoleSwitcher currentRole="sys_admin" />);

    // Drawer is closed initially
    expect(screen.queryByText("Dev Quick Role Switcher")).toBeNull();

    // Click floating pill button to open
    const toggleBtn = screen.getByTitle("Switch Active User Role");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Dev Quick Role Switcher")).toBeDefined();

    // Click Close button inside drawer
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    expect(screen.queryByText("Dev Quick Role Switcher")).toBeNull();
  });

  it("handles clicking a role button to switch active user role", async () => {
    delete (window as any).location;
    (window as any).location = { href: "" };

    render(<RoleSwitcher currentRole="sys_admin" />);

    // Open drawer
    const toggleBtn = screen.getByTitle("Switch Active User Role");
    fireEvent.click(toggleBtn);

    // Click Operation Mgr role button
    const omRoleBtn = screen.getByRole("button", { name: /operation mgr/i });
    fireEvent.click(omRoleBtn);

    await waitFor(() => {
      expect(authClient.signOut).toHaveBeenCalled();
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: "om@dpm.local",
        password: "AdminPassword123!",
      });
      expect(window.location.href).toContain("/dashboard");
    });
  });
});
