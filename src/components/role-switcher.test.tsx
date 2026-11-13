import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { RoleSwitcher } from "./role-switcher";
import { setDeveloperModeActive, DEVELOPER_MODE_STORAGE_KEY } from "@/lib/developer-mode";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/admin",
}));

describe("RoleSwitcher - Strict Access Control & Interactive Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.cookie = "";

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
    window.localStorage.clear();
  });

  describe("Visibility & Access Control Rules", () => {
    it("renders NOTHING when user is not logged in (currentRole is null/undefined)", () => {
      setDeveloperModeActive(true);
      const { container } = render(<RoleSwitcher currentRole={null} />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTitle("Switch Active Developer Role")).toBeNull();
    });

    it("renders NOTHING when user is logged in as non-sys_admin without canSwitchRole even if dev mode was enabled in storage", () => {
      setDeveloperModeActive(true);

      const roles = ["om", "fm", "qa", "guest"] as const;
      for (const role of roles) {
        cleanup();
        const { container } = render(<RoleSwitcher currentRole={role} canSwitchRole={false} />);
        expect(container.firstChild).toBeNull();
        expect(screen.queryByTitle("Switch Active Developer Role")).toBeNull();
      }
    });

    it("renders floating action button when user has non-admin currentRole but canSwitchRole is true (sysadmin dev token active)", () => {
      setDeveloperModeActive(true);
      render(<RoleSwitcher currentRole="om" canSwitchRole={true} />);

      const toggleBtn = screen.getByTitle("Switch Active Developer Role");
      expect(toggleBtn).toBeDefined();
    });

    it("renders NOTHING for sys_admin when developer option is OFF / default", () => {
      // By default, developer option is not turned on
      window.localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, "false");
      const { container } = render(<RoleSwitcher currentRole="sys_admin" />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTitle("Switch Active Developer Role")).toBeNull();
    });

    it("renders floating action button ONLY when user is sys_admin AND developer option is ON", () => {
      setDeveloperModeActive(true);
      render(<RoleSwitcher currentRole="sys_admin" />);

      const toggleBtn = screen.getByTitle("Switch Active Developer Role");
      expect(toggleBtn).toBeDefined();
    });
  });

  describe("Interactive Behavior & Role Switching", () => {
    beforeEach(() => {
      setDeveloperModeActive(true);
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

    it("allows sys_admin to disable developer mode via 'Hide Switcher' button", () => {
      const { container } = render(<RoleSwitcher currentRole="sys_admin" />);

      // Open drawer
      const toggleBtn = screen.getByTitle("Switch Active Developer Role");
      fireEvent.click(toggleBtn);

      // Click Hide Switcher button
      const hideBtn = screen.getByRole("button", { name: /hide switcher/i });
      fireEvent.click(hideBtn);

      // Component should now unmount completely
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTitle("Switch Active Developer Role")).toBeNull();
    });
  });
});
