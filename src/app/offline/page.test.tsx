import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import OfflinePage from "./page";

describe("OfflinePage - Interactive & Accessibility Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders offline heading, amharic subtitle, and data protection notice", () => {
    render(<OfflinePage />);

    expect(screen.getByText("You're Currently Offline")).toBeDefined();
    expect(screen.getByText(/PWA Offline Mode \/ ከመስመር ውጭ/i)).toBeDefined();
    expect(screen.getByText("Data Protection Guaranteed")).toBeDefined();
  });

  it("handles clicking 'Try Reconnecting' button and triggers window.location.reload", () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    render(<OfflinePage />);

    const reconnectBtn = screen.getByRole("button", { name: /try reconnecting/i });
    expect(reconnectBtn).toBeDefined();

    fireEvent.click(reconnectBtn);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders link to Dashboard", () => {
    render(<OfflinePage />);

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.getAttribute("href")).toBe("/dashboard");
  });
});
