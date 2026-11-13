import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LoginClient } from "./login-client";
import { authClient } from "@/lib/auth-client";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
  },
}));

describe("Button Interaction Tests - LoginClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authenticated: false }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render quick demo credentials buttons on the login card", () => {
    render(<LoginClient />);
    expect(screen.queryByText(/quick demo credentials/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /sys admin/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /operation mgr/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /factory mgr/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /qa inspector/i })).toBeNull();
  });

  it("submits login form when 'Sign In' button is clicked", async () => {
    (authClient.signIn.email as any).mockResolvedValue({ data: { user: { id: "1" } } });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authenticated: true, user: { mustChangePassword: false } }),
    });

    render(<LoginClient />);

    const emailInput = screen.getByPlaceholderText(/name@company\.com/i);
    const passInput = screen.getByPlaceholderText(/••••••••••••/i);
    fireEvent.change(emailInput, { target: { value: "admin@factory.et" } });
    fireEvent.change(passInput, { target: { value: "AdminSecret123!" } });

    // Click Sign In
    const signInBtn = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(signInBtn);

    await waitFor(() => {
      expect(authClient.signIn.email).toHaveBeenCalledWith({
        email: "admin@factory.et",
        password: "AdminSecret123!",
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("routes directly to /dashboard without redirecting to /change-password even if user record has mustChangePassword = true", async () => {
    (authClient.signIn.email as any).mockResolvedValue({ data: { user: { id: "1" } } });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authenticated: true, user: { mustChangePassword: true } }),
    });

    render(<LoginClient />);

    const emailInput = screen.getByPlaceholderText(/name@company\.com/i);
    const passInput = screen.getByPlaceholderText(/••••••••••••/i);
    fireEvent.change(emailInput, { target: { value: "om@factory.et" } });
    fireEvent.change(passInput, { target: { value: "OmPassword123!" } });

    const signInBtn = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(signInBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
      expect(mockPush).not.toHaveBeenCalledWith("/change-password");
    });
  });

  it("locks out user and disables 'Sign In' button after 5 consecutive failed attempts", async () => {
    (authClient.signIn.email as any).mockResolvedValue({ error: { message: "Invalid credentials" } });

    render(<LoginClient />);

    const emailInput = screen.getByPlaceholderText(/name@company\.com/i);
    const passInput = screen.getByPlaceholderText(/••••••••••••/i);
    const signInBtn = screen.getByRole("button", { name: /sign in/i }) as HTMLButtonElement;

    fireEvent.change(emailInput, { target: { value: "test@factory.et" } });
    fireEvent.change(passInput, { target: { value: "WrongPass123!" } });

    // Submit 5 times
    for (let i = 0; i < 5; i++) {
      fireEvent.click(signInBtn);
      await waitFor(() => {
        expect(authClient.signIn.email).toHaveBeenCalledTimes(i + 1);
      });
    }

    // After 5 attempts, lockout warning is displayed and button is disabled
    expect(await screen.findByText(/too many failed attempts/i)).toBeDefined();
    expect(signInBtn.disabled).toBe(true);
  });

  it("renders server endpoint pill and opens backend server settings modal when 'Change Server' is clicked", () => {
    render(<LoginClient />);

    const changeServerBtn = screen.getByRole("button", { name: /change server/i });
    expect(changeServerBtn).toBeDefined();

    fireEvent.click(changeServerBtn);
    expect(screen.getByRole("dialog", { name: /backend server & network settings/i })).toBeDefined();
  });
});
