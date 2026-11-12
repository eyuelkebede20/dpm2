/**
 * Backend Server Configuration & Network Switcher
 *
 * Enables PWA clients and users to dynamically toggle between
 * local on-prem factory LAN servers and public internet cloud instances.
 */

export interface ServerEndpoint {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  environment: "lan" | "cloud" | "local" | "backup";
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ServerEndpointItem {
  id: string;
  name: string;
  url: string;
  description: string | null;
  environment: "lan" | "cloud" | "local" | "backup";
  isDefault: boolean;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerConnectionResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  appName?: string;
  version?: string;
  gitCommit?: string;
  error?: string;
  checkedAt: string;
}

export const BACKEND_STORAGE_KEY = "dpm_active_backend_url";
export const BACKEND_COOKIE_KEY = "dpm_backend_url";
export const BACKEND_EVENT_NAME = "dpm:backend-changed";

export const DEFAULT_SERVER_PRESETS: ServerEndpoint[] = [
  {
    id: "srv_lan_factory",
    name: "Main Plant Factory LAN",
    url: "http://192.168.1.100:3000",
    description: "On-premises high-speed factory local area network",
    environment: "lan",
    isDefault: true,
    isActive: true,
  },
  {
    id: "srv_hq_cloud",
    name: "Homicho HQ Internet Cloud",
    url: "https://dpm.homicho.et",
    description: "Central cloud server accessible over public internet / mobile data",
    environment: "cloud",
    isDefault: false,
    isActive: true,
  },
  {
    id: "srv_localhost",
    name: "Localhost Edge / Developer",
    url: "http://localhost:3000",
    description: "Local workstation development gateway",
    environment: "local",
    isDefault: false,
    isActive: true,
  },
];

export const FALLBACK_SERVER_ENDPOINTS: ServerEndpointItem[] = [
  {
    id: "srv_lan_factory",
    name: "Main Plant Factory LAN",
    url: "http://192.168.1.100:3000",
    description: "On-premises high-speed factory local area network",
    environment: "lan",
    isDefault: true,
    isActive: true,
    createdBy: null,
    createdAt: new Date("2026-11-12T00:00:00Z"),
    updatedAt: new Date("2026-11-12T00:00:00Z"),
  },
  {
    id: "srv_hq_cloud",
    name: "Homicho HQ Internet Cloud",
    url: "https://dpm.homicho.et",
    description: "Central cloud server accessible over public internet / mobile data",
    environment: "cloud",
    isDefault: false,
    isActive: true,
    createdBy: null,
    createdAt: new Date("2026-11-12T00:00:00Z"),
    updatedAt: new Date("2026-11-12T00:00:00Z"),
  },
  {
    id: "srv_localhost",
    name: "Localhost Edge / Developer",
    url: "http://localhost:3000",
    description: "Local workstation development gateway",
    environment: "local",
    isDefault: false,
    isActive: true,
    createdBy: null,
    createdAt: new Date("2026-11-12T00:00:00Z"),
    updatedAt: new Date("2026-11-12T00:00:00Z"),
  },
];

/**
 * Normalizes URL by trimming and removing trailing slash
 */
export function cleanServerUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim();
  while (trimmed.endsWith("/")) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

/**
 * Normalizes input URL by trimming whitespace, auto-prefixing http:// if missing,
 * and stripping trailing slashes.
 */
export function normalizeServerUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  let cleaned = rawUrl.trim();
  if (!cleaned) return "";

  // Check if string already has a URL scheme (e.g. ftp://, http://, https://, ws://)
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned);
  if (!hasScheme) {
    cleaned = `http://${cleaned}`;
  }

  // Strip trailing slashes
  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

/**
 * Validates a server URL format and protocol.
 */
export function validateServerUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const normalized = normalizeServerUrl(rawUrl);
  if (!normalized) {
    return { valid: false, normalizedUrl: "", error: "Server URL cannot be empty" };
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        valid: false,
        normalizedUrl: normalized,
        error: "Protocol must be HTTP or HTTPS (e.g., http://192.168.1.100:3000)",
      };
    }

    if (!parsed.hostname) {
      return {
        valid: false,
        normalizedUrl: normalized,
        error: "Server URL must specify a valid hostname or IP address",
      };
    }

    return { valid: true, normalizedUrl: normalized };
  } catch {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: "Invalid URL format. Example: http://192.168.1.100:3000 or https://dpm.homicho.et",
    };
  }
}

/**
 * Reads active backend URL from localStorage or current window origin.
 */
export function getActiveBackendUrl(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(BACKEND_STORAGE_KEY);
      if (stored) {
        const val = validateServerUrl(stored);
        if (val.valid) return val.normalizedUrl;
      }
      return window.location.origin;
    } catch {
      return window.location.origin;
    }
  }

  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Checks if the user is pointing to a custom backend differing from current window origin.
 */
export function isCustomBackendActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const active = getActiveBackendUrl();
    return active !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Sets active backend URL, saves to localStorage, sets cookie, and dispatches change event.
 */
export function setActiveBackendUrl(rawUrl: string): { success: boolean; error?: string } {
  const validation = validateServerUrl(rawUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(BACKEND_STORAGE_KEY, validation.normalizedUrl);
      document.cookie = `${BACKEND_COOKIE_KEY}=${encodeURIComponent(
        validation.normalizedUrl
      )}; path=/; max-age=31536000; SameSite=Lax`;

      window.dispatchEvent(
        new CustomEvent(BACKEND_EVENT_NAME, {
          detail: { url: validation.normalizedUrl },
        })
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to persist server selection" };
    }
  }

  return { success: true };
}

/**
 * Resets active backend URL back to current window origin.
 */
export function resetActiveBackendUrl(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(BACKEND_STORAGE_KEY);
      document.cookie = `${BACKEND_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;

      window.dispatchEvent(
        new CustomEvent(BACKEND_EVENT_NAME, {
          detail: { url: window.location.origin, isReset: true },
        })
      );
    } catch (e) {
      console.warn("Could not reset backend URL storage:", e);
    }
  }
}

/**
 * Tests connection to a target server URL via /api/health and /api/version.
 * Measures roundtrip latency and inspects server status.
 */
export async function testServerConnection(
  rawUrl: string,
  timeoutMs = 5000
): Promise<ServerConnectionResult> {
  const validation = validateServerUrl(rawUrl);
  const now = new Date().toISOString();

  if (!validation.valid) {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      error: validation.error || "Invalid URL",
      checkedAt: now,
    };
  }

  const targetUrl = validation.normalizedUrl;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    // 1. Ping /api/health
    const healthRes = await fetch(`${targetUrl}/api/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latencyMs = Math.max(1, Math.round(endTime - startTime));

    clearTimeout(timeoutId);

    if (!healthRes.ok) {
      return {
        ok: false,
        status: healthRes.status,
        latencyMs,
        error: `Server responded with HTTP ${healthRes.status}`,
        checkedAt: now,
      };
    }

    // 2. Fetch /api/version for app identity and commit
    let appName: string | undefined;
    let version: string | undefined;
    let gitCommit: string | undefined;

    try {
      const versionRes = await fetch(`${targetUrl}/api/version`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (versionRes.ok) {
        const vData = await versionRes.json();
        appName = vData.appName;
        version = vData.version;
        gitCommit = vData.gitCommit;
      }
    } catch {
      // Non-critical if version route fails while health succeeded
    }

    return {
      ok: true,
      status: healthRes.status,
      latencyMs,
      appName: appName || "DPM Factory Server",
      version: version || "1.0.1",
      gitCommit,
      checkedAt: now,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latencyMs = Math.max(1, Math.round(endTime - startTime));

    if (err.name === "AbortError") {
      return {
        ok: false,
        status: 408,
        latencyMs,
        error: `Connection timed out after ${timeoutMs}ms. Check IP, port, or WiFi connection.`,
        checkedAt: now,
      };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return {
        ok: false,
        status: 0,
        latencyMs: 0,
        error: "Your device is currently offline.",
        checkedAt: now,
      };
    }

    return {
      ok: false,
      status: 0,
      latencyMs,
      error:
        err.message ||
        "Could not connect to target server. Verify URL, network route, or CORS policy.",
      checkedAt: now,
    };
  }
}
