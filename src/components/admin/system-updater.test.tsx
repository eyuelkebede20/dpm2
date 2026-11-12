import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SystemUpdater } from "./system-updater";
import * as adminActions from "@/actions/admin-actions";

vi.mock("@/actions/admin-actions", () => ({
  triggerSystemUpdateAction: vi.fn(),
}));

describe("SystemUpdater Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders idle state with update button and informative instructions", () => {
    render(<SystemUpdater statusPollMs={5} healthPollMs={5} initialRestartDelayMs={5} />);

    expect(screen.getByText("System Update & Self-Healing Deployment")).toBeDefined();
    expect(screen.getByRole("button", { name: /pull latest updates & rebuild/i })).toBeDefined();
    expect(screen.queryByTestId("update-terminal-log")).toBeNull();
  });

  it("opens confirmation modal when clicking update button and allows canceling", () => {
    render(<SystemUpdater statusPollMs={5} healthPollMs={5} initialRestartDelayMs={5} />);

    const updateBtn = screen.getByRole("button", { name: /pull latest updates & rebuild/i });
    fireEvent.click(updateBtn);

    expect(screen.getByText("Confirm System Update")).toBeDefined();
    expect(screen.getByText(/Are you sure you want to pull the latest code and rebuild\?/i)).toBeDefined();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText("Confirm System Update")).toBeNull();
    expect(adminActions.triggerSystemUpdateAction).not.toHaveBeenCalled();
  });

  it("handles trigger action failure gracefully", async () => {
    vi.mocked(adminActions.triggerSystemUpdateAction).mockRejectedValueOnce(
      new Error("Permission denied writing to flag file")
    );

    render(<SystemUpdater statusPollMs={5} healthPollMs={5} initialRestartDelayMs={5} />);

    const updateBtn = screen.getByRole("button", { name: /pull latest updates & rebuild/i });
    fireEvent.click(updateBtn);

    const startBtn = screen.getByRole("button", { name: /start update now/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });

    expect(screen.getByText(/Permission denied writing to flag file/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /retry update/i })).toBeDefined();
  });

  it("executes update workflow, streams terminal output, and shows success upon health verification", async () => {
    vi.mocked(adminActions.triggerSystemUpdateAction).mockResolvedValueOnce({
      success: true,
      message: "Update requested",
    });

    let statusCallCount = 0;
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/update-status")) {
        statusCallCount++;
        if (statusCallCount === 1) {
          return {
            ok: true,
            json: async () => ({
              lines: ["[1/4] Pulling latest git code..."],
              done: false,
              failed: false,
            }),
          } as Response;
        } else {
          return {
            ok: true,
            json: async () => ({
              lines: [
                "[1/4] Pulling latest git code...",
                "[2/4] Running migrations...",
                "[4/4] Update complete and application is healthy.",
              ],
              done: true,
              failed: false,
            }),
          } as Response;
        }
      }

      if (urlStr.includes("/api/health")) {
        return {
          ok: true,
          json: async () => ({ status: "ok" }),
        } as Response;
      }

      return { ok: false } as Response;
    });

    render(<SystemUpdater statusPollMs={5} healthPollMs={5} initialRestartDelayMs={5} />);

    const updateBtn = screen.getByRole("button", { name: /pull latest updates & rebuild/i });
    fireEvent.click(updateBtn);

    const startBtn = screen.getByRole("button", { name: /start update now/i });
    fireEvent.click(startBtn);

    // Terminal log should appear
    await waitFor(() => {
      expect(screen.getByTestId("update-terminal-log")).toBeDefined();
    });

    // Wait for health check & success message
    await waitFor(
      () => {
        expect(screen.getByText("Update Complete Successfully!")).toBeDefined();
      },
      { timeout: 5000 }
    );

    expect(screen.getByText(/The application has been upgraded to the latest version/i)).toBeDefined();
  });

  it("displays failure alert and terminal when update reports failure", async () => {
    vi.mocked(adminActions.triggerSystemUpdateAction).mockResolvedValueOnce({
      success: true,
      message: "Update requested",
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        lines: [
          "=== DPM2 Update started ===",
          "[!] git pull failed",
          "Rollback complete to previous commit",
        ],
        done: true,
        failed: true,
      }),
    } as Response);

    render(<SystemUpdater statusPollMs={5} healthPollMs={5} initialRestartDelayMs={5} />);

    const updateBtn = screen.getByRole("button", { name: /pull latest updates & rebuild/i });
    fireEvent.click(updateBtn);

    const startBtn = screen.getByRole("button", { name: /start update now/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });

    expect(screen.getByText("Update Interrupted or Failed")).toBeDefined();
    expect(screen.getByRole("button", { name: /retry update/i })).toBeDefined();
  });
});
