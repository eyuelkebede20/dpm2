import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { RoleSwitcher } from "./role-switcher";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/admin",
}));

describe("Button Interaction Tests - RoleSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, redirectTo: "/om" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            enabled: true,
            currentUser: { role: "sys_admin", email: "admin@dpm.local" },
            users: [
              {
                id: "om-1",
                name: "Solomon Tadesse",
                email: "om@dpm.local",
                role: "om",
                isActive: true,
              },
            ],
          }),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("opens and closes the role switcher drawer via the floating action button and Close button", () => {
    render(<RoleSwitcher currentRole="sys_admin" />);

    // Drawer is closed initially
    expect(screen.queryByText("Developer Role Switcher")).toBeNull();

    // Click floating pill button to open
    const toggleBtn = screen.getByTitle("Switch Active Developer Role");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Developer Role Switcher")).toBeDefined();

    // Click Close button inside drawer
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    expect(screen.queryByText("Developer Role Switcher")).toBeNull();
  });

  it("handles clicking a role button to switch active user role via /api/dev/switch-role", async () => {
    delete (window as any).location;
    (window as any).location = { href: "" };

    render(<RoleSwitcher currentRole="sys_admin" />);

    // Open drawer
    const toggleBtn = screen.getByTitle("Switch Active Developer Role");
    fireEvent.click(toggleBtn);

    // Click Operation Mgr role button
    const omRoleBtn = screen.getByRole("button", { name: /operation mgr/i });
    fireEvent.click(omRoleBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/dev/switch-role",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ role: "om", targetRoute: "/om" }),
        })
      );
      expect(window.location.href).toContain("/om");
    });
  });
});
