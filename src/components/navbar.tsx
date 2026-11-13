"use client";

import { useState, useEffect, useRef } from "react";
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
  CalendarDays,
  PenTool,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  User,
  Key,
  MoreHorizontal,
  RefreshCw,
  Server,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { SessionUser } from "@/lib/authz";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { usePwaOtaContext } from "@/components/pwa/pwa-ota-manager";
import { BackendServerSettingsModal } from "@/components/settings/backend-server-settings-modal";

interface NavbarProps {
  user: SessionUser;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const pwa = usePwaOtaContext();
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Clear pending navigation state on pathname change
  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }

    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setMobileMenuOpen(false);
        setServerSettingsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await fetch("/api/dev/switch-role", { method: "DELETE" }).catch(() => {});
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

  // Role-tailored navigation items
  const getNavLinks = () => {
    switch (user.role) {
      case "om":
        return [
          {
            label: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            exact: true,
          },
          {
            label: "Operations Hub",
            href: "/om",
            icon: Building2,
          },
          {
            label: "Production Plans",
            href: "/planning",
            icon: CalendarDays,
          },
          {
            label: "Daily Reports",
            href: "/entry",
            icon: ClipboardCheck,
          },
          {
            label: "Calendar",
            href: "/calendar",
            icon: Calendar,
          },
        ];
      case "fm":
        return [
          {
            label: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            exact: true,
          },
          {
            label: "Lines & Floor",
            href: "/fm",
            icon: Building2,
            exact: true,
          },
          {
            label: "Production Plans",
            href: "/planning",
            icon: CalendarDays,
          },
          {
            label: "Store Stock",
            href: "/fm/store",
            icon: Warehouse,
          },
          {
            label: "Daily Entry",
            href: "/entry",
            icon: PenTool,
          },
          {
            label: "Calendar",
            href: "/calendar",
            icon: Calendar,
          },
        ];
      case "qa":
        return [
          {
            label: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            exact: true,
          },
          {
            label: "QA Approvals",
            href: "/qa",
            icon: ClipboardCheck,
          },
        ];
      case "sys_admin":
        return [
          {
            label: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            exact: true,
          },
          {
            label: "Admin Portal",
            href: "/admin",
            icon: Shield,
          },
        ];
      default:
        return [
          {
            label: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            exact: true,
          },
        ];
    }
  };

  const visibleLinks = getNavLinks();

  // Warm up Next.js client router cache for visible links so navigation is instantaneous
  useEffect(() => {
    visibleLinks.forEach((link) => {
      router.prefetch?.(link.href);
    });
  }, [visibleLinks, router]);

  // Define role-specific primary bottom navigation items (Ergonomic thumb zone, max 5 destinations)
  const getBottomNavItems = () => {
    switch (user.role) {
      case "fm":
        return [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
          { label: "Lines", href: "/fm", icon: Building2, exact: true },
          { label: "Entry", href: "/entry", icon: PenTool },
          { label: "Calendar", href: "/calendar", icon: Calendar },
        ];
      case "om":
        return [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
          { label: "Plants", href: "/om", icon: Building2 },
          { label: "Review", href: "/entry", icon: PenTool },
          { label: "Calendar", href: "/calendar", icon: Calendar },
        ];
      case "qa":
        return [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
          { label: "Inspections", href: "/qa", icon: ClipboardCheck },
        ];
      case "sys_admin":
        return [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
          { label: "Admin Portal", href: "/admin", icon: Shield },
        ];
      default:
        return [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
        ];
    }
  };

  const bottomNavItems = getBottomNavItems();

  // Highlight "More" tab if current active route lives inside the drawer
  const isMoreActive =
    visibleLinks.some((link) => {
      const isPrimary = bottomNavItems.some((b) => b.href === link.href);
      if (isPrimary) return false;
      const safePathname = pathname || "";
      return link.exact
        ? safePathname === link.href
        : safePathname.startsWith(link.href);
    }) || pathname === "/change-password";

  const userInitial = user.name ? user.name.trim().charAt(0).toUpperCase() : "U";

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl 2xl:max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16">
          <div className="flex items-center justify-between h-16">
            {/* Brand & Desktop Navigation */}
            <div className="flex items-center gap-6 lg:gap-8">
              <Link
                href="/dashboard"
                prefetch={true}
                onMouseEnter={() => router.prefetch?.("/dashboard")}
                onTouchStart={() => router.prefetch?.("/dashboard")}
                onClick={() => {
                  if (pathname !== "/dashboard") {
                    setPendingPath("/dashboard");
                  }
                }}
                className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-slate-900 group focus:outline-hidden"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:bg-indigo-700 transition-colors">
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
                  const isPending = pendingPath === link.href;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={true}
                      onMouseEnter={() => router.prefetch?.(link.href)}
                      onTouchStart={() => router.prefetch?.(link.href)}
                      onClick={() => {
                        if (link.href !== pathname) {
                          setPendingPath(link.href);
                        }
                      }}
                      className={`relative px-3 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-semibold ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                      } ${isPending ? "opacity-80" : ""}`}
                    >
                      {isPending ? (
                        <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                      ) : (
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? "text-indigo-600" : "text-slate-400"
                          }`}
                        />
                      )}
                      <span>{link.label}</span>
                      {isActive && !isPending && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute right-2 top-2" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Side: Notifications & Clean Profile Dropdown */}
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationsDropdown userRole={user.role} />

              {/* Profile Dropdown (Replaces clutter with clean dropdown) */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-full hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  aria-label="User profile menu"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-2xs shrink-0 ring-2 ring-indigo-100">
                    {userInitial}
                  </div>
                  <div className="hidden lg:flex flex-col items-start text-left leading-tight">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                      {user.name}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 capitalize">
                      {roleLabel}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden sm:block ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Profile Dropdown Menu */}
                {profileOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-100"
                  >
                    {/* User Profile Card */}
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black text-base flex items-center justify-center shadow-xs shrink-0">
                          {userInitial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-slate-900 truncate">
                            {user.name}
                          </div>
                          <div className="text-xs font-mono text-slate-400 truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border tracking-wider ${roleBadgeColor}`}
                        >
                          {roleLabel}
                        </span>
                        {roleAmharicDesc && (
                          <span className="text-[11px] text-slate-400 font-medium leading-relaxed">
                            {roleAmharicDesc}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Account Links */}
                    <div className="py-1">
                      <Link
                        href="/change-password"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                      >
                        <Key className="w-4 h-4 text-slate-400" />
                        <span>Change Password</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setServerSettingsOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <Server className="w-4 h-4 text-slate-400" />
                          <span>Server Settings</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                          LAN / Cloud
                        </span>
                      </button>
                      <button
                        type="button"
                        data-testid="navbar-download-pwa-button"
                        onClick={async () => {
                          setProfileOpen(false);
                          if (pwa.isInstallable) {
                            await pwa.promptInstall();
                          } else {
                            setServerSettingsOpen(true);
                          }
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <Download className="w-4 h-4 text-slate-400" />
                          <span>Download App (PWA)</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {pwa.isInstallable ? "Install" : "Guide"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setProfileOpen(false);
                          setCheckingUpdate(true);
                          try {
                            const updateFound = await pwa.checkForUpdate();
                            if (!updateFound) {
                              toast.info(`DPM is up to date (v${pwa.currentVersion})`);
                            }
                          } finally {
                            setCheckingUpdate(false);
                          }
                        }}
                        disabled={checkingUpdate || pwa.isChecking}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <RefreshCw
                            className={`w-4 h-4 text-slate-400 ${
                              checkingUpdate || pwa.isChecking ? "animate-spin" : ""
                            }`}
                          />
                          <span>Check for Updates</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
                          v{pwa.currentVersion}
                        </span>
                      </button>
                    </div>

                    {/* Sign Out Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          handleSignOut();
                        }}
                        disabled={signingOut}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                      >
                        {signingOut ? (
                          <span className="loading loading-spinner loading-xs text-rose-600" />
                        ) : (
                          <LogOut className="w-4 h-4 text-rose-500" />
                        )}
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

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

      {/* Mobile Bottom Navigation Bar (Persistent Ergonomic Thumb-Zone Navigation) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
      >
        <div
          className={`grid ${
            bottomNavItems.length === 2
              ? "grid-cols-3"
              : bottomNavItems.length === 3
              ? "grid-cols-4"
              : "grid-cols-5"
          } h-15 items-center px-1.5`}
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const safePathname = pathname || "";
            const isActive = item.exact
              ? safePathname === item.href
              : safePathname.startsWith(item.href);
            const isPending = pendingPath === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onMouseEnter={() => router.prefetch?.(item.href)}
                onTouchStart={() => router.prefetch?.(item.href)}
                onClick={() => {
                  if (item.href !== pathname) {
                    setPendingPath(item.href);
                  }
                }}
                aria-current={isActive ? "page" : undefined}
                className={`group flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all duration-150 touch-manipulation min-h-[44px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? "text-indigo-600 font-extrabold"
                    : "text-slate-500 hover:text-slate-900 active:scale-95"
                }`}
              >
                <div
                  className={`p-1 rounded-full transition-all duration-150 ${
                    isActive
                      ? "bg-indigo-50 text-indigo-600 scale-105 shadow-2xs"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}
                >
                  {isPending ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-[10px] leading-tight font-bold tracking-tight text-center truncate max-w-full">
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More / Overflow Hub Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="More navigation options"
            aria-expanded={mobileMenuOpen}
            className={`group flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl transition-all duration-150 touch-manipulation min-h-[44px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isMoreActive || mobileMenuOpen
                ? "text-indigo-600 font-extrabold"
                : "text-slate-500 hover:text-slate-900 active:scale-95"
            }`}
          >
            <div
              className={`relative p-1 rounded-full transition-all duration-150 ${
                isMoreActive || mobileMenuOpen
                  ? "bg-indigo-50 text-indigo-600 scale-105 shadow-2xs"
                  : "text-slate-400 group-hover:text-slate-600"
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              {isMoreActive && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white" />
              )}
            </div>
            <span className="text-[10px] leading-tight font-bold tracking-tight text-center truncate max-w-full">
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className="fixed inset-0 z-50 md:hidden flex flex-col justify-end"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Body */}
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 z-10 max-h-[85vh] overflow-y-auto border-t border-slate-200 space-y-6 animate-in slide-in-from-bottom duration-200 ease-out">
            {/* Top Grab Bar Handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2 mb-3" />

            {/* Drawer Header & User Pill */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  {userInitial}
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
                const isPending = pendingPath === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={true}
                    onMouseEnter={() => router.prefetch?.(link.href)}
                    onTouchStart={() => router.prefetch?.(link.href)}
                    onClick={() => {
                      if (link.href !== pathname) {
                        setPendingPath(link.href);
                      }
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-2xl font-bold text-sm transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isPending ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-200 shrink-0" />
                      ) : (
                        <Icon
                          className={`w-5 h-5 ${
                            isActive ? "text-white" : "text-slate-400"
                          }`}
                        />
                      )}
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
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Link
                href="/change-password"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full btn btn-ghost text-slate-700 rounded-2xl flex items-center justify-center gap-2 font-bold py-2.5 text-xs"
              >
                <Key className="w-4 h-4 text-slate-400" />
                <span>Change Password</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setServerSettingsOpen(true);
                }}
                className="w-full btn btn-ghost text-slate-700 rounded-2xl flex items-center justify-center gap-2 font-bold py-2.5 text-xs"
              >
                <Server className="w-4 h-4 text-slate-400" />
                <span>Server Settings (LAN / Cloud)</span>
              </button>
              <button
                type="button"
                data-testid="mobile-download-pwa-button"
                onClick={async () => {
                  setMobileMenuOpen(false);
                  if (pwa.isInstallable) {
                    await pwa.promptInstall();
                  } else {
                    setServerSettingsOpen(true);
                  }
                }}
                className="w-full btn btn-ghost text-slate-700 rounded-2xl flex items-center justify-center gap-2 font-bold py-2.5 text-xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Download App (PWA) / አፕሊኬሽኑን ጫን</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setMobileMenuOpen(false);
                  setCheckingUpdate(true);
                  try {
                    const updateFound = await pwa.checkForUpdate();
                    if (!updateFound) {
                      toast.info(`DPM is up to date (v${pwa.currentVersion})`);
                    }
                  } finally {
                    setCheckingUpdate(false);
                  }
                }}
                disabled={checkingUpdate || pwa.isChecking}
                className="w-full btn btn-ghost text-slate-700 rounded-2xl flex items-center justify-center gap-2 font-bold py-2.5 text-xs"
              >
                <RefreshCw
                  className={`w-4 h-4 text-slate-400 ${
                    checkingUpdate || pwa.isChecking ? "animate-spin" : ""
                  }`}
                />
                <span>Check for Updates (v{pwa.currentVersion})</span>
              </button>
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

      {/* Backend Server & Network Settings Modal - Lazy loaded on open */}
      {serverSettingsOpen && (
        <BackendServerSettingsModal
          isOpen={serverSettingsOpen}
          onClose={() => setServerSettingsOpen(false)}
          isAdmin={user.role === "sys_admin"}
        />
      )}
    </>
  );
}
