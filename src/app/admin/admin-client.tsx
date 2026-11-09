"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateIndustryProfileAction,
  createUserAction,
  updateUserRoleAction,
  toggleUserActiveAction,
  adminResetPasswordAction,
} from "@/actions/admin-actions";
import { Role, ROLES_METADATA, ALL_ROLES } from "@/lib/rbac-types";
import {
  Users,
  Settings,
  Plus,
  Shield,
  Check,
  AlertCircle,
  Copy,
  CheckCheck,
  ShieldCheck,
  Search,
  KeyRound,
  RotateCcw,
  X,
  Calendar,
  Building,
  CheckCircle2,
} from "lucide-react";

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

export interface AdminClientProps {
  initialProfile: {
    id: string;
    companyName: string;
    workingDays: number[];
    units: string;
    calendarSystem?: "ethiopian" | "gregorian";
  };
  initialOms: Array<{
    id: string;
    name: string;
    email: string;
    active: boolean;
    mustChangePassword: boolean;
    createdAt: Date;
  }>;
  initialUsers?: AdminUserItem[];
  currentUserId?: string;
  impersonationCandidates?: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  isDevImpersonationEnabled?: boolean;
}

const DAYS = [
  { day: 1, label: "Monday", amLabel: "ሰኞ" },
  { day: 2, label: "Tuesday", amLabel: "ማክሰኞ" },
  { day: 3, label: "Wednesday", amLabel: "ረቡዕ" },
  { day: 4, label: "Thursday", amLabel: "ሐሙስ" },
  { day: 5, label: "Friday", amLabel: "አርብ" },
  { day: 6, label: "Saturday", amLabel: "ቅዳሜ" },
  { day: 0, label: "Sunday", amLabel: "እሑድ" },
];

const ROLE_AMHARIC_LABELS: Record<Role, { amLabel: string; amDesc: string }> = {
  sys_admin: {
    amLabel: "የስርዓት አስተዳዳሪ",
    amDesc: "የሙሉ ሲስተም፣ ቴናንት እና የተጠቃሚዎች አስተዳደር",
  },
  om: {
    amLabel: "የኦፕሬሽን ሥራ አስኪያጅ",
    amDesc: "የበርካታ ፋብሪካዎች ቁጥጥር እና አመራር",
  },
  fm: {
    amLabel: "የፋብሪካ ሥራ አስኪያጅ",
    amDesc: "የማምረቻ መስመሮች እና የዕለት ሪፖርት ቁጥጥር",
  },
  qa: {
    amLabel: "የጥራት መርማሪ",
    amDesc: "የምርት ጥራት ማረጋገጫ እና የብልሽት ቁጥጥር",
  },
};

export function AdminClient({
  initialProfile,
  initialOms,
  initialUsers = [],
  currentUserId,
}: AdminClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"roles" | "profile">("roles");

  // Profile Form State
  const [companyName, setCompanyName] = useState(initialProfile.companyName);
  const [workingDays, setWorkingDays] = useState<number[]>(
    initialProfile.workingDays || [1, 2, 3, 4, 5, 6]
  );
  const [units, setUnits] = useState(initialProfile.units);
  const [calendarSystem, setCalendarSystem] = useState<"ethiopian" | "gregorian">(
    initialProfile.calendarSystem || "ethiopian"
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Users & Role Assignment State
  const usersList: AdminUserItem[] =
    initialUsers && initialUsers.length > 0
      ? initialUsers
      : initialOms.map((om) => ({
          ...om,
          role: "om" as Role,
        }));

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [roleActionToast, setRoleActionToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // New User Provisioning Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("TemporaryPass123!");
  const [newUserRole, setNewUserRole] = useState<Role>("om");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "must_change">("all");

  // Admin Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState<AdminUserItem | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetMustChangePassword, setResetMustChangePassword] = useState(true);
  const [resetCopied, setResetCopied] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()";
    let pwd = "";
    pwd += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    pwd += "abcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 24)];
    pwd += "23456789"[Math.floor(Math.random() * 8)];
    pwd += "!@#$%^&*"[Math.floor(Math.random() * 8)];
    for (let i = 4; i < 16; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  };

  const handleOpenResetModal = (target: AdminUserItem) => {
    setResetModalUser(target);
    setResetPasswordValue(generateRandomPassword());
    setResetMustChangePassword(true);
    setResetCopied(false);
    setResetError(null);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResetSaving(true);
    setResetError(null);

    const res = await adminResetPasswordAction({
      userId: resetModalUser.id,
      newPassword: resetPasswordValue,
      mustChangePassword: resetMustChangePassword,
    });

    setResetSaving(false);
    if (res.success) {
      setRoleActionToast({
        type: "success",
        text: res.message || `Password for ${resetModalUser.name} reset successfully.`,
      });
      setTimeout(() => setRoleActionToast(null), 4000);
      setResetModalUser(null);
      router.refresh();
    } else {
      setResetError(res.error || "Failed to reset password.");
    }
  };

  // Toggle Day selection
  const handleDayToggle = (day: number) => {
    if (workingDays.includes(day)) {
      if (workingDays.length <= 1) return;
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  // Save Industry Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);

    const res = await updateIndustryProfileAction({
      companyName: companyName.trim(),
      workingDays,
      units: units.trim(),
      calendarSystem,
    });

    setProfileSaving(false);
    if (res.success) {
      setProfileMsg({ type: "success", text: "Settings saved successfully." });
      setTimeout(() => setProfileMsg(null), 3500);
      router.refresh();
    } else {
      setProfileMsg({
        type: "error",
        text: res.error || "Failed to save settings.",
      });
    }
  };

  // Create User with Role
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSaving(true);
    setUserError(null);

    const res = await createUserAction({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      password: newUserPassword,
      role: newUserRole,
    });

    setUserSaving(false);
    if (res.success) {
      setUserModalOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("TemporaryPass123!");
      setNewUserRole("om");
      setRoleActionToast({
        type: "success",
        text: "User provisioned successfully with role assigned.",
      });
      setTimeout(() => setRoleActionToast(null), 3500);
      router.refresh();
    } else {
      setUserError(res.error || "Failed to create user.");
    }
  };

  // Role Assignment change handler
  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdatingRoleId(userId);
    setRoleActionToast(null);

    const res = await updateUserRoleAction(userId, newRole);
    setUpdatingRoleId(null);

    if (res.success) {
      setRoleActionToast({
        type: "success",
        text: `Role reassigned to ${ROLES_METADATA[newRole]?.label || newRole} successfully.`,
      });
      setTimeout(() => setRoleActionToast(null), 3500);
      router.refresh();
    } else {
      setRoleActionToast({
        type: "error",
        text: res.error || "Failed to update role.",
      });
      setTimeout(() => setRoleActionToast(null), 4000);
    }
  };

  // Toggle User Active
  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    await toggleUserActiveAction(userId, !currentActive);
    router.refresh();
  };

  // Filter users by role, status, and search query
  const filteredUsers = usersList.filter((u) => {
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.active) ||
      (statusFilter === "inactive" && !u.active) ||
      (statusFilter === "must_change" && u.mustChangePassword);

    return matchesRole && matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Global Toast Notification */}
      {roleActionToast && (
        <div
          role="status"
          aria-live="polite"
          className={`alert text-xs sm:text-sm py-3 px-4 rounded-2xl flex items-center justify-between shadow-sm border transition-all ${
            roleActionToast.type === "success"
              ? "bg-emerald-50 text-emerald-950 border-emerald-300"
              : "bg-rose-50 text-rose-950 border-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {roleActionToast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium leading-relaxed break-words">{roleActionToast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setRoleActionToast(null)}
            className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:text-slate-800 min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Navigation Tabs */}
      <div
        aria-label="Admin Navigation Tabs"
        className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-b border-slate-200/80 pb-3"
      >
        <button
          type="button"
          onClick={() => setActiveTab("roles")}
          className={`min-h-[44px] flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all touch-manipulation ${
            activeTab === "roles"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="flex items-center gap-1.5 flex-wrap">
            <span>Role Assignment & Users</span>
            <span className="text-xs font-normal opacity-85 leading-normal hidden md:inline">
              (የተጠቃሚዎች እና ሚናዎች ምደባ)
            </span>
          </span>
          <span
            className={`badge badge-sm font-mono text-[10px] ml-1 ${
              activeTab === "roles"
                ? "bg-white text-indigo-700 border-none font-bold"
                : "bg-slate-200 text-slate-700 font-semibold"
            }`}
          >
            {usersList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`min-h-[44px] flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all touch-manipulation ${
            activeTab === "profile"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="flex items-center gap-1.5 flex-wrap">
            <span>Industry Profile Settings</span>
            <span className="text-xs font-normal opacity-85 leading-normal hidden md:inline">
              (የድርጅት መገለጫ ማስተካከያ)
            </span>
          </span>
        </button>
      </div>

      {/* TAB 1: Role Assigning Table & User Provisioning */}
      {activeTab === "roles" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 flex-wrap">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl inline-flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </span>
                <span>Role Assignment Table</span>
                <span className="text-xs sm:text-sm font-normal text-slate-500 leading-normal">
                  (የተጠቃሚዎች ዝርዝር እና ሚና ምደባ)
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Manage all accounts and assign Better Auth RBAC roles directly with one click.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setUserModalOpen(true)}
              className="btn min-h-[44px] h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-2 px-4 shadow-sm font-semibold transition-all touch-manipulation w-full sm:w-auto flex items-center justify-center shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Provision New User</span>
              <span className="hidden sm:inline text-xs font-normal opacity-85">(አዲስ ተጠቃሚ)</span>
            </button>
          </div>

          {/* Filter Bar & Search */}
          <div className="space-y-3.5 bg-slate-50/80 p-3.5 sm:p-4 rounded-2xl border border-slate-200/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search accounts by name, email, or role..."
                  className="input min-h-[44px] h-11 input-bordered w-full pl-10 pr-10 text-xs sm:text-sm font-medium rounded-xl bg-white border-slate-200 focus:border-indigo-600 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter & Count */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  aria-label="Filter by account status"
                  className="select select-bordered min-h-[44px] h-11 bg-white text-xs sm:text-sm font-semibold rounded-xl border-slate-200 focus:border-indigo-600"
                >
                  <option value="all">All Statuses (ሁሉም ሁኔታዎች)</option>
                  <option value="active">Active Only (ንቁ ብቻ)</option>
                  <option value="inactive">Inactive Only (ቦዘንቴ ብቻ)</option>
                  <option value="must_change">Needs Password Change (ጊዜያዊ የይለፍ ቃል)</option>
                </select>

                <div className="min-h-[44px] flex items-center justify-center text-xs font-bold text-slate-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 whitespace-nowrap">
                  Showing <b className="text-indigo-600 mx-1">{filteredUsers.length}</b> of {usersList.length}
                </div>
              </div>
            </div>

            {/* Role Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/70">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1.5">
                Role (ሚና):
              </span>
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`min-h-[36px] sm:min-h-[32px] px-3 py-1.5 rounded-xl font-bold text-xs transition-all touch-manipulation ${
                  roleFilter === "all"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                All ({usersList.length})
              </button>
              {ALL_ROLES.map((r) => {
                const count = usersList.filter((u) => u.role === r).length;
                const isSelected = roleFilter === r;
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`min-h-[36px] sm:min-h-[32px] px-3 py-1.5 rounded-xl font-bold text-xs transition-all touch-manipulation ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {ROLES_METADATA[r]?.shortLabel || r} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* The Table wrapped in horizontal scroll with min-width */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400 text-sm leading-relaxed">
                No users found matching the selected filter.
              </div>
            ) : (
              <table className="table w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200/80">
                    <th className="py-3.5 px-4">User (ተጠቃሚ)</th>
                    <th className="py-3.5 px-4">Current Role (የአሁን ሚና)</th>
                    <th className="py-3.5 px-4">Assign Role (ሚና መድብ)</th>
                    <th className="py-3.5 px-4">Account Status (ሁኔታ)</th>
                    <th className="py-3.5 px-4">Password (የይለፍ ቃል)</th>
                    <th className="py-3.5 px-4 text-right">Actions (እርምጃዎች)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUserId === u.id;
                    const meta = ROLES_METADATA[u.role];
                    const isUpdating = updatingRoleId === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 max-w-[240px]">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5 break-words leading-relaxed">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="badge badge-xs badge-outline text-indigo-600 font-normal shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono break-all mt-0.5">
                            {u.email}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`badge badge-sm font-semibold uppercase text-[10px] tracking-wider ${
                              meta?.badgeClass || "badge-ghost"
                            }`}
                          >
                            {meta?.shortLabel || u.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <select
                              disabled={isSelf || isUpdating}
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as Role)
                              }
                              aria-label={`Assign role for ${u.name}`}
                              className={`select select-bordered select-sm min-h-[40px] rounded-xl text-xs font-medium focus:border-indigo-600 ${
                                isSelf ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                              }`}
                              title={
                                isSelf
                                  ? "Cannot change your own role"
                                  : "Reassign role for this user"
                              }
                            >
                              {ALL_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLES_METADATA[r]?.label} ({ROLES_METADATA[r]?.shortLabel})
                                </option>
                              ))}
                            </select>
                            {isUpdating && (
                              <span className="loading loading-spinner loading-xs text-indigo-600"></span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {u.active ? (
                            <span className="badge badge-sm badge-success text-white font-medium">
                              Active
                            </span>
                          ) : (
                            <span className="badge badge-sm badge-ghost text-slate-400 font-medium">
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {u.mustChangePassword ? (
                            <span className="badge badge-sm badge-warning text-amber-950 font-medium">
                              Temporary
                            </span>
                          ) : (
                            <span className="badge badge-sm badge-ghost text-slate-400">
                              Permanent
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenResetModal(u)}
                              className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl gap-1.5 font-bold shadow-2xs text-xs flex items-center justify-center transition-all touch-manipulation"
                              title={`Reset password for ${u.name}`}
                            >
                              <KeyRound className="w-3.5 h-3.5 shrink-0" />
                              <span>Reset Password</span>
                            </button>

                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => handleToggleActive(u.id, u.active)}
                              className={`min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center transition-all touch-manipulation ${
                                isSelf
                                  ? "text-slate-300 cursor-not-allowed bg-slate-50"
                                  : u.active
                                  ? "text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200"
                                  : "text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
                              }`}
                              title={
                                isSelf
                                  ? "Cannot deactivate your own admin account"
                                  : u.active
                                  ? "Deactivate user account"
                                  : "Activate user account"
                              }
                            >
                              {u.active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Industry Profile Settings */}
      {activeTab === "profile" && (
        <div className="max-w-3xl bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                <span>Industry Profile & Working Calendar</span>
                <span className="text-xs sm:text-sm font-normal text-slate-500 leading-normal">
                  (የድርጅት መገለጫ እና የሥራ ቀናት)
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-0.5">
                Company working calendar, calendar system, and default measurement unit
              </p>
            </div>
          </div>

          {profileMsg && (
            <div
              role="alert"
              className={`alert text-xs sm:text-sm py-3 px-4 rounded-2xl flex items-center gap-2.5 border ${
                profileMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-950 border-emerald-300"
                  : "bg-rose-50 text-rose-950 border-rose-300"
              }`}
            >
              {profileMsg.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium leading-relaxed">{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Company Name <span className="text-slate-400 font-normal leading-normal">(የድርጅቱ ስም)</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input input-bordered w-full min-h-[44px] text-sm rounded-xl focus:border-indigo-600 bg-white"
                placeholder="e.g. Acme Garment Manufacturing Plc"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Calendar System <span className="text-slate-400 font-normal leading-normal">(የዘመን አቆጣጠር)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCalendarSystem("ethiopian")}
                  className={`p-3.5 rounded-2xl border text-left transition-all touch-manipulation min-h-[72px] ${
                    calendarSystem === "ethiopian"
                      ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Ethiopian Calendar (EC)</span>
                    <span className="text-xs font-semibold text-indigo-700 leading-normal">
                      (የኢትዮጵያ ዘመን አቆጣጠር)
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                    13-month calendar used officially across Ethiopian industries and holidays
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCalendarSystem("gregorian")}
                  className={`p-3.5 rounded-2xl border text-left transition-all touch-manipulation min-h-[72px] ${
                    calendarSystem === "gregorian"
                      ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Gregorian Calendar (GC)</span>
                    <span className="text-xs font-semibold text-slate-600 leading-normal">
                      (የጎርጎሮሳውያን ዘመን አቆጣጠር)
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Standard international 12-month calendar system
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Working Days <span className="text-slate-400 font-normal leading-normal">(የሥራ ቀናት)</span>
              </label>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                Unchecked days are excluded from daily production target calculations and plans.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {DAYS.map(({ day, label, amLabel }) => {
                  const isChecked = workingDays.includes(day);
                  return (
                    <label
                      key={day}
                      className={`min-h-[48px] flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all touch-manipulation ${
                        isChecked
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600/20"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleDayToggle(day)}
                        className="checkbox checkbox-xs checkbox-primary rounded"
                      />
                      <span className="text-xs leading-normal">
                        {label} <span className="opacity-70 font-normal">({amLabel})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Unit of Measure <span className="text-slate-400 font-normal leading-normal">(የመለኪያ አሃድ)</span>
              </label>
              <input
                type="text"
                required
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="input input-bordered w-full min-h-[44px] text-sm rounded-xl focus:border-indigo-600 bg-white"
                placeholder="e.g. pcs, cartons, kg, meters"
              />
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="btn btn-primary w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none text-white font-bold shadow-md shadow-indigo-100 touch-manipulation"
            >
              {profileSaving ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                "Save Profile Settings"
              )}
            </button>
          </form>
        </div>
      )}

      {/* Modal 1: Provision User with Role Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl inline-flex items-center justify-center">
                  <Shield className="w-5 h-5 text-indigo-600 shrink-0" />
                </span>
                <span>Provision New User</span>
                <span className="text-xs font-normal text-slate-500 leading-normal">
                  (አዲስ ተጠቃሚ መዝግብ)
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center text-base"
                aria-label="✕"
              >
                ✕
              </button>
            </div>

            {userError && (
              <div
                role="alert"
                className="alert alert-error text-xs sm:text-sm py-2.5 px-3.5 rounded-2xl bg-rose-50 text-rose-950 border border-rose-200 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="leading-relaxed break-words">{userError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-slate-400 font-normal leading-normal">(ሙሉ ስም)</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Solomon Tadesse (ሰለሞን ታደሰ)"
                  className="input input-bordered w-full min-h-[44px] text-sm rounded-xl focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-slate-400 font-normal leading-normal">(ኢሜይል አድራሻ)</span>
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="input input-bordered w-full min-h-[44px] text-sm rounded-xl focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Role Assignment <span className="text-slate-400 font-normal leading-normal">(የተጠቃሚው ሚና)</span>
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as Role)}
                  className="select select-bordered w-full min-h-[44px] text-sm rounded-xl font-medium focus:border-indigo-600"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLES_METADATA[r]?.label} ({ROLES_METADATA[r]?.shortLabel}) - {ROLE_AMHARIC_LABELS[r]?.amLabel}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  {ROLES_METADATA[newUserRole]?.description}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Temporary Password <span className="text-slate-400 font-normal leading-normal">(ጊዜያዊ የይለፍ ቃል)</span>
                </label>
                <div className="join w-full">
                  <input
                    type="text"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="join-item input input-bordered w-full min-h-[44px] text-sm font-mono rounded-l-xl focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(newUserPassword);
                      setPasswordCopied(true);
                      setTimeout(() => setPasswordCopied(false), 2000);
                    }}
                    className="btn join-item btn-outline min-h-[44px] rounded-r-xl text-xs gap-1.5 font-bold touch-manipulation px-4"
                  >
                    {passwordCopied ? (
                      <>
                        <CheckCheck className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  The user will be required to change this upon their first login.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="btn min-h-[44px] btn-ghost rounded-xl font-bold touch-manipulation w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSaving}
                  className="btn min-h-[44px] btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none font-bold shadow-xs touch-manipulation w-full sm:w-auto"
                >
                  {userSaving ? "Provisioning..." : "Provision User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Admin Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 my-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>Reset User Password</span>
                    <span className="text-xs font-normal text-slate-500 leading-normal">
                      (የይለፍ ቃል ዳግም ማስጀመር)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Set a new password directly for this account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center text-base"
                aria-label="✕"
              >
                ✕
              </button>
            </div>

            {/* Target User Info Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 break-words leading-relaxed">
                  {resetModalUser.name}
                </div>
                <div className="text-xs text-slate-500 font-mono break-all">
                  {resetModalUser.email}
                </div>
              </div>
              <span
                className={`badge badge-sm font-bold uppercase text-[10px] tracking-wider shrink-0 ${
                  ROLES_METADATA[resetModalUser.role]?.badgeClass || "badge-ghost"
                }`}
              >
                {ROLES_METADATA[resetModalUser.role]?.shortLabel || resetModalUser.role}
              </span>
            </div>

            {resetError && (
              <div
                role="alert"
                className="alert alert-error text-xs sm:text-sm py-2.5 px-3.5 rounded-2xl bg-rose-50 text-rose-950 border border-rose-200 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="leading-relaxed break-words">{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    New Password <span className="text-slate-400 font-normal leading-normal">(አዲስ የይለፍ ቃል)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPasswordValue(generateRandomPassword());
                      setResetCopied(false);
                    }}
                    className="min-h-[36px] sm:min-h-[32px] px-2 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 touch-manipulation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Generate New</span>
                  </button>
                </div>

                <div className="join w-full">
                  <input
                    type="text"
                    required
                    minLength={12}
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    className="join-item input input-bordered w-full min-h-[44px] text-sm font-mono rounded-l-xl focus:border-indigo-600"
                    placeholder="Enter min. 12 characters..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordValue);
                      setResetCopied(true);
                      setTimeout(() => setResetCopied(false), 2000);
                    }}
                    className="btn join-item btn-outline border-slate-200 rounded-r-xl min-h-[44px] text-xs gap-1.5 font-bold touch-manipulation px-4"
                    title="Copy password to clipboard"
                  >
                    {resetCopied ? (
                      <>
                        <CheckCheck className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Must be at least 12 characters long (Argon2id encrypted).
                </p>
              </div>

              {/* Force Password Change Checkbox */}
              <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80">
                <label className="label cursor-pointer justify-start gap-2.5 p-0">
                  <input
                    type="checkbox"
                    checked={resetMustChangePassword}
                    onChange={(e) => setResetMustChangePassword(e.target.checked)}
                    className="checkbox checkbox-sm checkbox-warning rounded-lg"
                  />
                  <span className="label-text text-xs text-slate-800 font-semibold leading-relaxed">
                    Require user to change password at next login{" "}
                    <span className="text-slate-500 font-normal">(በሚቀጥለው ሲገቡ የይለፍ ቃል እንዲቀይሩ ጠይቅ)</span>
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 ml-6 mt-1 leading-relaxed">
                  Active sessions for this user will be revoked immediately for security.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  disabled={resetSaving}
                  className="btn min-h-[44px] btn-ghost rounded-xl font-bold touch-manipulation w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSaving || resetPasswordValue.length < 12}
                  className="btn min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-5 border-none shadow-xs touch-manipulation w-full sm:w-auto"
                >
                  {resetSaving ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    "Reset & Save Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
