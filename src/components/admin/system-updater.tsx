"use client";

import { useEffect, useRef, useState } from "react";
import { triggerSystemUpdateAction } from "@/actions/admin-actions";
import {
  DownloadCloud,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Terminal,
  Server,
  ShieldAlert,
} from "lucide-react";

export type UpdaterPhase =
  | "idle"
  | "requesting"   // writing flag file
  | "running"      // update script running — poll /api/update-status
  | "restarting"   // container restarting — poll /api/health
  | "done"
  | "failed";

export interface SystemUpdaterProps {
  statusPollMs?: number;
  healthPollMs?: number;
  initialRestartDelayMs?: number;
}

const DEFAULT_STATUS_POLL_MS = 2_000;
const DEFAULT_HEALTH_POLL_MS = 4_000;
const DEFAULT_INITIAL_RESTART_DELAY_MS = 6_000;
const TOTAL_TIMEOUT_MS = 10 * 60_000; // 10 minutes

export function SystemUpdater({
  statusPollMs = DEFAULT_STATUS_POLL_MS,
  healthPollMs = DEFAULT_HEALTH_POLL_MS,
  initialRestartDelayMs = DEFAULT_INITIAL_RESTART_DELAY_MS,
}: SystemUpdaterProps = {}) {
  const [phase, setPhase] = useState<UpdaterPhase>("idle");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);

  // Auto-scroll the log terminal
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  // Clean up polling loops on unmount
  useEffect(() => {
    return () => {
      stopRef.current = true;
    };
  }, []);

  const appendLog = (line: string) => {
    setLogLines((prev) => [...prev, line]);
  };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const startUpdateProcess = async () => {
    setConfirmOpen(false);
    stopRef.current = false;
    setLogLines([]);
    setPhase("requesting");

    // 1. Write the update flag file via server action
    try {
      const res = await triggerSystemUpdateAction();
      if (!res?.success) {
        appendLog(`✗ ${res?.message || "Could not trigger update."}`);
        setPhase("failed");
        return;
      }
      appendLog("✓ Update request dispatched — waiting for host updater daemon...");
    } catch (err: any) {
      appendLog(`✗ ${err.message || "Failed to trigger system update."}`);
      setPhase("failed");
      return;
    }

    // 2. Poll /api/update-status while script runs
    setPhase("running");
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;
    let seenLines = 0;
    let scriptDone = false;
    let scriptFailed = false;
    let waitingCycles = 0;

    while (!stopRef.current && Date.now() < deadline) {
      await sleep(statusPollMs);
      try {
        const r = await fetch("/api/update-status", { cache: "no-store" });
        if (r.ok) {
          const data: { lines: string[]; done: boolean; failed: boolean } = await r.json();
          const newLines = data.lines.slice(seenLines);
          if (newLines.length > 0) {
            setLogLines((prev) => [...prev, ...newLines]);
            seenLines = data.lines.length;
          }

          // Detect if waiting on initial daemon pickup
          const isOnlyWaiting =
            data.lines.length <= 2 &&
            data.lines.some((l) => l.includes("Waiting for host"));

          if (isOnlyWaiting) {
            waitingCycles++;
            if (waitingCycles >= 12) {
              appendLog("");
              appendLog("⚠️ The host watcher daemon did not pick up the update request within 24s.");
              appendLog("   Troubleshooting options:");
              appendLog("   1. On Linux Server (Docker): Ensure the watcher daemon is active:");
              appendLog("      sudo ./deploy/install-watcher.sh");
              appendLog("      (Or run manual update on host: ./update.sh)");
              appendLog("   2. On Windows: Run UPDATE.bat directly or deploy\\install-watcher.bat");
              setPhase("failed");
              return;
            }
          } else {
            waitingCycles = 0;
          }

          if (data.done) {
            scriptDone = true;
            scriptFailed = data.failed;
            break;
          }
        }
      } catch {
        // API might briefly be unreachable when container restarts
      }
    }

    if (scriptFailed) {
      appendLog("✗ Update failed or rolled back to previous commit. See log details above.");
      setPhase("failed");
      return;
    }

    // 3. Restart phase: poll /api/health until app returns 200
    setPhase("restarting");
    appendLog("--- Container/App is restarting. Waiting for health check to pass ---");

    // Brief initial delay to give docker container time to recycle
    await sleep(initialRestartDelayMs);

    while (!stopRef.current && Date.now() < deadline) {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (r.ok) {
          appendLog("✅ App is back online and fully healthy.");
          setPhase("done");
          return;
        }
      } catch {
        // App is still coming up
      }
      await sleep(healthPollMs);
    }

    if (!scriptDone) {
      appendLog("✗ Timed out waiting for update script to finish. Check server compose logs.");
    } else {
      appendLog("✗ Application did not report healthy in time. Run 'docker compose logs app' on host.");
    }
    setPhase("failed");
  };

  const isRunning = phase === "requesting" || phase === "running" || phase === "restarting";

  const phaseLabel: Record<UpdaterPhase, string> = {
    idle: "Pull Latest Updates & Rebuild",
    requesting: "Dispatching request...",
    running: "Running update & migrations...",
    restarting: "Restarting app container...",
    done: "Check for New Updates",
    failed: "Retry Update",
  };

  const statusSubtext: Record<UpdaterPhase, string> = {
    idle: "",
    requesting: "Writing update flag to ./run/updater...",
    running: "Backing up DB → pulling git changes → running migrations → rebuilding",
    restarting: "Polling health endpoint (/api/health) until service is active...",
    done: "",
    failed: "",
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <DownloadCloud className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>System Update & Self-Healing Deployment</span>
              <span className="text-xs sm:text-sm font-normal text-slate-500 leading-normal">
                (የሲስተም ማዘመኛ እና ራስ-አዳሽ ዝመና)
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-0.5">
              Pull latest commits from GitHub repository, apply database migrations, and perform zero-downtime container reload.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-sm font-mono text-[11px] bg-slate-100 text-slate-700 font-semibold px-3 py-2 rounded-xl">
            Auto-Rollback Protected
          </span>
        </div>
      </div>

      {/* Info Notice Box */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Server className="w-4 h-4 text-slate-700" />
          <span>Automated Host-Container Pipeline:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
          <li>Creates an automated safety database backup before applying changes.</li>
          <li>Fetches latest commits from remote git repository (<code className="font-mono text-indigo-700">eyuelkebede20/dpm2</code>).</li>
          <li>Runs pending schema migrations (<code className="font-mono text-indigo-700">node scripts/migrate.mjs</code>).</li>
          <li>Rebuilds standalone Next.js container and switches traffic only after passing <code className="font-mono text-indigo-700">/api/health</code> checks.</li>
          <li>Automatically rolls back to the previous stable commit if build or migration fails.</li>
        </ul>
      </div>

      {/* Live Log Terminal Output */}
      {logLines.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col shadow-inner">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-mono">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span>Live Update Terminal — Output Stream</span>
            </div>
            {isRunning && (
              <div className="flex items-center gap-1.5 text-blue-400 font-mono text-[11px]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </div>
            )}
          </div>
          <div
            ref={logRef}
            data-testid="update-terminal-log"
            className="p-4 text-xs font-mono text-slate-300 max-h-64 overflow-y-auto space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-700"
          >
            {logLines.map((line, idx) => {
              const isSuccess = line.includes("✅") || line.includes("✓") || line.toLowerCase().includes("complete");
              const isError = line.includes("✗") || line.includes("!!") || line.toLowerCase().includes("failed") || line.includes("rollback");
              const isWarning = line.includes("⚠️") || line.includes("Troubleshooting");
              const isDivider = line.startsWith("---") || line.startsWith("===");

              let lineClass = "text-slate-300";
              if (isSuccess) lineClass = "text-emerald-400 font-medium";
              else if (isError) lineClass = "text-rose-400 font-medium";
              else if (isWarning) lineClass = "text-amber-300 font-semibold";
              else if (isDivider) lineClass = "text-slate-500 italic";

              return (
                <div key={idx} className={`leading-relaxed break-all ${lineClass}`}>
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pulsing subtext during execution */}
      {isRunning && statusSubtext[phase] && (
        <div className="text-center text-xs font-medium text-blue-600 animate-pulse py-1">
          {statusSubtext[phase]}
        </div>
      )}

      {/* Done Banner */}
      {phase === "done" && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 text-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <div className="font-bold">Update Complete Successfully!</div>
            <div className="text-xs text-emerald-700 mt-0.5">
              The application has been upgraded to the latest version and all health checks are passing.
            </div>
          </div>
        </div>
      )}

      {/* Failed Banner */}
      {phase === "failed" && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-sm"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <div className="font-bold">Update Interrupted or Failed</div>
            <div className="text-xs text-rose-700 mt-0.5">
              Review the terminal log above. The system automatically maintains stability on the previous working version.
            </div>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isRunning}
          aria-busy={isRunning}
          className="btn btn-primary w-full sm:w-auto px-6 min-h-[48px] rounded-2xl bg-blue-600 hover:bg-blue-700 border-none text-white font-bold shadow-md shadow-blue-100 flex items-center justify-center gap-2.5 transition-all touch-manipulation disabled:bg-slate-300 disabled:text-slate-500"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{phaseLabel[phase]}</span>
            </>
          ) : (
            <>
              <DownloadCloud className="w-5 h-5" />
              <span>{phaseLabel[phase]}</span>
            </>
          )}
        </button>

        {isRunning && (
          <span className="text-xs text-slate-500 font-medium">
            Please keep this tab open until the health check confirms the app is back online.
          </span>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Confirm System Update
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Are you sure you want to pull the latest code and rebuild?
            </p>
            <ul className="text-xs text-slate-500 list-disc list-inside space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <li>The update script will run on the host server.</li>
              <li>Database migrations will be executed automatically.</li>
              <li>The container will restart for ~1-2 minutes during the switchover.</li>
            </ul>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="btn btn-ghost min-h-[44px] rounded-xl text-xs font-semibold px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startUpdateProcess}
                className="btn btn-primary min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 border-none shadow-xs"
              >
                Start Update Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
