import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Navbar } from "./navbar";
import { ImpersonationBanner } from "./impersonation-banner";
import { authClient } from "@/lib/auth-client";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, className, ...rest }: any) => (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("Button Interaction Tests - Navbar & ImpersonationBanner", () => {
  const sampleUser = {
    id: "usr_admin_1",
    name: "System Admin",
    email: "admin@dpm.local",
    role: "sys_admin" as const,
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens profile dropdown, displays user data, and handles 'Sign Out' button click calling authClient.signOut", async () => {
    render(<Navbar user={sampleUser} />);

    // Profile trigger button
    const profileBtn = screen.getByRole("button", { name: /user profile menu/i });
    expect(profileBtn).toBeDefined();
    expect(profileBtn.getAttribute("aria-expanded")).toBe("false");

    // Open profile dropdown
    fireEvent.click(profileBtn);
    expect(profileBtn.getAttribute("aria-expanded")).toBe("true");

    // User data is cleanly visible inside the dropdown
    expect(screen.getAllByText("System Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("admin@dpm.local")).toBeDefined();
    expect(screen.getAllByText("Sys Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("Change Password")).toBeDefined();

    // Click Sign Out from inside profile dropdown
    const signOutBtn = screen.getByRole("button", { name: /sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(authClient.signOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("closes profile dropdown on Escape key", () => {
    render(<Navbar user={sampleUser} />);

    const profileBtn = screen.getByRole("button", { name: /user profile menu/i });
    fireEvent.click(profileBtn);
    expect(profileBtn.getAttribute("aria-expanded")).toBe("true");

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(profileBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles mobile menu drawer open and closed using hamburger and close buttons", () => {
    render(<Navbar user={sampleUser} />);

    const hamburgerBtn = screen.getByRole("button", { name: /toggle navigation menu/i });
    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");

    // Click hamburger to open
    fireEvent.click(hamburgerBtn);
    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("true");

    // Drawer should show navigation header
    expect(screen.getByText("Navigation")).toBeDefined();

    // Click again to close
    fireEvent.click(hamburgerBtn);
    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Navigation")).toBeNull();
  });

  it("handles mobile menu Sign Out button click", async () => {
    render(<Navbar user={sampleUser} />);

    // Open mobile menu
    const hamburgerBtn = screen.getByRole("button", { name: /toggle navigation menu/i });
    fireEvent.click(hamburgerBtn);

    // Get all sign out buttons (desktop + mobile drawer)
    const signOutBtns = screen.getAllByRole("button", { name: /sign out/i });
    const mobileSignOut = signOutBtns[signOutBtns.length - 1];

    fireEvent.click(mobileSignOut);

    await waitFor(() => {
      expect(authClient.signOut).toHaveBeenCalled();
    });
  });

  it("handles 'Exit Impersonation' button click in ImpersonationBanner", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    render(
      <ImpersonationBanner
        impersonatedUser={{
          name: "Solomon Tadesse",
          email: "solomon@dpm.local",
          role: "om",
        }}
      />
    );

    const exitBtn = screen.getByRole("button", { name: /exit impersonation/i });
    expect(exitBtn).toBeDefined();

    fireEvent.click(exitBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/impersonate", {
        method: "DELETE",
      });
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });

  describe("Role-based navigation item visibility", () => {
    it("does not render Daily Entry or Calendar for sys_admin", () => {
      render(<Navbar user={sampleUser} />);
      expect(screen.queryByText("Daily Entry")).toBeNull();
      expect(screen.queryByText("Calendar")).toBeNull();
      expect(screen.getByText("Admin Portal")).toBeDefined();
    });

    it("renders Daily Entry and Calendar for Factory Manager (fm)", () => {
      const fmUser = {
        ...sampleUser,
        id: "usr_fm_1",
        name: "Abebe FM",
        role: "fm" as const,
      };
      render(<Navbar user={fmUser} />);
      expect(screen.getAllByText("Daily Entry").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Calendar").length).toBeGreaterThan(0);
      expect(screen.queryByText("Admin Portal")).toBeNull();
    });

    it("renders Daily Entry and Calendar for Operations Manager (om)", () => {
      const omUser = {
        ...sampleUser,
        id: "usr_om_1",
        name: "Solomon OM",
        role: "om" as const,
      };
      render(<Navbar user={omUser} />);
      expect(screen.getAllByText("Daily Entry").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Calendar").length).toBeGreaterThan(0);
      expect(screen.queryByText("Admin Portal")).toBeNull();
    });
  });
});
