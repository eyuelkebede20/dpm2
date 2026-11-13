import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Navbar } from "./navbar";
import { ImpersonationBanner } from "./impersonation-banner";
import { authClient } from "@/lib/auth-client";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockPrefetch = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    prefetch: mockPrefetch,
  }),
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, className, prefetch: _prefetch, ...rest }: any) => (
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
      expect(screen.getAllByText("Admin Portal").length).toBeGreaterThan(0);
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

    it("renders Daily Reports, Operations Hub, and Calendar for Operations Manager (om)", () => {
      const omUser = {
        ...sampleUser,
        id: "usr_om_1",
        name: "Solomon OM",
        role: "om" as const,
      };
      render(<Navbar user={omUser} />);
      expect(screen.getAllByText("Daily Reports").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Operations Hub").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Calendar").length).toBeGreaterThan(0);
      expect(screen.queryByText("Admin Portal")).toBeNull();
    });
  });

  describe("Mobile Bottom Navigation Bar", () => {
    it("renders mobile bottom navigation bar with accessible role and labels", () => {
      render(<Navbar user={sampleUser} />);
      const mobileNav = screen.getByRole("navigation", { name: /mobile navigation/i });
      expect(mobileNav).toBeDefined();

      // Check sys_admin bottom destinations
      const adminLinks = screen.getAllByRole("link", { name: /admin portal/i });
      expect(adminLinks.length).toBeGreaterThan(0);

      // Check "More" button
      const moreBtn = screen.getByRole("button", { name: /more navigation options/i });
      expect(moreBtn).toBeDefined();
      expect(moreBtn.getAttribute("aria-expanded")).toBe("false");
    });

    it("renders FM specific destinations (Dashboard, Lines, Entry, Calendar, More)", () => {
      const fmUser = {
        ...sampleUser,
        id: "usr_fm_1",
        name: "Abebe FM",
        role: "fm" as const,
      };
      render(<Navbar user={fmUser} />);
      const mobileNav = screen.getByRole("navigation", { name: /mobile navigation/i });

      // Inside mobile nav:
      expect(mobileNav.textContent).toContain("Dashboard");
      expect(mobileNav.textContent).toContain("Lines");
      expect(mobileNav.textContent).toContain("Entry");
      expect(mobileNav.textContent).toContain("Calendar");
      expect(mobileNav.textContent).toContain("More");
    });

    it("renders OM specific destinations (Dashboard, Plants, Review, Calendar, More)", () => {
      const omUser = {
        ...sampleUser,
        id: "usr_om_1",
        name: "Solomon OM",
        role: "om" as const,
      };
      render(<Navbar user={omUser} />);
      const mobileNav = screen.getByRole("navigation", { name: /mobile navigation/i });

      expect(mobileNav.textContent).toContain("Dashboard");
      expect(mobileNav.textContent).toContain("Plants");
      expect(mobileNav.textContent).toContain("Review");
      expect(mobileNav.textContent).toContain("Calendar");
      expect(mobileNav.textContent).toContain("More");
    });

    it("renders QA specific destinations (Dashboard, Inspections, More)", () => {
      const qaUser = {
        ...sampleUser,
        id: "usr_qa_1",
        name: "Tigist QA",
        role: "qa" as const,
      };
      render(<Navbar user={qaUser} />);
      const mobileNav = screen.getByRole("navigation", { name: /mobile navigation/i });

      expect(mobileNav.textContent).toContain("Dashboard");
      expect(mobileNav.textContent).toContain("Inspections");
      expect(mobileNav.textContent).toContain("More");
    });

    it("toggles mobile drawer open and closed using bottom bar 'More' button", () => {
      render(<Navbar user={sampleUser} />);
      const moreBtn = screen.getByRole("button", { name: /more navigation options/i });
      expect(moreBtn.getAttribute("aria-expanded")).toBe("false");

      // Click More to open drawer
      fireEvent.click(moreBtn);
      expect(moreBtn.getAttribute("aria-expanded")).toBe("true");

      const drawer = screen.getByRole("dialog", { name: /mobile navigation menu/i });
      expect(drawer).toBeDefined();

      // Drawer shows Navigation links & Account options
      expect(screen.getByText("Navigation")).toBeDefined();
      expect(screen.getByText("Change Password")).toBeDefined();

      // Click More button again to toggle closed
      fireEvent.click(moreBtn);
      expect(moreBtn.getAttribute("aria-expanded")).toBe("false");
    });

    it("marks the active tab with aria-current='page'", () => {
      render(<Navbar user={sampleUser} />);
      const mobileNav = screen.getByRole("navigation", { name: /mobile navigation/i });

      // In mock, pathname is "/dashboard"
      const dashboardLinks = screen.getAllByRole("link", { name: /dashboard/i });
      const activeMobileLink = dashboardLinks.find((l) =>
        mobileNav.contains(l) && l.getAttribute("aria-current") === "page"
      );
      expect(activeMobileLink).toBeDefined();
    });

    it("opens backend server settings modal when 'Server Settings' is clicked from profile dropdown", () => {
      render(<Navbar user={sampleUser} />);
      const profileBtn = screen.getByRole("button", { name: /user profile menu/i });
      fireEvent.click(profileBtn);

      const serverSettingsBtn = screen.getByRole("button", { name: /server settings/i });
      expect(serverSettingsBtn).toBeDefined();

      fireEvent.click(serverSettingsBtn);
      expect(screen.getByRole("dialog", { name: /backend server & network settings/i })).toBeDefined();
    });

    it("opens backend server settings modal when clicked from mobile drawer", () => {
      render(<Navbar user={sampleUser} />);
      const hamburgerBtn = screen.getByRole("button", { name: /toggle navigation menu/i });
      fireEvent.click(hamburgerBtn);

      const mobileServerBtn = screen.getByRole("button", { name: /server settings \(lan \/ cloud\)/i });
      expect(mobileServerBtn).toBeDefined();

      fireEvent.click(mobileServerBtn);
      expect(screen.getByRole("dialog", { name: /backend server & network settings/i })).toBeDefined();
    });

    it("renders 'Download App (PWA)' button in profile dropdown and opens settings guide when not directly installable", () => {
      render(<Navbar user={sampleUser} />);
      const profileBtn = screen.getByRole("button", { name: /user profile menu/i });
      fireEvent.click(profileBtn);

      const downloadPwaBtn = screen.getByTestId("navbar-download-pwa-button");
      expect(downloadPwaBtn).toBeDefined();

      fireEvent.click(downloadPwaBtn);
      expect(screen.getByRole("dialog", { name: /backend server & network settings/i })).toBeDefined();
    });

    it("renders 'Download App (PWA)' button in mobile drawer and opens settings guide", () => {
      render(<Navbar user={sampleUser} />);
      const hamburgerBtn = screen.getByRole("button", { name: /toggle navigation menu/i });
      fireEvent.click(hamburgerBtn);

      const mobilePwaBtn = screen.getByTestId("mobile-download-pwa-button");
      expect(mobilePwaBtn).toBeDefined();

      fireEvent.click(mobilePwaBtn);
      expect(screen.getByRole("dialog", { name: /backend server & network settings/i })).toBeDefined();
    });

    it("renders adaptive short labels and full labels for Factory Manager (fm) to prevent tablet overflow", () => {
      const fmUser = {
        ...sampleUser,
        id: "usr_fm_1",
        name: "Abebe FM",
        role: "fm" as const,
      };
      render(<Navbar user={fmUser} />);

      // Verify adaptive short and full labels are rendered
      expect(screen.getAllByText("Lines").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Lines & Floor").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Plans").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Production Plans").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Store").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Store Stock").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Entry").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Daily Entry").length).toBeGreaterThan(0);
    });

    it("renders adaptive short labels for Operation Manager (om) and QA (qa)", () => {
      const omUser = {
        ...sampleUser,
        id: "usr_om_1",
        name: "Solomon OM",
        role: "om" as const,
      };
      const { unmount } = render(<Navbar user={omUser} />);
      expect(screen.getAllByText("Plants").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Operations Hub").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Reports").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Daily Reports").length).toBeGreaterThan(0);
      unmount();

      const qaUser = {
        ...sampleUser,
        id: "usr_qa_1",
        name: "Tigist QA",
        role: "qa" as const,
      };
      render(<Navbar user={qaUser} />);
      expect(screen.getAllByText("Approvals").length).toBeGreaterThan(0);
      expect(screen.getAllByText("QA Approvals").length).toBeGreaterThan(0);
    });

    it("verifies mobile navigation bar has h-16 height and min-h-[48px] touch targets", () => {
      render(<Navbar user={sampleUser} />);
      const mobileNav = screen.getByRole("navigation", { name: /mobile navigation/i });
      const gridContainer = mobileNav.querySelector(".grid");
      expect(gridContainer?.className).toContain("h-16");

      const links = mobileNav.querySelectorAll("a, button");
      links.forEach((link) => {
        expect(link.className).toContain("min-h-[48px]");
      });
    });
  });
});
