// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeServerUrl,
  validateServerUrl,
  getActiveBackendUrl,
  isCustomBackendActive,
  setActiveBackendUrl,
  resetActiveBackendUrl,
  testServerConnection,
  BACKEND_STORAGE_KEY,
  BACKEND_EVENT_NAME,
  DEFAULT_SERVER_PRESETS,
} from "./backend-config";

describe("Backend Server Configuration & Network Switcher (backend-config.ts)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = "";
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("normalizeServerUrl", () => {
    it("auto-prefixes http:// if scheme is missing", () => {
      expect(normalizeServerUrl("192.168.1.50:3000")).toBe("http://192.168.1.50:3000");
      expect(normalizeServerUrl("dpm.homicho.et")).toBe("http://dpm.homicho.et");
    });

    it("preserves explicit http:// and https:// schemes", () => {
      expect(normalizeServerUrl("http://localhost:3000")).toBe("http://localhost:3000");
      expect(normalizeServerUrl("https://defense-cloud.et")).toBe("https://defense-cloud.et");
    });

    it("strips trailing slashes and whitespace", () => {
      expect(normalizeServerUrl("  http://192.168.1.100:3000///  ")).toBe(
        "http://192.168.1.100:3000"
      );
      expect(normalizeServerUrl("https://cloud.dpm.et/")).toBe("https://cloud.dpm.et");
    });

    it("returns empty string for empty input", () => {
      expect(normalizeServerUrl("")).toBe("");
      expect(normalizeServerUrl("   ")).toBe("");
    });
  });

  describe("validateServerUrl", () => {
    it("validates well-formed HTTP and HTTPS URLs", () => {
      const lan = validateServerUrl("http://192.168.1.100:3000");
      expect(lan.valid).toBe(true);
      expect(lan.normalizedUrl).toBe("http://192.168.1.100:3000");

      const cloud = validateServerUrl("https://dpm.homicho.et");
      expect(cloud.valid).toBe(true);
      expect(cloud.normalizedUrl).toBe("https://dpm.homicho.et");
    });

    it("rejects non-HTTP protocols", () => {
      const ftp = validateServerUrl("ftp://192.168.1.100");
      expect(ftp.valid).toBe(false);
      expect(ftp.error).toMatch(/HTTP or HTTPS/i);
    });

    it("rejects empty or whitespace strings", () => {
      const empty = validateServerUrl("");
      expect(empty.valid).toBe(false);
      expect(empty.error).toMatch(/cannot be empty/i);
    });
  });

  describe("getActiveBackendUrl & isCustomBackendActive", () => {
    it("returns window.location.origin by default when nothing is stored", () => {
      expect(getActiveBackendUrl()).toBe(window.location.origin);
      expect(isCustomBackendActive()).toBe(false);
    });

    it("returns stored URL and flags isCustomBackendActive when custom URL is set", () => {
      window.localStorage.setItem(BACKEND_STORAGE_KEY, "http://192.168.1.200:3000");
      expect(getActiveBackendUrl()).toBe("http://192.168.1.200:3000");
      expect(isCustomBackendActive()).toBe(true);
    });
  });

  describe("setActiveBackendUrl & resetActiveBackendUrl", () => {
    it("saves validated URL to localStorage and dispatches custom event", () => {
      let eventPayload: any = null;
      window.addEventListener(BACKEND_EVENT_NAME, ((e: CustomEvent) => {
        eventPayload = e.detail;
      }) as EventListener);

      const res = setActiveBackendUrl("http://192.168.1.100:3000/");
      expect(res.success).toBe(true);
      expect(window.localStorage.getItem(BACKEND_STORAGE_KEY)).toBe(
        "http://192.168.1.100:3000"
      );
      expect(eventPayload).toEqual({ url: "http://192.168.1.100:3000" });
    });

    it("rejects invalid URLs without modifying storage", () => {
      const res = setActiveBackendUrl("ftp://bad");
      expect(res.success).toBe(false);
      expect(window.localStorage.getItem(BACKEND_STORAGE_KEY)).toBeNull();
    });

    it("resets active backend URL back to window.location.origin", () => {
      window.localStorage.setItem(BACKEND_STORAGE_KEY, "http://192.168.1.100:3000");
      resetActiveBackendUrl();
      expect(window.localStorage.getItem(BACKEND_STORAGE_KEY)).toBeNull();
      expect(getActiveBackendUrl()).toBe(window.location.origin);
      expect(isCustomBackendActive()).toBe(false);
    });
  });

  describe("testServerConnection", () => {
    it("measures latency and returns server version when target is healthy", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/health")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: "healthy", database: "connected" }),
          });
        }
        if (url.includes("/api/version")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                appName: "Homicho Munitions Complex",
                version: "1.0.1",
                gitCommit: "1a5cbc8",
              }),
          });
        }
        return Promise.reject(new Error("Not found"));
      });

      const res = await testServerConnection("http://192.168.1.100:3000");
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.latencyMs).toBeGreaterThanOrEqual(1);
      expect(res.version).toBe("1.0.1");
      expect(res.appName).toBe("Homicho Munitions Complex");
    });

    it("returns error details when /api/health responds with 503", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const res = await testServerConnection("http://192.168.1.100:3000");
      expect(res.ok).toBe(false);
      expect(res.status).toBe(503);
      expect(res.error).toMatch(/HTTP 503/i);
    });

    it("returns timeout error when connection exceeds limit", async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      });

      const res = await testServerConnection("http://10.255.255.1:3000", 500);
      expect(res.ok).toBe(false);
      expect(res.status).toBe(408);
      expect(res.error).toMatch(/timed out/i);
    });
  });

  describe("DEFAULT_SERVER_PRESETS", () => {
    it("includes LAN, Cloud, and Localhost presets", () => {
      expect(DEFAULT_SERVER_PRESETS.length).toBeGreaterThanOrEqual(3);
      expect(DEFAULT_SERVER_PRESETS.some((p) => p.environment === "lan")).toBe(true);
      expect(DEFAULT_SERVER_PRESETS.some((p) => p.environment === "cloud")).toBe(true);
      expect(DEFAULT_SERVER_PRESETS.some((p) => p.environment === "local")).toBe(true);
    });
  });
});
