// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBackendServer } from "./use-backend-server";

describe("useBackendServer - Hook Unit Tests & Cache Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // Default fetch mock
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        endpoints: [
          {
            id: "srv_mock",
            name: "Mock Server",
            url: "http://192.168.1.50:3000",
            environment: "lan",
            isDefault: true,
            isActive: true,
          },
        ],
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with default backend url and presets", () => {
    const { result } = renderHook(() => useBackendServer());
    expect(result.current.activeUrl).toBeDefined();
    expect(result.current.isCustom).toBe(false);
    expect(result.current.presets).toBeDefined();
    expect(Array.isArray(result.current.presets)).toBe(true);
  });

  it("allows selecting a preset and updates activeUrl", () => {
    const { result } = renderHook(() => useBackendServer());

    act(() => {
      result.current.selectPreset({
        id: "srv_test",
        name: "Test LAN",
        url: "http://192.168.1.99:3000",
        environment: "lan",
      });
    });

    expect(result.current.activeUrl).toBe("http://192.168.1.99:3000");
    expect(result.current.isCustom).toBe(true);
  });

  it("allows setting a valid custom URL", () => {
    const { result } = renderHook(() => useBackendServer());

    let success = false;
    act(() => {
      success = result.current.setCustomUrl("http://192.168.1.200:3000");
    });

    expect(success).toBe(true);
    expect(result.current.activeUrl).toBe("http://192.168.1.200:3000");
  });

  it("resets active URL back to current window origin", () => {
    const { result } = renderHook(() => useBackendServer());

    act(() => {
      result.current.setCustomUrl("http://192.168.1.200:3000");
    });
    expect(result.current.isCustom).toBe(true);

    act(() => {
      result.current.resetToCurrentOrigin();
    });

    expect(result.current.isCustom).toBe(false);
  });

  it("tests connection to a server endpoint", async () => {
    const { result } = renderHook(() => useBackendServer());

    const connectionRes = await act(async () => {
      return await result.current.testUrl("http://192.168.1.100:3000");
    });

    expect(connectionRes).toBeDefined();
    expect(result.current.testResult).toBeDefined();
  });
});
