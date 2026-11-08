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

describe("Button Interaction Tests - AdminClient", () => {
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
        impersonationCandidates={sampleCandidates}
        isDevImpersonationEnabled={true}
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

  it("handles impersonation button click and disabled state", async () => {
    renderAdmin();

    const impersonateBtn = screen.getByRole("button", { name: /impersonate/i }) as HTMLButtonElement;
    // Disabled initially because no candidate selected in dropdown
    expect(impersonateBtn.disabled).toBe(true);

    // Select candidate
    const select = screen.getAllByRole("combobox")[0];
    fireEvent.change(select, { target: { value: "usr_om_1" } });

    expect(impersonateBtn.disabled).toBe(false);

    fireEvent.click(impersonateBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/admin/impersonate",
        expect.objectContaining({ method: "POST" })
      );
    });
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
});
