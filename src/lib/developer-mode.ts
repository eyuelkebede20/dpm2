/**
 * Developer Mode Configuration & Utilities
 *
 * Controls visibility of developer-only tooling (e.g., RoleSwitcher)
 * strictly restricted to authenticated System Administrators.
 */

export const DEVELOPER_MODE_STORAGE_KEY = "dpm_developer_mode_enabled";
export const DEVELOPER_MODE_COOKIE_KEY = "dpm_developer_mode";
export const DEVELOPER_MODE_EVENT_NAME = "dpm:developer-mode-changed";

/**
 * Checks whether developer mode is currently active on the client.
 * Returns false during SSR or if storage is inaccessible.
 */
export function isDeveloperModeActive(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = window.localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;

    // Fallback: Check cookie
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split("=");
      if (name === DEVELOPER_MODE_COOKIE_KEY) {
        return val === "true";
      }
    }
  } catch {
    // Storage access blocked or restricted
    return false;
  }

  return false;
}

/**
 * Sets developer mode active state in localStorage and cookies,
 * and broadcasts an event to sync all open tabs and components.
 */
export function setDeveloperModeActive(enabled: boolean): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      DEVELOPER_MODE_STORAGE_KEY,
      enabled ? "true" : "false"
    );

    // Set cookie for 30 days when enabled, or expire immediately when disabled
    const expires = enabled
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
      : "Thu, 01 Jan 1970 00:00:00 GMT";
    const maxAge = enabled ? 30 * 24 * 60 * 60 : 0;
    document.cookie = `${DEVELOPER_MODE_COOKIE_KEY}=${
      enabled ? "true" : "false"
    }; path=/; max-age=${maxAge}; expires=${expires}; SameSite=Lax`;

    // Broadcast change to other components on current window
    window.dispatchEvent(
      new CustomEvent(DEVELOPER_MODE_EVENT_NAME, {
        detail: { enabled },
      })
    );
  } catch (err) {
    console.error("Failed to persist developer mode preference:", err);
  }
}
