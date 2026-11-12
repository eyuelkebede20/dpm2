import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AdminClient } from "./admin-client";
import * as adminActions from "@/actions/admin-actions";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/actions/admin-actions", () => ({
  updateIndustryProfileAction: vi.fn().mockResolvedValue({ success: true }),
  createUserAction: vi.fn().mockResolvedValue({ success: true }),
  createOperationManagerAction: vi.fn().mockResolvedValue({ success: true }),
  toggleUserActiveAction: vi.fn().mockResolvedValue({ success: true }),
  updateUserRoleAction: vi.fn().mockResolvedValue({ success: true }),
  adminResetPasswordAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/actions/server-endpoint-actions", () => ({
  createServerEndpointAction: vi.fn().mockResolvedValue({
    success: true,
    endpoint: {
      id: "srv_test",
      name: "New Workshop LAN",
      url: "http://192.168.1.180:3000",
      description: "Test description",
      environment: "lan",
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }),
  updateServerEndpointAction: vi.fn().mockResolvedValue({ success: true }),
  deleteServerEndpointAction: vi.fn().mockResolvedValue({ success: true }),
  toggleServerEndpointActiveAction: vi.fn().mockResolvedValue({ success: true }),
  FALLBACK_SERVER_ENDPOINTS: [
    {
      id: "srv_fallback",
      name: "Fallback Factory LAN",
      url: "http://192.168.1.100:3000",
      description: "Fallback desc",
      environment: "lan",
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
}));

vi.mock("@/lib/backend-config", () => ({
  testServerConnection: vi.fn().mockResolvedValue({
    ok: true,
    latencyMs: 12,
    status: 200,
    version: "1.0.1",
  }),
  validateServerUrl: vi.fn((url: string) => ({ valid: true, normalizedUrl: url })),
}));

describe("Button Interaction Tests - AdminClient", { timeout: 20000 }, () => {
  const sampleProfile = {
    id: "default",
    companyName: "Acme Industrial",
    workingDays: [1, 2, 3, 4, 5, 6],
    units: "pcs",
  };

  const sampleOMs = [
    {
      id: "usr_om_1",
      name: "Solomon OM",
      email: "solomon@dpm.local",
      role: "om",
      active: true,
      mustChangePassword: false,
      createdAt: new Date(),
    },
  ];

  const sampleCandidates = [
    {
      id: "usr_om_1",
      name: "Solomon OM",
      email: "solomon@dpm.local",
      role: "om" as const,
    },
  ];

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

  const renderAdmin = () => {
    return render(
      <AdminClient
        initialProfile={sampleProfile}
        initialOms={sampleOMs}
      />
    );
  };

  it("opens and closes 'Provision New User' modal via buttons", () => {
    renderAdmin();

    const openBtn = screen.getByRole("button", { name: /provision new user/i });
    expect(openBtn).toBeDefined();

    // Click to open modal
    fireEvent.click(openBtn);
    expect(screen.getByRole("heading", { name: /provision new user/i })).toBeDefined();

    // Click cancel button in modal
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("heading", { name: /provision new user/i })).toBeNull();
  });

  it("submits user provisioning modal when 'Provision User' button is clicked", async () => {
    renderAdmin();

    const openBtn = screen.getByRole("button", { name: /provision new user/i });
    fireEvent.click(openBtn);

    // Fill form
    const nameInput = screen.getByPlaceholderText(/e\.g\. Solomon Tadesse/i);
    const emailInput = screen.getByPlaceholderText(/user@company\.com/i);

    fireEvent.change(nameInput, { target: { value: "New Manager" } });
    fireEvent.change(emailInput, { target: { value: "newom@dpm.local" } });

    // Submit button
    const submitBtn = screen.getByRole("button", { name: /provision user/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminActions.createUserAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Manager",
          email: "newom@dpm.local",
        })
      );
    });
  });

  it("triggers user status toggle when Deactivate/Activate button is clicked", async () => {
    renderAdmin();

    const deactivateBtn = screen.getByRole("button", { name: /deactivate/i });
    expect(deactivateBtn).toBeDefined();

    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(adminActions.toggleUserActiveAction).toHaveBeenCalledWith("usr_om_1", false);
    });
  });

  it("submits profile changes when 'Save Profile Settings' button is clicked", async () => {
    renderAdmin();

    // Switch to profile settings tab
    const profileTab = screen.getByRole("button", { name: /industry profile settings/i });
    fireEvent.click(profileTab);

    // Save button
    const saveBtn = screen.getByRole("button", { name: /save profile settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(adminActions.updateIndustryProfileAction).toHaveBeenCalled();
    });
  });

  it("does not render impersonation controls in sys admin as role switcher is enabled", () => {
    renderAdmin();

    expect(screen.queryByText(/dev impersonation toolbar/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /impersonate/i })).toBeNull();
  });

  it("opens and cancels Reset Password modal", () => {
    renderAdmin();

    const resetBtn = screen.getByRole("button", { name: /reset password/i });
    fireEvent.click(resetBtn);

    expect(screen.getByRole("heading", { name: /reset user password/i })).toBeDefined();

    // Click close '✕' button
    const closeBtn = screen.getByRole("button", { name: "✕" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("heading", { name: /reset user password/i })).toBeNull();
  });

  it("switches to Server Endpoints tab and renders server presets table", () => {
    renderAdmin();

    const serverTab = screen.getByRole("button", { name: /server endpoints/i });
    expect(serverTab).toBeDefined();

    fireEvent.click(serverTab);

    expect(screen.getByText(/Backend Server Presets & Endpoints/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Add Server Preset/i })).toBeDefined();
    expect(screen.getByText("Fallback Factory LAN")).toBeDefined();
  });

  it("opens 'Add Server Preset' modal, fills form, and submits new preset", async () => {
    renderAdmin();

    // Switch to servers tab
    const serverTab = screen.getByRole("button", { name: /server endpoints/i });
    fireEvent.click(serverTab);

    // Click Add Server Preset button
    const addBtn = screen.getByRole("button", { name: /Add Server Preset/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole("heading", { name: /Add Server Preset/i })).toBeDefined();

    // Fill form
    const nameInput = screen.getByPlaceholderText(/Workshop 02 Production LAN/i);
    const urlInput = screen.getByPlaceholderText(/http:\/\/192.168.1.150:3000/i);

    fireEvent.change(nameInput, { target: { value: "Workshop 02 LAN" } });
    fireEvent.change(urlInput, { target: { value: "http://192.168.1.180:3000" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: /Create Preset/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Server endpoint created successfully/i)).toBeDefined();
    });
  });

  it("triggers ping test when clicking Ping button on server row", async () => {
    renderAdmin();

    // Switch to servers tab
    const serverTab = screen.getByRole("button", { name: /server endpoints/i });
    fireEvent.click(serverTab);

    const pingBtn = screen.getByRole("button", { name: /Ping/i });
    fireEvent.click(pingBtn);

    await waitFor(() => {
      expect(screen.getByText(/12ms/i)).toBeDefined();
    });
  });

  it("switches to System Updates tab and renders system updater interface", () => {
    renderAdmin();

    const systemTab = screen.getByRole("button", { name: /system updates/i });
    expect(systemTab).toBeDefined();

    fireEvent.click(systemTab);

    expect(screen.getByText("System Update & Self-Healing Deployment")).toBeDefined();
    expect(screen.getByRole("button", { name: /pull latest updates & rebuild/i })).toBeDefined();
  });
});
