import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ChangePasswordClient } from "./change-password-client";
import * as authActions from "@/actions/auth-actions";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/actions/auth-actions", () => ({
  changePasswordAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Button Interaction Tests - ChangePasswordClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("disables 'Update Password & Continue' button until password is at least 12 characters", () => {
    render(<ChangePasswordClient />);

    const submitBtn = screen.getByRole("button", { name: /update password & continue/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const newPassInput = screen.getByPlaceholderText(/at least 12 characters/i);
    const confirmInput = screen.getByPlaceholderText(/repeat new password/i);

    // Type 8 characters (short)
    fireEvent.change(newPassInput, { target: { value: "Short123!" } });
    fireEvent.change(confirmInput, { target: { value: "Short123!" } });
    expect(submitBtn.disabled).toBe(true);

    // Type 12 characters
    fireEvent.change(newPassInput, { target: { value: "LongSecurePassword123!" } });
    fireEvent.change(confirmInput, { target: { value: "LongSecurePassword123!" } });
    expect(submitBtn.disabled).toBe(false);
  });

  it("displays password match error if passwords do not match when submitting", async () => {
    render(<ChangePasswordClient />);

    const newPassInput = screen.getByPlaceholderText(/at least 12 characters/i);
    const confirmInput = screen.getByPlaceholderText(/repeat new password/i);
    const submitBtn = screen.getByRole("button", { name: /update password & continue/i });

    fireEvent.change(newPassInput, { target: { value: "LongSecurePassword123!" } });
    fireEvent.change(confirmInput, { target: { value: "DifferentPassword456!" } });

    fireEvent.click(submitBtn);

    expect(await screen.findByText(/passwords do not match/i)).toBeDefined();
    expect(authActions.changePasswordAction).not.toHaveBeenCalled();
  });

  it("submits change password form successfully when valid credentials entered", async () => {
    render(<ChangePasswordClient />);

    const newPassInput = screen.getByPlaceholderText(/at least 12 characters/i);
    const confirmInput = screen.getByPlaceholderText(/repeat new password/i);
    const submitBtn = screen.getByRole("button", { name: /update password & continue/i });

    fireEvent.change(newPassInput, { target: { value: "ValidNewPassword123!" } });
    fireEvent.change(confirmInput, { target: { value: "ValidNewPassword123!" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authActions.changePasswordAction).toHaveBeenCalledWith({
        newPassword: "ValidNewPassword123!",
        confirmPassword: "ValidNewPassword123!",
      });
    });

    expect(await screen.findByText(/password updated successfully/i)).toBeDefined();
  });
});
