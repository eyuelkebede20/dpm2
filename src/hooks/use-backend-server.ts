"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ServerEndpoint,
  ServerConnectionResult,
  DEFAULT_SERVER_PRESETS,
  getActiveBackendUrl,
  isCustomBackendActive,
  setActiveBackendUrl,
  resetActiveBackendUrl,
  testServerConnection,
  validateServerUrl,
  BACKEND_EVENT_NAME,
} from "@/lib/backend-config";
import { toast } from "sonner";

export interface UseBackendServerReturn {
  activeUrl: string;
  isCustom: boolean;
  presets: ServerEndpoint[];
  isLoadingPresets: boolean;
  testResult: ServerConnectionResult | null;
  isTesting: boolean;
  testUrl: (url: string) => Promise<ServerConnectionResult>;
  selectPreset: (preset: ServerEndpoint) => void;
  setCustomUrl: (url: string) => boolean;
  resetToCurrentOrigin: () => void;
  switchAndConnect: (url: string, mode?: "navigate" | "api") => Promise<boolean>;
  refreshPresets: () => Promise<void>;
}

export function useBackendServer(): UseBackendServerReturn {
  const [activeUrl, setActiveUrl] = useState<string>(() => getActiveBackendUrl());
  const [isCustom, setIsCustom] = useState<boolean>(() => isCustomBackendActive());
  const [presets, setPresets] = useState<ServerEndpoint[]>(DEFAULT_SERVER_PRESETS);
  const [isLoadingPresets, setIsLoadingPresets] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<ServerConnectionResult | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Sync state when custom event fires
  useEffect(() => {
    function handleBackendChange(e: Event) {
      const customEvent = e as CustomEvent;
      const newUrl = customEvent.detail?.url || getActiveBackendUrl();
      setActiveUrl(newUrl);
      setIsCustom(isCustomBackendActive());
    }

    window.addEventListener(BACKEND_EVENT_NAME, handleBackendChange);
    return () => window.removeEventListener(BACKEND_EVENT_NAME, handleBackendChange);
  }, []);

  // Fetch preset server endpoints from database/API
  const fetchPresets = useCallback(async () => {
    setIsLoadingPresets(true);
    try {
      const res = await fetch("/api/server-endpoints", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.endpoints) && data.endpoints.length > 0) {
          setPresets(data.endpoints);
          return;
        }
      }
      setPresets(DEFAULT_SERVER_PRESETS);
    } catch {
      setPresets(DEFAULT_SERVER_PRESETS);
    } finally {
      setIsLoadingPresets(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  // Test connection to a candidate server
  const testUrl = useCallback(async (url: string): Promise<ServerConnectionResult> => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testServerConnection(url, 5000);
      setTestResult(result);
      return result;
    } finally {
      setIsTesting(false);
    }
  }, []);

  // Select a preset endpoint
  const selectPreset = useCallback((preset: ServerEndpoint) => {
    const res = setActiveBackendUrl(preset.url);
    if (res.success) {
      setActiveUrl(preset.url);
      setIsCustom(isCustomBackendActive());
      toast.success(`Connected server preset set to ${preset.name}`);
    } else {
      toast.error(res.error || "Failed to set server preset");
    }
  }, []);

  // Set a custom backend URL
  const setCustomUrl = useCallback((url: string): boolean => {
    const val = validateServerUrl(url);
    if (!val.valid) {
      toast.error(val.error || "Invalid server URL");
      return false;
    }

    const res = setActiveBackendUrl(val.normalizedUrl);
    if (res.success) {
      setActiveUrl(val.normalizedUrl);
      setIsCustom(isCustomBackendActive());
      toast.success("Active backend server updated");
      return true;
    } else {
      toast.error(res.error || "Failed to save server URL");
      return false;
    }
  }, []);

  // Reset to default window origin
  const resetToCurrentOrigin = useCallback(() => {
    resetActiveBackendUrl();
    setActiveUrl(window.location.origin);
    setIsCustom(false);
    setTestResult(null);
    toast.info("Backend server reset to current application host");
  }, []);

  // Switch and connect (either via PWA app host navigation or API preference)
  const switchAndConnect = useCallback(
    async (url: string, mode: "navigate" | "api" = "navigate"): Promise<boolean> => {
      const val = validateServerUrl(url);
      if (!val.valid) {
        toast.error(val.error || "Invalid server URL");
        return false;
      }

      // Pre-flight test
      const probe = await testUrl(val.normalizedUrl);
      if (!probe.ok) {
        toast.error(`Target server unreachable: ${probe.error}`);
        return false;
      }

      // Save preference
      setActiveBackendUrl(val.normalizedUrl);
      setActiveUrl(val.normalizedUrl);
      setIsCustom(isCustomBackendActive());

      toast.success(`Connected to ${probe.appName || val.normalizedUrl} (${probe.latencyMs}ms)`);

      if (mode === "navigate" && typeof window !== "undefined") {
        const targetOrigin = new URL(val.normalizedUrl).origin;
        if (targetOrigin !== window.location.origin) {
          // Transfer PWA context to target server host
          const path = window.location.pathname + window.location.search;
          window.location.href = `${targetOrigin}${path}`;
          return true;
        }
      }

      return true;
    },
    [testUrl]
  );

  return {
    activeUrl,
    isCustom,
    presets,
    isLoadingPresets,
    testResult,
    isTesting,
    testUrl,
    selectPreset,
    setCustomUrl,
    resetToCurrentOrigin,
    switchAndConnect,
    refreshPresets: fetchPresets,
  };
}
