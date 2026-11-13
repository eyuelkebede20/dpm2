"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  X,
  Smartphone,
  Laptop,
  Apple,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Share,
  MoreVertical,
  PlusSquare,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { usePwaOtaContext } from "./pwa-ota-manager";
import { Button } from "@/components/ui/button";

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlatformTab = "android" | "ios" | "desktop";

export function PwaInstallModal({ isOpen, onClose }: PwaInstallModalProps) {
  const pwa = usePwaOtaContext();
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<PlatformTab>("desktop");
  const [isInstalling, setIsInstalling] = useState(false);

  // Detect standalone mode and auto-detect platform
  useEffect(() => {
    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as any).standalone);
      setIsStandalone(Boolean(standalone));

      const ua = navigator.userAgent || "";
      if (/android/i.test(ua)) {
        setActiveTab("android");
      } else if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
        setActiveTab("ios");
      } else {
        setActiveTab("desktop");
      }
    }
  }, []);

  // Keyboard navigation: Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 1-Click Native Install Trigger
  const handleNativeInstall = async () => {
    if (isStandalone) {
      toast.success("DPM is already installed and running as a standalone app! (አፕሊኬሽኑ አስቀድሞ ተጭኗል)");
      return;
    }

    if (pwa.isInstallable) {
      setIsInstalling(true);
      try {
        const accepted = await pwa.promptInstall();
        if (accepted) {
          toast.success("DPM application installation started! (አፕሊኬሽኑ ተጭኗል)");
          onClose();
        } else {
          toast.info("Installation dismissed. You can install anytime from this menu.");
        }
      } catch (err) {
        console.warn("Installation prompt error:", err);
        toast.error("Could not trigger native prompt. Follow the browser instructions below.");
      } finally {
        setIsInstalling(false);
      }
    } else {
      toast.info("Browser prompt not ready. Follow the step-by-step instructions below.");
    }
  };

  // Download Desktop Shortcut (.url file)
  const handleDownloadShortcut = () => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const shortcutContent = `[InternetShortcut]\r\nURL=${origin}/\r\nIconFile=${origin}/icons/icon-192.png\r\nIconIndex=0\r\nHotKey=0\r\nIDList=\r\n[{000214A0-0000-0000-C000-000000000046}]\r\nProp3=19,0\r\n`;
      const blob = new Blob([shortcutContent], { type: "application/internet-shortcut" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "DPM-Homicho.url";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Desktop shortcut downloaded! Double-click to launch DPM directly.");
    } catch {
      toast.error("Failed to generate desktop shortcut.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 id="pwa-install-title" className="text-base font-black text-slate-900 leading-tight">
                Download & Install DPM App
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Homicho Ammunition Engineering Industry • HAEI DPM
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors focus:outline-hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Status Banner */}
          {isStandalone ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>DPM is already installed and running as a standalone application on this device.</span>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  Fast, Offline-Ready Application
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Install DPM to your home screen or desktop to work with zero address-bar clutter, lightning-fast caching, and offline access.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Primary Install Button */}
            <Button
              type="button"
              variant="primary"
              data-testid="pwa-primary-install-button"
              onClick={handleNativeInstall}
              loading={isInstalling}
              disabled={isStandalone}
              className={`w-full h-11 rounded-xl font-bold text-xs shadow-md justify-center gap-2 ${
                pwa.isInstallable
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{pwa.isInstallable ? "Install App (1-Click)" : "Install App"}</span>
            </Button>

            {/* Download Shortcut Button */}
            <Button
              type="button"
              variant="outline"
              data-testid="pwa-download-shortcut-button"
              onClick={handleDownloadShortcut}
              className="w-full h-11 rounded-xl font-bold text-xs border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 justify-center gap-2"
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>Download Shortcut (.url)</span>
            </Button>
          </div>

          {/* Device Specific Guides Section */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Installation Instructions by Device (የመጫኛ መመሪያ)
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                Step-by-step
              </span>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("desktop")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "desktop"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Desktop (PC/Mac)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("android")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "android"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ios")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "ios"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
            </div>

            {/* Tab 1: Desktop (Chrome / Edge) */}
            {activeTab === "desktop" && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs text-slate-700 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    In <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>, look at the right side of the address bar.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    Click the <strong>Install icon (⊕ / ⤓)</strong> inside the URL bar, or open the browser menu (⋮) and select <strong>&quot;Install DPM&quot;</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    Click <strong>Install</strong>. DPM will open in a standalone desktop window with a dedicated taskbar icon.
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                  💡 <em>Alternative:</em> Click <strong>&quot;Download Shortcut (.url)&quot;</strong> above to get an instant desktop launcher file.
                </div>
              </div>
            )}

            {/* Tab 2: Android (Chrome / Edge) */}
            {activeTab === "android" && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs text-slate-700 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Open in <strong>Chrome</strong> and tap the</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200 font-mono text-[10px] font-bold text-slate-800">
                      <MoreVertical className="w-3 h-3" /> Menu (⋮)
                    </span>
                    <span>icon at top-right.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    Tap <strong>Install</strong>. The HAEI DPM app icon will appear directly on your home screen and app drawer.
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: iOS (Safari) */}
            {activeTab === "ios" && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs text-slate-700 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Open in <strong>Safari</strong> and tap the</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 font-mono text-[10px] font-bold text-slate-800">
                      <Share className="w-3 h-3" /> Share
                    </span>
                    <span>button at the bottom toolbar.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Scroll down and select</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 font-mono text-[10px] font-bold text-slate-800">
                      <PlusSquare className="w-3 h-3" /> Add to Home Screen
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    Tap <strong>Add</strong> at top-right. DPM will run full-screen as a native iOS app.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted & Offline Capable</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs h-8 px-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200"
          >
            <span>Close</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
