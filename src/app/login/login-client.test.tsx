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

  it("autofills inputs when demo credential buttons are clicked", () => {
    render(<LoginClient />);

    const emailInput = screen.getByPlaceholderText(/name@company\.com/i) as HTMLInputElement;
    const passInput = screen.getByPlaceholderText(/••••••••••••/i) as HTMLInputElement;

    // Click Sys Admin pill
    const adminBtn = screen.getByRole("button", { name: /sys admin/i });
    fireEvent.click(adminBtn);
    expect(emailInput.value).toBe("admin@factory.et");
    expect(passInput.value).toBe("AdminSecret123!");

    // Click Operation Mgr pill
    const omBtn = screen.getByRole("button", { name: /operation mgr/i });
    fireEvent.click(omBtn);
    expect(emailInput.value).toBe("om@factory.et");
    expect(passInput.value).toBe("OmPassword123!");

    // Click Factory Mgr pill
    const fmBtn = screen.getByRole("button", { name: /factory mgr/i });
    fireEvent.click(fmBtn);
    expect(emailInput.value).toBe("fm@factory.et");
    expect(passInput.value).toBe("FmPassword123!");

    // Click QA Inspector pill
    const qaBtn = screen.getByRole("button", { name: /qa inspector/i });
    fireEvent.click(qaBtn);
    expect(emailInput.value).toBe("qa@factory.et");
    expect(passInput.value).toBe("QaPassword123!");
  });

  it("submits login form when 'Sign In' button is clicked", async () => {
    (authClient.signIn.email as any).mockResolvedValue({ data: { user: { id: "1" } } });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authenticated: true, user: { mustChangePassword: false } }),
    });

    render(<LoginClient />);

    // Autofill credentials
    const adminBtn = screen.getByRole("button", { name: /sys admin/i });
    fireEvent.click(adminBtn);

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

    const omBtn = screen.getByRole("button", { name: /operation mgr/i });
    fireEvent.click(omBtn);

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
