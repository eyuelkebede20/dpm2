import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { BackendServerSettingsModal } from "./backend-server-settings-modal";
import * as backendConfig from "@/lib/backend-config";
import * as serverActions from "@/actions/server-endpoint-actions";

vi.mock("@/actions/server-endpoint-actions", () => ({
  createServerEndpointAction: vi.fn(),
  updateServerEndpointAction: vi.fn(),
  deleteServerEndpointAction: vi.fn(),
  toggleServerEndpointActiveAction: vi.fn(),
  getServerEndpointsAction: vi.fn().mockResolvedValue([
    {
      id: "srv_lan",
      name: "Main Plant Factory LAN",
      url: "http://192.168.1.100:3000",
      description: "On-premises factory LAN",
      environment: "lan",
      isDefault: true,
      isActive: true,
    },
    {
      id: "srv_cloud",
      name: "Homicho HQ Internet Cloud",
      url: "https://dpm.homicho.et",
      description: "Central cloud server",
      environment: "cloud",
      isDefault: false,
      isActive: true,
    },
  ]),
}));

describe("BackendServerSettingsModal - Interactive & Accessibility Audit", () => {
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when isOpen is false", () => {
    render(<BackendServerSettingsModal isOpen={false} onClose={mockClose} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders with accessible role, title, and active server display when open", () => {
    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(screen.getByText(/Backend Server & Network Settings/i)).toBeDefined();
    expect(screen.getByText(/Currently Active Server/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Test Connection/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Switch & Connect/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Close server settings/i })).toBeDefined();
  });

  it("renders preset servers and allows selecting them", async () => {
    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} />);

    // Presets should be rendered
    expect(screen.getByText("Main Plant Factory LAN")).toBeDefined();
    expect(screen.getByText("Homicho HQ Internet Cloud")).toBeDefined();

    // Click on Cloud preset
    const cloudPreset = screen.getByText("Homicho HQ Internet Cloud");
    fireEvent.click(cloudPreset);

    // Verify it is selected
    expect(screen.getByText("https://dpm.homicho.et")).toBeDefined();
  });

  it("reveals custom URL input when 'Custom Server Address' is clicked and toggles protocols", () => {
    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} />);

    // Click custom address card
    const customCard = screen.getByText(/Custom Server Address/i);
    fireEvent.click(customCard);

    // Custom input should appear
    const input = screen.getByPlaceholderText(/http:\/\/192.168.1.50:3000/i);
    expect(input).toBeDefined();

    // Type a custom URL
    fireEvent.change(input, { target: { value: "10.0.0.5:3000" } });

    // Click http:// toggle button
    const httpBtn = screen.getByRole("button", { name: /http:\/\/ \(LAN IP\)/i });
    fireEvent.click(httpBtn);
    expect((input as HTMLInputElement).value).toBe("http://10.0.0.5:3000");

    // Click https:// toggle button
    const httpsBtn = screen.getByRole("button", { name: /https:\/\/ \(Cloud\)/i });
    fireEvent.click(httpsBtn);
    expect((input as HTMLInputElement).value).toBe("https://10.0.0.5:3000");
  });

  it("executes 'Test Connection' and displays diagnostic result", async () => {
    vi.spyOn(backendConfig, "testServerConnection").mockResolvedValue({
      ok: true,
      status: 200,
      latencyMs: 18,
      appName: "Homicho Munitions Test",
      version: "1.0.1",
      checkedAt: new Date().toISOString(),
    });

    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} />);

    const testBtn = screen.getByRole("button", { name: /Test Connection/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/Connection Successful/i)).toBeDefined();
      expect(screen.getByText(/18ms latency/i)).toBeDefined();
      expect(screen.getByText("Homicho Munitions Test")).toBeDefined();
    });
  });

  it("handles 'Switch & Connect' and closes modal on success", async () => {
    vi.spyOn(backendConfig, "testServerConnection").mockResolvedValue({
      ok: true,
      status: 200,
      latencyMs: 15,
      version: "1.0.1",
      checkedAt: new Date().toISOString(),
    });

    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} />);

    const switchBtn = screen.getByRole("button", { name: /Switch & Connect/i });
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it("displays admin '+ Add Preset' button and allows sys_admin to add a preset", async () => {
    vi.mocked(serverActions.createServerEndpointAction).mockResolvedValue({
      success: true,
      endpoint: {
        id: "srv_new",
        name: "Workshop 03 LAN",
        url: "http://192.168.1.180:3000",
        environment: "lan",
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });

    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} isAdmin={true} />);

    // Admin should see 'Add Preset' button
    const addPresetBtn = screen.getByRole("button", { name: /Add Preset/i });
    expect(addPresetBtn).toBeDefined();

    // Click to open inline form
    fireEvent.click(addPresetBtn);

    expect(screen.getByText(/Add New Shared Server Preset/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Workshop 02 LAN/i)).toBeDefined();
  });

  it("does not render Developer Options section when isAdmin is false", () => {
    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} isAdmin={false} />);
    expect(screen.queryByText(/Developer Options/i)).toBeNull();
    expect(screen.queryByRole("switch", { name: /Toggle Developer Option/i })).toBeNull();
  });

  it("renders Developer Options switch for sys_admin and toggles developer mode", () => {
    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} isAdmin={true} />);

    expect(screen.getByText(/Developer Options/i)).toBeDefined();
    const devSwitch = screen.getByRole("switch", { name: /Toggle Developer Option/i });
    expect(devSwitch).toBeDefined();
    expect(devSwitch.getAttribute("aria-checked")).toBe("false");

    // Toggle on
    fireEvent.click(devSwitch);
    expect(devSwitch.getAttribute("aria-checked")).toBe("true");

    // Toggle off
    fireEvent.click(devSwitch);
    expect(devSwitch.getAttribute("aria-checked")).toBe("false");
  });

  it("renders PWA download section with action button and toggles device installation instructions", () => {
    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} />);

    // Section title
    expect(screen.getByText(/Download App \(PWA\)/i)).toBeDefined();

    // Download / Install button
    const downloadBtn = screen.getByTestId("download-pwa-button");
    expect(downloadBtn).toBeDefined();

    // Toggle device instructions guide
    const guideToggle = screen.getByRole("button", {
      name: /How to install on iOS, Android, and Desktop/i,
    });
    expect(guideToggle).toBeDefined();

    fireEvent.click(guideToggle);
    expect(screen.getByText(/iOS \/ iPhone/i)).toBeDefined();
    expect(screen.getAllByText(/Android/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Desktop PC/i)).toBeDefined();

    // Clicking download button triggers feedback or install
    fireEvent.click(downloadBtn);
  });

  it("closes on Escape key press", () => {
    render(<BackendServerSettingsModal isOpen={true} onClose={mockClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
