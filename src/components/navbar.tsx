"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  LayoutDashboard,
  Shield,
  Building2,
  Boxes,
  ClipboardCheck,
  Warehouse,
  Calendar,
  PenTool,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User,
} from "lucide-react";
import { SessionUser } from "@/lib/authz";

interface NavbarProps {
  user: SessionUser;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Sign out error", err);
      window.location.href = "/login";
    } finally {
      setSigningOut(false);
    }
  };

  const roleBadgeColor =
    {
      sys_admin: "bg-rose-50 text-rose-700 border-rose-200",
      om: "bg-indigo-50 text-indigo-700 border-indigo-200",
      fm: "bg-teal-50 text-teal-700 border-teal-200",
      qa: "bg-amber-50 text-amber-700 border-amber-200",
    }[user.role] || "bg-slate-100 text-slate-700 border-slate-200";

  const roleLabel =
    {
      sys_admin: "Sys Admin",
      om: "Operation Mgr",
      fm: "Factory Mgr",
      qa: "QA Inspector",
    }[user.role] || user.role;

  const roleAmharicDesc =
    {
      sys_admin: "የስርዓት አስተዳዳሪ",
      om: "ኦፕሬሽን ስራ አስኪያጅ",
      fm: "ፋብሪካ ስራ አስኪያጅ",
      qa: "የጥራት ተቆጣጣሪ",
    }[user.role] || "";

  const navLinks = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["sys_admin", "om", "fm", "qa"],
      exact: true,
    },
    {
      label: "Admin Portal",
      href: "/admin",
      icon: Shield,
      roles: ["sys_admin"],
    },
    {
      label: "OM Operations",
      href: "/om",
      icon: Building2,
      roles: ["om"],
    },
    {
      label: "Lines & Plans",
      href: "/fm",
      icon: Building2,
      roles: ["fm"],
      exact: true,
    },
    {
      label: "Store Stock",
      href: "/fm/store",
      icon: Warehouse,
      roles: ["fm"],
    },
    {
      label: "Daily Entry",
      href: "/entry",
      icon: PenTool,
      roles: ["om", "fm"],
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: Calendar,
      roles: ["om", "fm"],
    },
    {
      label: "QA Inspections",
      href: "/qa",
      icon: ClipboardCheck,
      roles: ["qa"],
    },
  ];

  const visibleLinks = navLinks.filter((link) =>
    link.roles.includes(user.role)
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand & Left Navigation */}
            <div className="flex items-center gap-6 lg:gap-8">
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-slate-900 group focus:outline-hidden"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:bg-indigo-700 transition-colors">
                  <Boxes className="w-5 h-5" />
                </div>
                <span className="flex items-center gap-1.5 font-black">
                  DPM
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 uppercase tracking-wider border border-indigo-100">
                    Pro
                  </span>
                </span>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
                {visibleLinks.map((link) => {
                  const Icon = link.icon;
                  const safePathname = pathname || "";
                  const isActive = link.exact
                    ? safePathname === link.href
                    : safePathname.startsWith(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative px-3 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-semibold ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? "text-indigo-600" : "text-slate-400"
                        }`}
                      />
                      <span>{link.label}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute right-2 top-2" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Side: User Profile & Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {user.name}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border tracking-wider ${roleBadgeColor}`}
                  >
                    {roleLabel}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {user.email}
                </span>
              </div>

              <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1" />

              {/* Sign Out (Desktop) */}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="hidden md:inline-flex btn btn-ghost btn-sm text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl gap-1.5 font-bold"
                title="Sign Out"
              >
                {signingOut ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>Sign Out</span>
              </button>

              {/* Mobile Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden touch-target flex items-center justify-center"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-slate-800" />
                ) : (
                  <Menu className="w-6 h-6 text-slate-800" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer / Slide-over */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 z-10 max-h-[85vh] overflow-y-auto border-t border-slate-200 space-y-6 animate-in slide-in-from-bottom duration-200 ease-out">
            {/* Top Grab Bar Handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2 mb-3" />

            {/* Drawer Header & User Pill */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-base leading-tight truncate">
                    {user.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${roleBadgeColor}`}
                    >
                      {roleLabel}
                    </span>
                    {roleAmharicDesc && (
                      <span className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        ({roleAmharicDesc})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-mono truncate max-w-[200px] mt-0.5">
                    {user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700 shrink-0"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
                Navigation
              </span>
              {visibleLinks.map((link) => {
                const Icon = link.icon;
                const safePathname = pathname || "";
                const isActive = link.exact
                  ? safePathname === link.href
                  : safePathname.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-2xl font-bold text-sm transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-5 h-5 ${
                          isActive ? "text-white" : "text-slate-400"
                        }`}
                      />
                      <span>{link.label}</span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 ${
                        isActive ? "text-indigo-200" : "text-slate-300"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>

            {/* Sign Out Action in Mobile Drawer */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full btn btn-outline btn-error rounded-2xl flex items-center justify-center gap-2 font-bold py-3"
              >
                {signingOut ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
