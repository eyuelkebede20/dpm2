"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/actions/auth-actions";
import { Lock, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";

export function ChangePasswordClient() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 12) {
      setError("Password must be at least 12 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await changePasswordAction({
        newPassword,
        confirmPassword,
      });

      if (!result.success) {
        setError(result.error || "Failed to change password.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  const isLengthValid = newPassword.length >= 12;
  const hasMixedChars =
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /[0-9!@#$%^&*]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-100 mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Set Permanent Password
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Please choose a strong password (minimum 12 characters).
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {error && (
            <div className="alert alert-error mb-6 text-sm py-3 px-4 rounded-xl flex items-start gap-3 bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success mb-6 text-sm py-3 px-4 rounded-xl flex items-center gap-3 bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span>Password updated successfully! Redirecting to dashboard...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  disabled={loading || success}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  className="input input-bordered w-full pl-10 text-sm bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600"
                />
              </div>

              {/* Password strength hints */}
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isLengthValid ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  <span className={isLengthValid ? "text-emerald-700" : "text-slate-500"}>
                    At least 12 characters ({newPassword.length}/12)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasMixedChars ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  <span className={hasMixedChars ? "text-emerald-700" : "text-slate-500"}>
                    Uppercase, lowercase & numbers/symbols
                  </span>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        passwordsMatch ? "bg-emerald-500" : "bg-rose-400"
                      }`}
                    />
                    <span className={passwordsMatch ? "text-emerald-700 font-semibold" : "text-rose-600"}>
                      {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  disabled={loading || success}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="input input-bordered w-full pl-10 text-sm bg-slate-50 focus:bg-white rounded-xl focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || success || !isLengthValid}
              className="btn btn-primary w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none text-white font-medium shadow-md shadow-indigo-100 mt-2"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                "Update Password & Continue"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
