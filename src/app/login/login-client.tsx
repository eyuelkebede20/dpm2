"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Boxes, Lock, Mail, AlertCircle, Clock } from "lucide-react";

export function LoginClient() {
  const router = useRouter();
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
          if (data.user.mustChangePassword) {
            router.push("/change-password");
          } else {
            router.push("/dashboard");
          }
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

      // Check user password status
      const statusRes = await fetch("/api/auth/status");
      const statusData = await statusRes.json();

      if (statusData.authenticated && statusData.user?.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch (err: any) {
      console.error("Sign in exception:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100 mb-4">
            <Boxes className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to DPM
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Daily Production & Quality Operations
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {error && (
            <div className="alert alert-error mb-6 text-sm py-3 px-4 rounded-xl flex items-start gap-3 bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {lockoutTimer > 0 && (
            <div className="alert alert-warning mb-6 text-sm py-3 px-4 rounded-xl flex items-center gap-3 bg-amber-50 text-amber-800 border border-amber-200">
              <Clock className="w-5 h-5 flex-shrink-0 text-amber-600 animate-spin" />
              <span>Rate limited. Cooldown active: {lockoutTimer}s remaining.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  disabled={loading || lockoutTimer > 0}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="input input-bordered w-full pl-10 text-sm bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  disabled={loading || lockoutTimer > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input input-bordered w-full pl-10 text-sm bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || lockoutTimer > 0}
              className="btn btn-primary w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none text-white font-medium shadow-md shadow-indigo-100 mt-2"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* 1-Click Quick-Fill Demo Bar */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
              Quick demo credentials
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@factory.et");
                  setPassword("AdminSecret123!");
                }}
                className="btn btn-xs btn-outline rounded-lg text-[11px] font-bold hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
              >
                🔴 Sys Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("om@factory.et");
                  setPassword("OmPassword123!");
                }}
                className="btn btn-xs btn-outline rounded-lg text-[11px] font-bold hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300"
              >
                🔵 Operation Mgr
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("fm@factory.et");
                  setPassword("FmPassword123!");
                }}
                className="btn btn-xs btn-outline rounded-lg text-[11px] font-bold hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
              >
                🟢 Factory Mgr
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("qa@factory.et");
                  setPassword("QaPassword123!");
                }}
                className="btn btn-xs btn-outline rounded-lg text-[11px] font-bold hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
              >
                🟡 QA Inspector
              </button>
            </div>
          </div>

          {/* Security info */}
          <div className="mt-5 text-[11px] text-slate-400 text-center">
            <p>Protected by argon2id hashing and strict rate limiting.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
