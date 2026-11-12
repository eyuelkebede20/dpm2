import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PwaOtaBanner } from "./pwa-ota-banner";

describe("PwaOtaBanner - Interactive & Accessibility Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when online, no update is available, and not installable", () => {
    const { container } = render(
      <PwaOtaBanner
        isOnline={true}
        isUpdateAvailable={false}
        isUpdating={false}
        currentVersion="1.0.1"
        onApplyUpdate={vi.fn()}
        onDismissUpdate={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders offline banner when isOnline is false with accessible role='status'", () => {
    render(
      <PwaOtaBanner
        isOnline={false}
        isUpdateAvailable={false}
        isUpdating={false}
        currentVersion="1.0.1"
        onApplyUpdate={vi.fn()}
        onDismissUpdate={vi.fn()}
      />
    );

    const statusBanner = screen.getByRole("status");
    expect(statusBanner).toBeDefined();
    expect(screen.getByText(/offline mode • ከመስመር ውጭ/i)).toBeDefined();
    expect(screen.getByText(/local cached production views are active/i)).toBeDefined();
  });

  it("renders Over-The-Air (OTA) update banner when isUpdateAvailable is true with role='alert'", () => {
    render(
      <PwaOtaBanner
        isOnline={true}
        isUpdateAvailable={true}
        isUpdating={false}
        currentVersion="1.0.1"
        newVersion="1.0.2"
        releaseNotes="Munitions production and OTA update engine enabled."
        onApplyUpdate={vi.fn()}
        onDismissUpdate={vi.fn()}
      />
    );

    const alertBanner = screen.getByRole("alert");
    expect(alertBanner).toBeDefined();
    expect(screen.getByText(/OTA Update Ready/i)).toBeDefined();
    expect(screen.getByText(/v1.0.1 → v1.0.2/i)).toBeDefined();
    expect(screen.getByText(/New Platform Version Available/i)).toBeDefined();
    expect(
      screen.getByText(/Munitions production and OTA update engine enabled./i)
    ).toBeDefined();
  });

  it("renders GitHub link when githubUrl is provided", () => {
    render(
      <PwaOtaBanner
        isOnline={true}
        isUpdateAvailable={true}
        isUpdating={false}
        currentVersion="1.0.1"
        newVersion="1.0.2"
        gitCommit="bc4b2e1"
        githubUrl="https://github.com/eyuelkebede20/dpm"
        onApplyUpdate={vi.fn()}
        onDismissUpdate={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: /github: bc4b2e1/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe(
      "https://github.com/eyuelkebede20/dpm/commit/bc4b2e1"
    );
  });

  it("handles clicking 'Update Now' button to apply Over-The-Air update", () => {
    const onApplyUpdate = vi.fn();
    render(
      <PwaOtaBanner
        isOnline={true}
        isUpdateAvailable={true}
        isUpdating={false}
        currentVersion="1.0.1"
        newVersion="1.0.2"
        onApplyUpdate={onApplyUpdate}
        onDismissUpdate={vi.fn()}
      />
    );

    const updateBtn = screen.getByRole("button", { name: /update now/i });
    expect(updateBtn).toBeDefined();
    fireEvent.click(updateBtn);

    expect(onApplyUpdate).toHaveBeenCalledTimes(1);
  });

  it("handles clicking 'Later' button to dismiss update banner", () => {
    const onDismissUpdate = vi.fn();
    render(
      <PwaOtaBanner
        isOnline={true}
        isUpdateAvailable={true}
        isUpdating={false}
        currentVersion="1.0.1"
        newVersion="1.0.2"
        onApplyUpdate={vi.fn()}
        onDismissUpdate={onDismissUpdate}
      />
    );

    const laterBtn = screen.getByRole("button", { name: "Later" });
    fireEvent.click(laterBtn);

    expect(onDismissUpdate).toHaveBeenCalledTimes(1);
  });

  it("handles clicking 'X' close button to dismiss update banner", () => {
    const onDismissUpdate = vi.fn();
    render(
      <PwaOtaBanner
        isOnline={true}
        isUpdateAvailable={true}
        isUpdating={false}
        currentVersion="1.0.1"
        newVersion="1.0.2"
        onApplyUpdate={vi.fn()}
        onDismissUpdate={onDismissUpdate}
      />
    );

    const closeBtn = screen.getByRole("button", {
      name: "Dismiss update notification",
    });
    fireEvent.click(closeBtn);

    expect(onDismissUpdate).toHaveBeenCalledTimes(1);
  });

  it("renders Install App button when isInstallable is true and triggers onPromptInstall on click", () => {
    const onPromptInstall = vi.fn();
    render(
      <PwaOtaBanner
        isOnline={true}
        isUpdateAvailable={false}
        isUpdating={false}
        isInstallable={true}
        currentVersion="1.0.1"
        onApplyUpdate={vi.fn()}
        onDismissUpdate={vi.fn()}
        onPromptInstall={onPromptInstall}
      />
    );

    expect(screen.getByText("Install DPM App")).toBeDefined();
    const installBtn = screen.getByRole("button", { name: "Install" });
    fireEvent.click(installBtn);

    expect(onPromptInstall).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner on Update Now button when isUpdating is true", () => {
    render(
      <PwaOtaBanner
        isOnline={true}
        isUpdateAvailable={true}
        isUpdating={true}
        currentVersion="1.0.1"
        newVersion="1.0.2"
        onApplyUpdate={vi.fn()}
        onDismissUpdate={vi.fn()}
      />
    );

    const updateBtn = screen.getByRole("button", { name: /update now/i });
    expect(updateBtn.getAttribute("aria-busy")).toBe("true");
  });
});
