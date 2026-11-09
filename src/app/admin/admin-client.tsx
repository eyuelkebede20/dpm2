"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateIndustryProfileAction,
  createOperationManagerAction,
  createUserAction,
  updateUserRoleAction,
  toggleUserActiveAction,
  adminResetPasswordAction,
} from "@/actions/admin-actions";
import { Role, ROLES_METADATA, ALL_ROLES } from "@/lib/rbac-types";
import {
  Building,
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
  Filter,
  KeyRound,
  RotateCcw,
  X,
  Lock,
} from "lucide-react";

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

interface AdminClientProps {
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
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

export function AdminClient({
  initialProfile,
  initialOms,
  initialUsers = [],
  currentUserId,
  impersonationCandidates = [],
  isDevImpersonationEnabled = false,
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
          className={`alert text-xs py-2.5 px-4 rounded-xl flex items-center justify-between shadow-md transition-all ${
            roleActionToast.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
              : "bg-red-50 text-red-900 border border-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {roleActionToast.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span className="font-medium">{roleActionToast.text}</span>
          </div>
        </div>
      )}

      

      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === "roles"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Role Assignment & Users
          <span
            className={`badge badge-sm font-mono text-[10px] ${
              activeTab === "roles"
                ? "bg-white text-indigo-700 border-none font-bold"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {usersList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === "profile"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Settings className="w-4 h-4" />
          Industry Profile Settings
        </button>
      </div>

      {/* TAB 1: Role Assigning Table & User Provisioning */}
      {activeTab === "roles" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Role Assignment Table
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage all accounts and assign Better Auth RBAC roles directly with one click.
              </p>
            </div>

            <button
              onClick={() => setUserModalOpen(true)}
              className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Provision New User
            </button>
          </div>

          {/* Filter Bar & Search */}
          <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search accounts by name, email, or role..."
                  className="input input-sm input-bordered w-full pl-9 pr-8 text-xs font-medium rounded-xl bg-white focus:border-indigo-600 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter & Count */}
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="select select-bordered select-sm bg-white text-xs font-bold rounded-xl focus:border-indigo-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="must_change">Needs Password Change</option>
                </select>

                <div className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80 whitespace-nowrap">
                  Showing <b className="text-indigo-600">{filteredUsers.length}</b> of {usersList.length}
                </div>
              </div>
            </div>

            {/* Role Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                Role:
              </span>
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`btn btn-xs rounded-lg font-bold transition-all ${
                  roleFilter === "all"
                    ? "bg-slate-900 text-white border-none shadow-2xs"
                    : "btn-ghost bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                All ({usersList.length})
              </button>
              {ALL_ROLES.map((r) => {
                const count = usersList.filter((u) => u.role === r).length;
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`btn btn-xs rounded-lg font-bold transition-all ${
                      roleFilter === r
                        ? "bg-indigo-600 text-white border-none shadow-2xs"
                        : "btn-ghost bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {ROLES_METADATA[r]?.shortLabel || r} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* The Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No users found matching the selected filter.
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-4">Assign Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Password</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUserId === u.id;
                    const meta = ROLES_METADATA[u.role];
                    const isUpdating = updatingRoleId === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {u.name}
                            {isSelf && (
                              <span className="badge badge-xs badge-outline text-indigo-600 font-normal">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`badge badge-sm font-semibold uppercase text-[10px] tracking-wider ${
                              meta?.badgeClass || "badge-ghost"
                            }`}
                          >
                            {meta?.shortLabel || u.role}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <select
                              disabled={isSelf || isUpdating}
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as Role)
                              }
                              className={`select select-bordered select-xs rounded-lg text-xs font-medium focus:border-indigo-600 ${
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
                                  {ROLES_METADATA[r]?.label}
                                </option>
                              ))}
                            </select>
                            {isUpdating && (
                              <span className="loading loading-spinner loading-xs text-indigo-600"></span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
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

                        <td className="py-3 px-4">
                          {u.mustChangePassword ? (
                            <span className="badge badge-sm badge-warning text-amber-900 font-medium">
                              Temporary
                            </span>
                          ) : (
                            <span className="badge badge-sm badge-ghost text-slate-400">
                              Permanent
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenResetModal(u)}
                              className="btn btn-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg gap-1 font-bold shadow-2xs"
                              title={`Reset password for ${u.name}`}
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset Password</span>
                            </button>

                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => handleToggleActive(u.id, u.active)}
                              className={`btn btn-xs rounded-lg font-bold ${
                                isSelf
                                  ? "btn-ghost text-slate-300 cursor-not-allowed"
                                  : u.active
                                  ? "btn-ghost text-rose-600 hover:bg-rose-50"
                                  : "btn-ghost text-emerald-600 hover:bg-emerald-50"
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
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Industry Profile & Working Calendar
              </h2>
              <p className="text-xs text-slate-500">
                Company working calendar, calendar system, and default measurement unit
              </p>
            </div>
          </div>

          {profileMsg && (
            <div
              className={`alert mt-4 text-xs py-2.5 px-3 rounded-xl flex items-center gap-2 ${
                profileMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {profileMsg.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5 mt-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Company Name
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input input-bordered w-full text-sm rounded-xl focus:border-indigo-600"
                placeholder="e.g. Acme Garment Manufacturing Plc"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Calendar System
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCalendarSystem("ethiopian")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    calendarSystem === "ethiopian"
                      ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-900">
                    Ethiopian Calendar (EC)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    13-month calendar used in Ethiopia
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCalendarSystem("gregorian")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    calendarSystem === "gregorian"
                      ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-900">
                    Gregorian Calendar (GC)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Standard Western international calendar
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Working Days
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Unchecked days are excluded from daily production target calculations.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DAYS.map(({ day, label }) => {
                  const isChecked = workingDays.includes(day);
                  return (
                    <label
                      key={day}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                        isChecked
                          ? "border-indigo-600 bg-indigo-50/40 text-indigo-950 font-semibold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleDayToggle(day)}
                        className="checkbox checkbox-xs checkbox-primary rounded"
                      />
                      <span className="text-xs">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Unit of Measure
              </label>
              <input
                type="text"
                required
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="input input-bordered w-full text-sm rounded-xl focus:border-indigo-600"
                placeholder="e.g. pcs, cartons, kg, liters"
              />
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="btn btn-primary w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none text-white font-medium shadow-md shadow-indigo-100"
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

      

      {/* Provision User with Role Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Provision New User
              </h3>
              <button
                onClick={() => setUserModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400"
              >
                ✕
              </button>
            </div>

            {userError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl mt-4 bg-red-50 text-red-700 border border-red-200">
                <span>{userError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Solomon Tadesse"
                  className="input input-bordered w-full text-sm rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="input input-bordered w-full text-sm rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Role Assignment
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as Role)}
                  className="select select-bordered w-full text-sm rounded-xl font-medium"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLES_METADATA[r]?.label} ({ROLES_METADATA[r]?.shortLabel})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {ROLES_METADATA[newUserRole]?.description}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Temporary Password
                </label>
                <div className="join w-full">
                  <input
                    type="text"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="join-item input input-bordered w-full text-sm font-mono rounded-l-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(newUserPassword);
                      setPasswordCopied(true);
                      setTimeout(() => setPasswordCopied(false), 2000);
                    }}
                    className="btn join-item btn-outline rounded-r-xl text-xs gap-1 font-bold"
                  >
                    {passwordCopied ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  The user will be required to change this upon their first login.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSaving}
                  className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                >
                  {userSaving ? "Provisioning..." : "Provision User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Reset User Password
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Set a new password directly for this account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Target User Info Card */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {resetModalUser.name}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {resetModalUser.email}
                </div>
              </div>
              <span
                className={`badge badge-sm font-bold uppercase text-[10px] tracking-wider ${
                  ROLES_METADATA[resetModalUser.role]?.badgeClass || "badge-ghost"
                }`}
              >
                {ROLES_METADATA[resetModalUser.role]?.shortLabel || resetModalUser.role}
              </span>
            </div>

            {resetError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPasswordValue(generateRandomPassword());
                      setResetCopied(false);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
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
                    className="join-item input input-bordered w-full text-sm font-mono rounded-l-xl focus:border-indigo-600"
                    placeholder="Enter min. 12 characters..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordValue);
                      setResetCopied(true);
                      setTimeout(() => setResetCopied(false), 2000);
                    }}
                    className="btn join-item btn-outline border-slate-200 rounded-r-xl text-xs gap-1 font-bold"
                    title="Copy password to clipboard"
                  >
                    {resetCopied ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Must be at least 12 characters long (Argon2id encrypted).
                </p>
              </div>

              {/* Force Password Change Checkbox */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                <label className="label cursor-pointer justify-start gap-2.5 p-0">
                  <input
                    type="checkbox"
                    checked={resetMustChangePassword}
                    onChange={(e) => setResetMustChangePassword(e.target.checked)}
                    className="checkbox checkbox-sm checkbox-warning rounded-lg"
                  />
                  <span className="label-text text-xs text-slate-700 font-semibold">
                    Require user to change password at next login
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                  Active sessions for this user will be revoked immediately for security.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  disabled={resetSaving}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSaving || resetPasswordValue.length < 12}
                  className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-4 border-none shadow-xs"
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
