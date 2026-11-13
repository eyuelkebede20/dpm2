"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CURRENT_APP_VERSION } from "@/lib/version";

export interface PwaOtaState {
  isSupported: boolean;
  isOnline: boolean;
  isUpdateAvailable: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  isInstallable: boolean;
  currentVersion: string;
  newVersion: string | null;
  releaseNotes: string | null;
  gitCommit: string | null;
  githubUrl: string | null;
  checkForUpdate: () => Promise<boolean>;
  applyUpdate: () => void;
  promptInstall: () => Promise<boolean>;
  dismissUpdate: () => void;
}

export function usePwaOta(): PwaOtaState {
  const [isSupported, setIsSupported] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(CURRENT_APP_VERSION);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [gitCommit, setGitCommit] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState<string | null>(null);

  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const deferredPromptRef = useRef<any>(null);

  // 1. Initial Service Worker Registration & Online Status Setup
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Capture PWA Install Prompt (from early inline script or window event)
    const syncCapturedPrompt = () => {
      const earlyPrompt = (window as any).__pwaInstallPrompt;
      if (earlyPrompt) {
        deferredPromptRef.current = earlyPrompt;
        setIsInstallable(true);
      }
    };
    syncCapturedPrompt();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      (window as any).__pwaInstallPrompt = e;
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("pwa-prompt-captured", syncCapturedPrompt);

    // Check Service Worker Support
    if ("serviceWorker" in navigator) {
      setIsSupported(true);

      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registrationRef.current = reg;

          // Check if a worker is already waiting in background
          if (reg.waiting) {
            waitingWorkerRef.current = reg.waiting;
            setIsUpdateAvailable(true);
          }

          // Listen for new worker installation
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              // If new worker reached 'installed' state and there is already an active controller,
              // it means an Over-The-Air (OTA) update is ready to be applied!
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                waitingWorkerRef.current = newWorker;
                setIsUpdateAvailable(true);
              }
            });
          });
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });

      // Listen for controllerchange: when the new SW activates, reload the window!
      let refreshing = false;
      const handleControllerChange = () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange
      );

      // Listen for messages from SW (e.g. activation notification)
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "SW_ACTIVATED") {
          setCurrentVersion(event.data.version || CURRENT_APP_VERSION);
        }
      };
      navigator.serviceWorker.addEventListener("message", handleMessage);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt
        );
        window.removeEventListener("pwa-prompt-captured", syncCapturedPrompt);
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange
        );
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      };
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("pwa-prompt-captured", syncCapturedPrompt);
    };
  }, []);

  // 2. Manual / Periodic Check for OTA Updates
  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    let updateFound = false;

    try {
      // A. Check version endpoint with cache-busting timestamp
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: "no-store",
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.version) {
          if (data.releaseNotes) {
            setReleaseNotes(data.releaseNotes);
          }
          if (data.gitCommit) {
            setGitCommit(data.gitCommit);
          }
          if (data.githubUrl) {
            setGithubUrl(data.githubUrl);
          }

          if (data.version !== currentVersion) {
            setNewVersion(data.version);
            setIsUpdateAvailable(true);
            updateFound = true;
          }
        }
      }

      // B. Trigger service worker update check if supported
      if (registrationRef.current) {
        await registrationRef.current.update();
        if (registrationRef.current.waiting) {
          waitingWorkerRef.current = registrationRef.current.waiting;
          setIsUpdateAvailable(true);
          updateFound = true;
        }
      }

      return updateFound;
    } catch (err) {
      console.warn("[PWA] Update check failed:", err);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [currentVersion]);

  // 3. Apply OTA Update (Skip waiting & reload)
  const applyUpdate = useCallback(() => {
    setIsUpdating(true);

    if (waitingWorkerRef.current) {
      // Send signal to service worker to skip waiting
      waitingWorkerRef.current.postMessage({ type: "SKIP_WAITING" });
    } else if (registrationRef.current?.installing) {
      registrationRef.current.installing.postMessage({ type: "SKIP_WAITING" });
    } else if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } else {
      // Direct window reload fallback
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }
  }, []);

  // 4. Prompt PWA Installation
  const promptInstall = useCallback(async (): Promise<boolean> => {
    const prompt =
      deferredPromptRef.current ||
      (typeof window !== "undefined" ? (window as any).__pwaInstallPrompt : null);
    if (!prompt) return false;
    try {
      prompt.prompt();
      const choiceResult = await prompt.userChoice;
      deferredPromptRef.current = null;
      if (typeof window !== "undefined") {
        (window as any).__pwaInstallPrompt = null;
      }
      setIsInstallable(false);
      return choiceResult?.outcome === "accepted";
    } catch (err) {
      console.warn("[PWA] promptInstall execution error:", err);
      return false;
    }
  }, []);

  // 5. Dismiss Update Banner for session
  const dismissUpdate = useCallback(() => {
    setIsUpdateAvailable(false);
  }, []);

  return {
    isSupported,
    isOnline,
    isUpdateAvailable,
    isChecking,
    isUpdating,
    isInstallable,
    currentVersion,
    newVersion,
    releaseNotes,
    gitCommit,
    githubUrl,
    checkForUpdate,
    applyUpdate,
    promptInstall,
    dismissUpdate,
  };
}
