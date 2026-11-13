"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isDeveloperModeActive,
  setDeveloperModeActive,
  DEVELOPER_MODE_EVENT_NAME,
  DEVELOPER_MODE_STORAGE_KEY,
} from "@/lib/developer-mode";

export interface UseDeveloperModeReturn {
  isDeveloperMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  toggleDeveloperMode: () => void;
}

/**
 * Hook to read and toggle Developer Mode preference.
 * If isSysAdmin is false, isDeveloperMode will always evaluate to false,
 * preventing any non-systemadmin user from accessing developer tooling.
 */
export function useDeveloperMode(isSysAdmin: boolean = true): UseDeveloperModeReturn {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!isSysAdmin) return false;
    return isDeveloperModeActive();
  });

  // Keep in sync with custom event and storage events
  useEffect(() => {
    if (!isSysAdmin) {
      setEnabled(false);
      return;
    }

    // Initialize from current state
    setEnabled(isDeveloperModeActive());

    function handleCustomEvent(e: Event) {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === "boolean") {
        setEnabled(customEvent.detail.enabled);
      } else {
        setEnabled(isDeveloperModeActive());
      }
    }

    function handleStorageEvent(e: StorageEvent) {
      if (e.key === DEVELOPER_MODE_STORAGE_KEY) {
        setEnabled(e.newValue === "true");
      }
    }

    window.addEventListener(DEVELOPER_MODE_EVENT_NAME, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(DEVELOPER_MODE_EVENT_NAME, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [isSysAdmin]);

  const setDeveloperMode = useCallback(
    (nextState: boolean) => {
      if (!isSysAdmin) return;
      setDeveloperModeActive(nextState);
      setEnabled(nextState);
    },
    [isSysAdmin]
  );

  const toggleDeveloperMode = useCallback(() => {
    if (!isSysAdmin) return;
    setEnabled((prev) => {
      const next = !prev;
      setDeveloperModeActive(next);
      return next;
    });
  }, [isSysAdmin]);

  return {
    isDeveloperMode: isSysAdmin ? enabled : false,
    setDeveloperMode,
    toggleDeveloperMode,
  };
}
