"use client";

import { useState, useEffect } from "react";
import {
  Server,
  Globe,
  Wifi,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldCheck,
  Check,
  ExternalLink,
  RotateCcw,
  X,
  Radio,
} from "lucide-react";
import { useBackendServer } from "@/hooks/use-backend-server";
import {
  ServerEndpoint,
  validateServerUrl,
} from "@/lib/backend-config";
import { createServerEndpointAction } from "@/actions/server-endpoint-actions";
import { toast } from "sonner";

export interface BackendServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export function BackendServerSettingsModal({
  isOpen,
  onClose,
  isAdmin = false,
}: BackendServerSettingsModalProps) {
  const {
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
    refreshPresets,
  } = useBackendServer();

  const [selectedUrl, setSelectedUrl] = useState<string>(activeUrl);
  const [customInput, setCustomInput] = useState<string>("");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [switching, setSwitching] = useState<boolean>(false);

  // Admin inline add preset state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetUrl, setNewPresetUrl] = useState("http://");
  const [newPresetEnv, setNewPresetEnv] = useState<"lan" | "cloud" | "local" | "backup">("lan");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [newPresetDefault, setNewPresetDefault] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // Sync selected URL when modal opens or activeUrl changes
  useEffect(() => {
    setSelectedUrl(activeUrl);
    const matchesPreset = presets.some((p) => p.url === activeUrl);
    if (!matchesPreset && activeUrl) {
      setIsCustomMode(true);
      setCustomInput(activeUrl);
    } else {
      setIsCustomMode(false);
    }
  }, [activeUrl, presets, isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTestCandidate = async () => {
    const candidate = isCustomMode ? customInput : selectedUrl;
    if (!candidate.trim()) {
      toast.error("Please select a preset or type a server URL to test");
      return;
    }
    const val = validateServerUrl(candidate);
    if (!val.valid) {
      toast.error(val.error || "Invalid URL");
      return;
    }
    await testUrl(val.normalizedUrl);
  };

  const handleApplySwitch = async () => {
    const candidate = isCustomMode ? customInput : selectedUrl;
    const val = validateServerUrl(candidate);
    if (!val.valid) {
      toast.error(val.error || "Invalid URL");
      return;
    }

    try {
      setSwitching(true);
      const success = await switchAndConnect(val.normalizedUrl, "navigate");
      if (success) {
        onClose();
      }
    } finally {
      setSwitching(false);
    }
  };

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const val = validateServerUrl(newPresetUrl);
    if (!val.valid) {
      toast.error(val.error || "Invalid preset URL");
      return;
    }

    setIsSavingPreset(true);
    try {
      const res = await createServerEndpointAction({
        name: newPresetName.trim(),
        url: val.normalizedUrl,
        environment: newPresetEnv,
        description: newPresetDesc.trim() || null,
        isDefault: newPresetDefault,
        isActive: true,
      });

      if (res.success) {
        toast.success(`Server preset "${newPresetName}" created`);
        setShowAddForm(false);
        setNewPresetName("");
        setNewPresetUrl("http://");
        setNewPresetDesc("");
        setNewPresetDefault(false);
        await refreshPresets();
      } else {
        toast.error(res.error || "Failed to create server preset");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save preset");
    } finally {
      setIsSavingPreset(false);
    }
  };

  const envBadgeColor = {
    lan: "bg-teal-50 text-teal-700 border-teal-200",
    cloud: "bg-indigo-50 text-indigo-700 border-indigo-200",
    local: "bg-slate-100 text-slate-700 border-slate-200",
    backup: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="backend-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl z-10 overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="backend-settings-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight"
              >
                Backend Server & Network Settings
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                የሰርቨር ውቅሮች • Switch between Local Factory LAN & Internet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            aria-label="Close server settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Active Connection Banner */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Currently Active Server
                </span>
                {isCustom && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                    Custom Route
                  </span>
                )}
              </div>
              <div className="font-mono text-xs sm:text-sm font-bold text-slate-800 truncate">
                {activeUrl}
              </div>
            </div>

            {isCustom && (
              <button
                type="button"
                onClick={resetToCurrentOrigin}
                className="btn btn-xs btn-outline rounded-xl text-[11px] font-bold self-start sm:self-auto flex items-center gap-1.5"
                title="Reset to current browser origin"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Host</span>
              </button>
            )}
          </div>

          {/* Section: Server Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Official Server Presets (የተመዘገቡ ሰርቨሮች)
              </label>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddForm ? "Cancel Add" : "Add Preset"}</span>
                </button>
              )}
            </div>

            {/* Admin Inline Add Form */}
            {showAddForm && isAdmin && (
              <form
                onSubmit={handleCreatePreset}
                className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 space-y-3 animate-in fade-in duration-150"
              >
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Add New Shared Server Preset (Sys Admin)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Preset Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Workshop 02 LAN"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="input input-sm input-bordered w-full rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Environment Type
                    </label>
                    <select
                      value={newPresetEnv}
                      onChange={(e) =>
                        setNewPresetEnv(e.target.value as "lan" | "cloud" | "local" | "backup")
                      }
                      className="select select-sm select-bordered w-full rounded-xl text-xs"
                    >
                      <option value="lan">Factory LAN (Local Network)</option>
                      <option value="cloud">Internet Cloud (HQ)</option>
                      <option value="local">Local Developer / Gateway</option>
                      <option value="backup">Disaster Recovery / Backup</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Server URL (http:// or https://) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="http://192.168.1.150:3000"
                    value={newPresetUrl}
                    onChange={(e) => setNewPresetUrl(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dedicated manufacturing plant server"
                    value={newPresetDesc}
                    onChange={(e) => setNewPresetDesc(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="cursor-pointer label gap-2 py-0">
                    <input
                      type="checkbox"
                      checked={newPresetDefault}
                      onChange={(e) => setNewPresetDefault(e.target.checked)}
                      className="checkbox checkbox-xs checkbox-primary rounded"
                    />
                    <span className="label-text text-xs font-medium text-slate-600">
                      Set as primary default preset
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSavingPreset}
                    className="btn btn-sm btn-primary rounded-xl font-bold text-xs"
                  >
                    {isSavingPreset ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      "Save Preset"
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Preset Cards List */}
            <div className="space-y-2">
              {presets.map((preset) => {
                const isSelected = !isCustomMode && selectedUrl === preset.url;
                const isCurrent = activeUrl === preset.url;

                return (
                  <div
                    key={preset.id}
                    onClick={() => {
                      setIsCustomMode(false);
                      setSelectedUrl(preset.url);
                    }}
                    className={`cursor-pointer rounded-2xl p-3.5 border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {preset.name}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                              envBadgeColor[preset.environment] || envBadgeColor.lan
                            }`}
                          >
                            {preset.environment}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500 truncate mt-0.5">
                          {preset.url}
                        </div>
                        {preset.description && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {preset.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Custom URL Card Option */}
              <div
                onClick={() => setIsCustomMode(true)}
                className={`cursor-pointer rounded-2xl p-3.5 border transition-all flex items-center justify-between gap-3 ${
                  isCustomMode
                    ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isCustomMode
                        ? "border-indigo-600 bg-indigo-600"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isCustomMode && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-slate-900 block">
                      Custom Server Address (ልዩ ሰርቨር አድራሻ)
                    </span>
                    <span className="text-xs text-slate-400">
                      Enter a custom IP address or domain for your plant
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Custom URL Input (shown when isCustomMode is active) */}
          {isCustomMode && (
            <div className="space-y-2 bg-slate-50 rounded-2xl p-4 border border-slate-200 animate-in fade-in duration-150">
              <label className="text-xs font-bold text-slate-700 block">
                Target Backend Server URL *
              </label>

              {/* Protocol quick toggles */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    const withoutScheme = customInput.replace(/^https?:\/\//, "");
                    setCustomInput(`http://${withoutScheme}`);
                  }}
                  className={`btn btn-xs rounded-lg font-mono font-bold ${
                    customInput.startsWith("http://") ? "btn-neutral" : "btn-outline"
                  }`}
                >
                  http:// (LAN IP)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const withoutScheme = customInput.replace(/^https?:\/\//, "");
                    setCustomInput(`https://${withoutScheme}`);
                  }}
                  className={`btn btn-xs rounded-lg font-mono font-bold ${
                    customInput.startsWith("https://") ? "btn-neutral" : "btn-outline"
                  }`}
                >
                  https:// (Cloud)
                </button>
              </div>

              <input
                type="text"
                placeholder="http://192.168.1.50:3000 or https://dpm.factory.et"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="input input-bordered w-full rounded-xl text-xs sm:text-sm font-mono"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tip: When at the manufacturing plant, enter the internal IP (e.g.
                http://192.168.1.100:3000). When outside or mobile, use the HTTPS internet address.
              </p>
            </div>
          )}

          {/* Section: Connectivity Diagnostic Panel */}
          {testResult && (
            <div
              className={`rounded-2xl p-4 border animate-in fade-in duration-200 ${
                testResult.ok
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                  : "bg-rose-50/80 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs sm:text-sm flex items-center justify-between gap-2 flex-wrap">
                    <span>
                      {testResult.ok ? "Connection Successful (ግንኙነት ተሳክቷል)" : "Connection Failed"}
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-white/80 border font-extrabold">
                      {testResult.latencyMs}ms latency
                    </span>
                  </div>

                  {testResult.ok ? (
                    <div className="mt-1 text-xs space-y-0.5 text-emerald-800">
                      <div>
                        Target App: <span className="font-semibold">{testResult.appName}</span>
                      </div>
                      <div>
                        App Version:{" "}
                        <span className="font-mono font-bold">v{testResult.version}</span>
                        {testResult.gitCommit && (
                          <span className="ml-1 text-emerald-600">({testResult.gitCommit})</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-rose-700 leading-relaxed">
                      {testResult.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestCandidate}
            disabled={isTesting || switching}
            className="w-full sm:w-auto btn btn-outline btn-neutral rounded-2xl font-bold text-xs flex items-center justify-center gap-2 py-2.5"
          >
            {isTesting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <Wifi className="w-4 h-4 text-slate-600" />
            )}
            <span>{isTesting ? "Testing Connection..." : "Test Connection"}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={switching}
              className="w-full sm:w-auto btn btn-ghost rounded-2xl font-bold text-xs py-2.5 text-slate-600"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplySwitch}
              disabled={switching || isTesting}
              className="w-full sm:w-auto btn btn-primary rounded-2xl font-extrabold text-xs shadow-md shadow-indigo-100 flex items-center justify-center gap-2 py-2.5"
            >
              {switching ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>Switch & Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
