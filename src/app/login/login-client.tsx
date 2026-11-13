"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Boxes, Lock, Mail, AlertCircle, Clock, Server } from "lucide-react";
import { useBackendServer } from "@/hooks/use-backend-server";
import { BackendServerSettingsModal } from "@/components/settings/backend-server-settings-modal";

export function LoginClient() {
  const router = useRouter();
  const { activeUrl, isCustom } = useBackendServer();
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Check if already logged in on mount
  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          router.push("/dashboard");
        }
      })
      .catch(() => {});
  }, [router]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;

    setError(null);
    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (result.error) {
        const nextFailures = failedAttempts + 1;
        setFailedAttempts(nextFailures);

        if (nextFailures >= 5) {
          setLockoutTimer(30);
          setError("Too many failed attempts. Account temporarily locked for 30 seconds.");
        } else {
          // OWASP: generic error message to prevent account enumeration
          setError("Invalid email or password. Please try again.");
        }
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      console.error("Sign in exception:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex p-3.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100 mb-4 transition-transform hover:scale-105">
            <Boxes className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Sign in to DPM
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium leading-relaxed">
            ዕለታዊ የምርት እና ጥራት አስተዳደር &bull; Daily Production &amp; Quality Operations
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8">
          {error && (
            <div className="alert alert-error mb-6 text-sm py-3 px-4 rounded-xl flex items-start gap-3 bg-red-50 text-red-700 border border-red-200 animate-in fade-in duration-150">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {lockoutTimer > 0 && (
            <div className="alert alert-warning mb-6 text-sm py-3 px-4 rounded-xl flex items-center gap-3 bg-amber-50 text-amber-800 border border-amber-200 animate-in fade-in duration-150">
              <Clock className="w-5 h-5 flex-shrink-0 text-amber-600 animate-spin" />
              <span className="leading-relaxed">Rate limited. Cooldown active: {lockoutTimer}s remaining.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  disabled={loading || lockoutTimer > 0}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="input input-bordered min-h-[44px] h-11 w-full pl-10 text-base sm:text-sm bg-slate-50/70 focus:bg-white rounded-xl focus:border-indigo-600 focus:outline-hidden transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={loading || lockoutTimer > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input input-bordered min-h-[44px] h-11 w-full pl-10 text-base sm:text-sm bg-slate-50/70 focus:bg-white rounded-xl focus:border-indigo-600 focus:outline-hidden transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || lockoutTimer > 0}
              className="btn btn-primary w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none text-white font-bold shadow-md shadow-indigo-100 mt-2 py-3 transition-all"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Server endpoint selector */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full ${isCustom ? "bg-indigo-500" : "bg-emerald-500"}`} />
              <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-mono text-[11px] text-slate-600">
                {activeUrl.replace(/^https?:\/\//, "")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setServerModalOpen(true)}
              className="btn btn-xs btn-ghost text-indigo-600 font-bold hover:bg-indigo-50 shrink-0"
            >
              Change Server
            </button>
          </div>

          {/* Security info */}
          <div className="mt-4 text-[11px] text-slate-400 text-center leading-relaxed">
            <p>Protected by Argon2id password hashing and brute-force lockout safeguards.</p>
          </div>
        </div>
      </div>

      <BackendServerSettingsModal
        isOpen={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        isAdmin={false}
      />
    </div>
  );
}
