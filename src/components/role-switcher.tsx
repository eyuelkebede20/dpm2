"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Shield,
  Building2,
  Boxes,
  ClipboardCheck,
  ChevronUp,
  Check,
  RefreshCw,
  Sparkles,
  UserCheck,
  LogOut,
  Users,
  Compass,
  ArrowRight,
  Search,
  ChevronDown,
} from "lucide-react";

interface RoleOption {
  role: "sys_admin" | "om" | "fm" | "qa";
  label: string;
  amharicLabel: string;
  defaultName: string;
  defaultEmail: string;
  description: string;
  primaryPath: string;
  badgeClass: string;
  icon: React.ElementType;
}

const PRIMARY_ROLES: RoleOption[] = [
  {
    role: "sys_admin",
    label: "Sys Admin",
    amharicLabel: "የስርዓት አስተዳዳሪ",
    defaultName: "System Administrator",
    defaultEmail: "admin@dpm.local",
    description: "Industry Profile & Operation Managers",
    primaryPath: "/admin",
    badgeClass: "badge-error text-white font-bold",
    icon: Shield,
  },
  {
    role: "om",
    label: "Operation Mgr",
    amharicLabel: "ኦፕሬሽን ስራ አስኪያጅ",
    defaultName: "Solomon Tadesse (OM)",
    defaultEmail: "om@dpm.local",
    description: "Factories, Staffing & QA Assignments",
    primaryPath: "/om",
    badgeClass: "badge-primary text-white font-bold",
    icon: Building2,
  },
  {
    role: "fm",
    label: "Factory Mgr",
    amharicLabel: "ፋብሪካ ስራ አስኪያጅ",
    defaultName: "Abebe Kebede (FM)",
    defaultEmail: "fm@dpm.local",
    description: "Lines, Plans, Daily Grid & Store Stock",
    primaryPath: "/entry",
    badgeClass: "badge-secondary text-white font-bold",
    icon: Boxes,
  },
  {
    role: "qa",
    label: "QA Inspector",
    amharicLabel: "የጥራት ተቆጣጣሪ",
    defaultName: "Hanna Worku (QA)",
    defaultEmail: "qa@dpm.local",
    description: "Inspections & Defect Tracking",
    primaryPath: "/qa",
    badgeClass: "badge-accent text-white font-bold",
    icon: ClipboardCheck,
  },
];

interface DevAccount {
  id: string;
  name: string;
  email: string;
  role: "sys_admin" | "om" | "fm" | "qa";
  active: boolean;
}

interface RoleSwitcherProps {
  currentRole?: string | null;
  currentEmail?: string | null;
}

export function RoleSwitcher({ currentRole, currentEmail }: RoleSwitcherProps) {
  const pathname = usePathname();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic user list loaded from server
  const [allUsers, setAllUsers] = useState<DevAccount[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [destinationMode, setDestinationMode] = useState<"workspace" | "current" | "dashboard">("workspace");

  // Load all users on popover open
  useEffect(() => {
    if (isOpen && !usersLoaded) {
      fetch("/api/dev/switch-role")
        .then((res) => res.json())
        .then((data) => {
          if (data.users && Array.isArray(data.users)) {
            setAllUsers(data.users);
            setUsersLoaded(true);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, usersLoaded]);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const activeRoleOption = PRIMARY_ROLES.find(
    (r) => r.role === currentRole || r.defaultEmail === currentEmail
  );

  // Switch to role or specific user via server-side session generator
  const handleSwitch = async (params: { role?: string; userId?: string; targetPath?: string }) => {
    const switchKey = params.userId || params.role || "unknown";
    if (switchingTo) return;
    setSwitchingTo(switchKey);
    setErrorMsg(null);

    let targetRoute = params.targetPath;
    if (!targetRoute) {
      if (destinationMode === "current") {
        targetRoute = pathname || "/dashboard";
      } else if (destinationMode === "dashboard") {
        targetRoute = "/dashboard";
      } else {
        const targetRole = params.role || allUsers.find((u) => u.id === params.userId)?.role;
        targetRoute = PRIMARY_ROLES.find((r) => r.role === targetRole)?.primaryPath || "/dashboard";
      }
    }

    try {
      const res = await fetch("/api/dev/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: params.role,
          userId: params.userId,
          targetRoute,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to switch role");
      }

      setIsOpen(false);
      window.location.href = data.redirectTo || targetRoute || "/dashboard";
    } catch (err: any) {
      console.error("Role switch error:", err);
      setErrorMsg(err.message || "Failed to switch role");
      setSwitchingTo(null);
    }
  };

  // Sign out / Guest mode
  const handleLogout = async () => {
    setSwitchingTo("logout");
    try {
      await fetch("/api/dev/switch-role", { method: "DELETE" });
      setIsOpen(false);
      window.location.href = "/login";
    } catch {
      setSwitchingTo(null);
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    if (!accountSearch.trim()) return true;
    const q = accountSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={popoverRef} className="fixed bottom-20 sm:bottom-5 right-3 sm:right-5 z-50 select-none">
      {/* Expanded Popover */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-1.5rem)] max-w-sm sm:max-w-none sm:w-[420px] bg-white/95 backdrop-blur-md border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-4 sm:p-5 animate-in fade-in slide-in-from-bottom-3 duration-200 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    Developer Role Switcher
                  </h3>
                  <span className="badge badge-xs bg-indigo-100 text-indigo-700 font-bold border-none text-[9px] uppercase px-1.5">
                    DEV
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Instant 1-click server authentication (No password needed)
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={() => setIsOpen(false)}
              className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="alert alert-error text-xs py-2 px-3 rounded-xl mb-3 bg-red-50 text-red-700 border border-red-200 shrink-0">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Destination Landing Preference */}
          <div className="mb-3 p-2 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              <span>After switch go to:</span>
            </div>
            <div className="join bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setDestinationMode("workspace")}
                className={`btn btn-xs join-item rounded-lg font-bold text-[10px] ${
                  destinationMode === "workspace"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "btn-ghost text-slate-600"
                }`}
                title="Go to role workspace (/admin, /om, /entry, /qa)"
              >
                Workspace
              </button>
              <button
                type="button"
                onClick={() => setDestinationMode("current")}
                className={`btn btn-xs join-item rounded-lg font-bold text-[10px] ${
                  destinationMode === "current"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "btn-ghost text-slate-600"
                }`}
                title="Stay on current page"
              >
                Same Page
              </button>
              <button
                type="button"
                onClick={() => setDestinationMode("dashboard")}
                className={`btn btn-xs join-item rounded-lg font-bold text-[10px] ${
                  destinationMode === "dashboard"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "btn-ghost text-slate-600"
                }`}
                title="Go to role dashboard"
              >
                Dashboard
              </button>
            </div>
          </div>

          {/* Primary Role Cards (Scrollable) */}
          <div className="space-y-1.5 overflow-y-auto pr-0.5 flex-1 min-h-0">
            {PRIMARY_ROLES.map((item) => {
              const Icon = item.icon;
              const isActive = item.role === currentRole;
              const isPendingThis = switchingTo === item.role;

              return (
                <button
                  key={item.role}
                  type="button"
                  disabled={switchingTo !== null}
                  onClick={() => handleSwitch({ role: item.role })}
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl border text-left transition-all ${
                    isActive
                      ? "border-indigo-400 bg-indigo-50/70 shadow-xs"
                      : "border-slate-100 hover:border-slate-300 hover:bg-slate-50 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {isPendingThis ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-slate-900 leading-tight">
                          {item.label}
                        </span>
                        {item.amharicLabel && (
                          <span className="text-[11px] font-semibold text-slate-400 font-sans leading-relaxed">
                            ({item.amharicLabel})
                          </span>
                        )}
                        <span className={`badge badge-xs text-[9px] uppercase tracking-wider ${item.badgeClass}`}>
                          {item.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5 leading-relaxed">
                        {item.defaultName} • <span className="font-mono text-slate-400">{item.defaultEmail}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isActive ? (
                      <span className="flex items-center gap-1 text-[11px] font-black text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-600 flex items-center gap-0.5">
                        Switch <ArrowRight className="w-3 h-3 inline" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Expandable All Database Accounts Section */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={() => setShowAllUsers((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-indigo-600 py-1"
            >
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Switch to Specific Account ({allUsers.length})</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  showAllUsers ? "rotate-180" : ""
                }`}
              />
            </button>

            {showAllUsers && (
              <div className="mt-2 space-y-2 animate-in fade-in duration-150">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    placeholder="Filter specific account name, email, or role..."
                    className="input input-xs input-bordered w-full pl-7 text-xs rounded-xl"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-3 text-xs text-slate-400">
                      No matching accounts found
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isCurrent = u.email === currentEmail;
                      const isPending = switchingTo === u.id;

                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={switchingTo !== null}
                          onClick={() => handleSwitch({ userId: u.id })}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition-all ${
                            isCurrent
                              ? "bg-indigo-50 border border-indigo-200 font-bold"
                              : "hover:bg-slate-50 border border-slate-100"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold text-slate-900 truncate">
                              {u.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              {u.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="badge badge-xs text-[9px] uppercase font-bold">
                              {u.role}
                            </span>
                            {isPending && <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Workspace Navigation & Sign Out Footer */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
            <button
              type="button"
              disabled={switchingTo !== null}
              onClick={handleLogout}
              className="text-slate-500 hover:text-rose-600 font-bold flex items-center gap-1 text-[11px]"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out (Guest)</span>
            </button>

            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active: {activeRoleOption?.label || currentRole || "Guest"}
            </span>
          </div>
        </div>
      )}

      {/* Floating Action Pill (Collapses neatly to a compact FAB on mobile) */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group flex items-center gap-2 p-2.5 sm:px-3.5 sm:py-2.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-white shadow-xl hover:shadow-2xl border border-slate-700/80 backdrop-blur-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-hidden"
          title="Switch Active Developer Role"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs relative">
            <UserCheck className="w-3.5 h-3.5" />
            <span className="sm:hidden absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-black">
            <span className="text-slate-400 font-normal">Role:</span>
            <span className="text-white">
              {activeRoleOption?.label || currentRole?.toUpperCase() || "Select Role"}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <ChevronUp
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 hidden sm:block ${
              isOpen ? "rotate-180 text-white" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );
}
