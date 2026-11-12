"use client";

import React, { createContext, useContext } from "react";
import { usePwaOta, PwaOtaState } from "@/hooks/use-pwa-ota";
import { CURRENT_APP_VERSION, GITHUB_URL, CURRENT_GIT_COMMIT } from "@/lib/version";
import { PwaOtaBanner } from "./pwa-ota-banner";

const defaultPwaState: PwaOtaState = {
  isSupported: false,
  isOnline: true,
  isUpdateAvailable: false,
  isChecking: false,
  isUpdating: false,
  isInstallable: false,
  currentVersion: CURRENT_APP_VERSION,
  newVersion: null,
  releaseNotes: null,
  gitCommit: CURRENT_GIT_COMMIT,
  githubUrl: GITHUB_URL,
  checkForUpdate: async () => false,
  applyUpdate: () => {},
  promptInstall: async () => false,
  dismissUpdate: () => {},
};

const PwaOtaContext = createContext<PwaOtaState>(defaultPwaState);

export function usePwaOtaContext(): PwaOtaState {
  return useContext(PwaOtaContext);
}

export function PwaOtaManager({ children }: { children?: React.ReactNode }) {
  const pwaState = usePwaOta();

  return (
    <PwaOtaContext.Provider value={pwaState}>
      {children}
      <PwaOtaBanner
        isOnline={pwaState.isOnline}
        isUpdateAvailable={pwaState.isUpdateAvailable}
        isUpdating={pwaState.isUpdating}
        currentVersion={pwaState.currentVersion}
        newVersion={pwaState.newVersion}
        releaseNotes={pwaState.releaseNotes}
        gitCommit={pwaState.gitCommit}
        githubUrl={pwaState.githubUrl}
        onApplyUpdate={pwaState.applyUpdate}
        onDismissUpdate={pwaState.dismissUpdate}
        isInstallable={pwaState.isInstallable}
        onPromptInstall={pwaState.promptInstall}
      />
    </PwaOtaContext.Provider>
  );
}
