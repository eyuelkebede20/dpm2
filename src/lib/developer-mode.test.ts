import "@/test/setup-dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  isDeveloperModeActive,
  setDeveloperModeActive,
  DEVELOPER_MODE_STORAGE_KEY,
} from "./developer-mode";
import { useDeveloperMode } from "@/hooks/use-developer-mode";

describe("Developer Mode Library & Hook (developer-mode.ts & use-developer-mode.ts)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setDeveloperModeActive(false);
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
    setDeveloperModeActive(false);
  });

  describe("isDeveloperModeActive() and setDeveloperModeActive()", () => {
    it("returns false by default when nothing is set in storage", () => {
      expect(isDeveloperModeActive()).toBe(false);
    });

    it("persists true to localStorage and cookie when setDeveloperModeActive(true) is called", () => {
      setDeveloperModeActive(true);
      expect(isDeveloperModeActive()).toBe(true);
      expect(window.localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY)).toBe("true");
      expect(document.cookie).toContain("dpm_developer_mode=true");
    });

    it("persists false to localStorage and clears cookie when setDeveloperModeActive(false) is called", () => {
      setDeveloperModeActive(true);
      expect(isDeveloperModeActive()).toBe(true);

      setDeveloperModeActive(false);
      expect(isDeveloperModeActive()).toBe(false);
      expect(window.localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY)).toBe("false");
    });
  });

  describe("useDeveloperMode Hook", () => {
    it("returns isDeveloperMode false for non-sys_admin even if storage is true", () => {
      setDeveloperModeActive(true);

      const { result } = renderHook(() => useDeveloperMode(false));
      expect(result.current.isDeveloperMode).toBe(false);

      // Attempting to toggle should be blocked
      act(() => {
        result.current.toggleDeveloperMode();
      });
      expect(result.current.isDeveloperMode).toBe(false);
    });

    it("allows sys_admin to toggle and update developer mode", () => {
      const { result } = renderHook(() => useDeveloperMode(true));
      expect(result.current.isDeveloperMode).toBe(false);

      act(() => {
        result.current.toggleDeveloperMode();
      });
      expect(result.current.isDeveloperMode).toBe(true);
      expect(isDeveloperModeActive()).toBe(true);

      act(() => {
        result.current.setDeveloperMode(false);
      });
      expect(result.current.isDeveloperMode).toBe(false);
      expect(isDeveloperModeActive()).toBe(false);
    });
  });
});
