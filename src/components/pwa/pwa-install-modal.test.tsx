import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { PwaInstallModal } from "./pwa-install-modal";

const mockPromptInstall = vi.fn().mockResolvedValue(true);
let mockIsInstallable = false;

vi.mock("./pwa-ota-manager", () => ({
  usePwaOtaContext: () => ({
    isSupported: true,
    isOnline: true,
    isUpdateAvailable: false,
    isChecking: false,
    isUpdating: false,
    isInstallable: mockIsInstallable,
    currentVersion: "1.0.1",
    newVersion: null,
    releaseNotes: null,
    gitCommit: "abc1234",
    githubUrl: "https://github.com/eyuelkebede20/dpm2",
    checkForUpdate: vi.fn(),
    applyUpdate: vi.fn(),
    promptInstall: mockPromptInstall,
    dismissUpdate: vi.fn(),
  }),
}));

describe("PwaInstallModal Component", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInstallable = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(<PwaInstallModal isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal with header, install action, shortcut button, and platform guides when isOpen is true", () => {
    render(<PwaInstallModal isOpen={true} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: /download & install dpm app/i })).toBeDefined();
    expect(screen.getByTestId("pwa-primary-install-button")).toBeDefined();
    expect(screen.getByTestId("pwa-download-shortcut-button")).toBeDefined();
    expect(screen.getByText(/desktop \(pc\/mac\)/i)).toBeDefined();
    expect(screen.getByText(/android/i)).toBeDefined();
    expect(screen.getByText(/iphone \/ ipad/i)).toBeDefined();
  });

  it("switches instruction tabs when platform buttons are clicked", () => {
    render(<PwaInstallModal isOpen={true} onClose={onClose} />);

    // Click Android tab
    const androidTab = screen.getByRole("button", { name: /android/i });
    fireEvent.click(androidTab);
    expect(screen.getByText(/menu \(⋮\)/i)).toBeDefined();

    // Click iOS tab
    const iosTab = screen.getByRole("button", { name: /iphone \/ ipad/i });
    fireEvent.click(iosTab);
    expect(screen.getByText(/safari/i)).toBeDefined();
    expect(screen.getByText(/add to home screen/i)).toBeDefined();

    // Click Desktop tab
    const desktopTab = screen.getByRole("button", { name: /desktop \(pc\/mac\)/i });
    fireEvent.click(desktopTab);
    expect(screen.getByText(/google chrome/i)).toBeDefined();
  });

  it("calls promptInstall and closes modal when 1-click install succeeds", async () => {
    mockIsInstallable = true;
    mockPromptInstall.mockResolvedValueOnce(true);

    render(<PwaInstallModal isOpen={true} onClose={onClose} />);

    const installBtn = screen.getByTestId("pwa-primary-install-button");
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(mockPromptInstall).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("triggers file download for desktop shortcut (.url) when button is clicked", () => {
    const createElementSpy = vi.spyOn(document, "createElement");
    render(<PwaInstallModal isOpen={true} onClose={onClose} />);

    const shortcutBtn = screen.getByTestId("pwa-download-shortcut-button");
    fireEvent.click(shortcutBtn);

    expect(createElementSpy).toHaveBeenCalledWith("a");
  });

  it("calls onClose when Close button or Escape key is pressed", () => {
    render(<PwaInstallModal isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByRole("button", { name: /close dialog/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
