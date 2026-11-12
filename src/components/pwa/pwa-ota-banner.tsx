"use client";

import React from "react";
import {
  Sparkles,
  WifiOff,
  Download,
  X,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PwaOtaBannerProps {
  isOnline: boolean;
  isUpdateAvailable: boolean;
  isUpdating: boolean;
  currentVersion: string;
  newVersion?: string | null;
  releaseNotes?: string | null;
  gitCommit?: string | null;
  githubUrl?: string | null;
  onApplyUpdate: () => void;
  onDismissUpdate: () => void;
  isInstallable?: boolean;
  onPromptInstall?: () => void;
}

export function PwaOtaBanner({
  isOnline,
  isUpdateAvailable,
  isUpdating,
  currentVersion,
  newVersion,
  releaseNotes,
  gitCommit,
  githubUrl,
  onApplyUpdate,
  onDismissUpdate,
  isInstallable = false,
  onPromptInstall,
}: PwaOtaBannerProps) {
  // If online, no update, and not installable, render nothing
  if (isOnline && !isUpdateAvailable && !isInstallable) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-md z-50 flex flex-col gap-2 pointer-events-none">
      {/* 1. Offline Mode Indicator */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto bg-amber-950/95 text-amber-200 border border-amber-600/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Offline Mode • ከመስመር ውጭ
            </div>
            <div className="text-[11px] text-amber-300/90 leading-tight truncate">
              Local cached production views are active.
            </div>
          </div>
        </div>
      )}

      {/* 2. Over-The-Air (OTA) Update Banner */}
      {isUpdateAvailable && (
        <aside
          role="alert"
          aria-live="assertive"
          className="pointer-events-auto bg-slate-900/95 text-white border border-indigo-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse text-indigo-300" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 tracking-wider">
                  OTA Update Ready
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  v{currentVersion} → v{newVersion || "1.0.2"}
                </span>
              </div>

              <h2 className="mt-1 font-bold text-sm text-slate-100 tracking-tight">
                New Platform Version Available
              </h2>

              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                {releaseNotes ||
                  "A new over-the-air build has been downloaded. Reload to apply improvements."}
              </p>

              {/* GitHub Link if available */}
              {githubUrl && (
                <div className="mt-1.5">
                  <a
                    href={gitCommit ? `${githubUrl}/commit/${gitCommit}` : githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-300 hover:text-indigo-200 underline decoration-indigo-400/50 underline-offset-2 transition-colors"
                  >
                    <GitBranch className="w-3 h-3" />
                    <span>
                      GitHub: {gitCommit ? gitCommit.slice(0, 7) : "Repository"} ↗
                    </span>
                  </a>
                </div>
              )}

              {/* Actions */}
              <div className="mt-3.5 flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={onApplyUpdate}
                  loading={isUpdating}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
                  <span>Update Now / አዘምን</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDismissUpdate}
                  disabled={isUpdating}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs h-9 px-3 rounded-xl"
                >
                  <span>Later</span>
                </Button>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onDismissUpdate}
              aria-label="Dismiss update notification"
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800 focus:outline-hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* 3. PWA Install Prompt Banner (if installable and not updating) */}
      {!isUpdateAvailable && isInstallable && onPromptInstall && (
        <aside
          role="region"
          aria-label="Install Application"
          className="pointer-events-auto bg-white/95 text-slate-900 border border-slate-200 rounded-3xl p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Download className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900">
                Install DPM App
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Install on your device for one-tap home screen access.
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onPromptInstall}
              className="text-xs h-8 px-3 rounded-xl font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <span>Install</span>
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}
