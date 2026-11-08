"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFactoryAction,
  provisionFactoryUserAction,
  toggleFactoryUserStatusAction,
  updateFactoryUserRoleAction,
  toggleQAProductAssignmentAction,
} from "@/actions/om-actions";
import {
  Building2,
  Users,
  Grid,
  Plus,
  Check,
  AlertCircle,
  Shield,
  Layers,
  ChevronRight,
  Copy,
  CheckCheck,
} from "lucide-react";

interface OMClientProps {
  factories: Array<{
    id: string;
    name: string;
    omId: string | null;
    active: boolean;
    createdAt: Date;
  }>;
  factoryUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    mustChangePassword: boolean;
    createdAt: Date;
    factoryId: string;
    factoryName: string;
  }>;
  matrixData: {
    qaUsers: Array<{
      id: string;
      name: string;
      email: string;
      active: boolean;
      factoryId: string;
      factoryName: string;
    }>;
    productsList: Array<{
      id: string;
      name: string;
      sku: string;
      factoryId: string;
      factoryName: string;
    }>;
    assignments: Array<{
      qaUserId: string;
      productId: string;
    }>;
  };
}

export function OMClient({ factories, factoryUsers, matrixData }: OMClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"factories" | "users" | "matrix">("factories");

  // Create Factory Modal
  const [facModalOpen, setFacModalOpen] = useState(false);
  const [facName, setFacName] = useState("");
  const [facSaving, setFacSaving] = useState(false);
  const [facError, setFacError] = useState<string | null>(null);

  // Provision User Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("TemporaryPass123!");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [userRole, setUserRole] = useState<"fm" | "qa">("fm");
  const [userFactoryId, setUserFactoryId] = useState(factories[0]?.id || "");
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Matrix Optimistic / Pending state
  const [pendingAssignment, setPendingAssignment] = useState<string | null>(null);

  // Role Assignment change state & notification
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleRoleChange = async (userId: string, newRole: "fm" | "qa") => {
    setUpdatingRoleId(userId);
    setToastMsg(null);
    const res = await updateFactoryUserRoleAction(userId, newRole);
    setUpdatingRoleId(null);
    if (res.success) {
      setToastMsg({
        type: "success",
        text: `Role reassigned to ${newRole === "fm" ? "Factory Manager" : "QA Inspector"} successfully.`,
      });
      setTimeout(() => setToastMsg(null), 3500);
      router.refresh();
    } else {
      setToastMsg({ type: "error", text: res.error || "Failed to update role." });
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  // Submit Create Factory
  const handleCreateFactory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFacSaving(true);
    setFacError(null);

    const res = await createFactoryAction({ name: facName.trim() });
    setFacSaving(false);
    if (res.success) {
      setFacModalOpen(false);
      setFacName("");
      router.refresh();
    } else {
      setFacError(res.error || "Failed to create factory");
    }
  };

  // Submit Provision User
  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSaving(true);
    setUserError(null);

    const res = await provisionFactoryUserAction({
      name: userName.trim(),
      email: userEmail.trim(),
      password: userPassword,
      role: userRole,
      factoryId: userFactoryId,
    });

    setUserSaving(false);
    if (res.success) {
      setUserModalOpen(false);
      setUserName("");
      setUserEmail("");
      setUserPassword("TemporaryPass123!");
      router.refresh();
    } else {
      setUserError(res.error || "Failed to provision user");
    }
  };

  // Toggle user active status
  const handleToggleUserStatus = async (userId: string, currentActive: boolean) => {
    await toggleFactoryUserStatusAction(userId, !currentActive);
    router.refresh();
  };

  // Toggle QA Matrix Checkbox
  const handleAssignmentToggle = async (qaUserId: string, productId: string, isAssigned: boolean) => {
    const key = `${qaUserId}_${productId}`;
    setPendingAssignment(key);

    await toggleQAProductAssignmentAction({
      qaUserId,
      productId,
      assigned: !isAssigned,
    });

    setPendingAssignment(null);
    router.refresh();
  };

  const isAssigned = (qaUserId: string, productId: string) => {
    return matrixData.assignments.some(
      (a) => a.qaUserId === qaUserId && a.productId === productId
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs Header */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("factories")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "factories"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Factories Overview ({factories.length})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "users"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          Factory Teams ({factoryUsers.length})
        </button>
        <button
          onClick={() => setActiveTab("matrix")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "matrix"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Grid className="w-4 h-4" />
          QA Assignment Matrix
        </button>
      </div>

      {/* TAB 1: Factories */}
      {activeTab === "factories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Operating Plants
              </h2>
              <p className="text-xs text-slate-500">
                Industrial bottling and packaging facilities managed by your division
              </p>
            </div>
            <button
              onClick={() => setFacModalOpen(true)}
              className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Factory
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {factories.map((f) => (
              <div
                key={f.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span
                    className={`badge badge-sm ${
                      f.active ? "badge-success text-white" : "badge-ghost"
                    }`}
                  >
                    {f.active ? "Active" : "Archived"}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base mt-4">
                  {f.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">ID: {f.id}</p>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Created {new Date(f.createdAt).toLocaleDateString()}</span>
                  <span className="text-indigo-600 font-medium flex items-center">
                    Operational <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Users (FM & QA) */}
      {activeTab === "users" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Factory Personnel & Role Assignment
              </h2>
              <p className="text-xs text-slate-500">
                Provision Factory Managers and Quality Assurance inspectors and reassign roles directly.
              </p>
            </div>
            <button
              onClick={() => setUserModalOpen(true)}
              className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Provision Team Member
            </button>
          </div>

          {toastMsg && (
            <div
              className={`alert text-xs py-2 px-3 rounded-xl flex items-center gap-2 ${
                toastMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {toastMsg.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span>{toastMsg.text}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            {factoryUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No factory team members provisioned yet.
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                    <th>Name / Email</th>
                    <th>Current Role</th>
                    <th>Assign Role</th>
                    <th>Assigned Factory</th>
                    <th>Status</th>
                    <th>Password Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {factoryUsers.map((u) => {
                    const isUpdating = updatingRoleId === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td>
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm font-semibold uppercase text-[10px] tracking-wider ${
                              u.role === "fm"
                                ? "badge-secondary text-white"
                                : "badge-accent text-white"
                            }`}
                          >
                            {u.role === "fm" ? "Factory Mgr" : "QA Inspector"}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <select
                              disabled={isUpdating}
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as "fm" | "qa")
                              }
                              className="select select-bordered select-xs rounded-lg text-xs font-medium cursor-pointer focus:border-indigo-600"
                            >
                              <option value="fm">Factory Manager (FM)</option>
                              <option value="qa">QA Inspector (QA)</option>
                            </select>
                            {isUpdating && (
                              <span className="loading loading-spinner loading-xs text-indigo-600"></span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="font-medium text-slate-700">{u.factoryName}</span>
                        </td>
                        <td>
                          {u.active ? (
                            <span className="badge badge-sm badge-success text-white">
                              Active
                            </span>
                          ) : (
                            <span className="badge badge-sm badge-ghost text-slate-400">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td>
                          {u.mustChangePassword ? (
                            <span className="badge badge-sm badge-warning text-amber-900">
                              Temporary
                            </span>
                          ) : (
                            <span className="badge badge-sm badge-ghost text-slate-400">
                              Changed
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleToggleUserStatus(u.id, u.active)}
                            className={`btn btn-xs rounded-lg ${
                              u.active
                                ? "btn-ghost text-red-600 hover:bg-red-50"
                                : "btn-ghost text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
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

      {/* TAB 3: QA Product Assignment Matrix */}
      {activeTab === "matrix" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="pb-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">
              QA Product Assignment Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign Quality Assurance inspectors to products. QA users can only submit inspections for products assigned to them.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            {matrixData.qaUsers.length === 0 || matrixData.productsList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Ensure you have active QA inspectors and Products created to build assignments.
              </div>
            ) : (
              <table className="table w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-3 px-4 font-bold text-slate-700 text-xs uppercase tracking-wider">
                      QA Inspector
                    </th>
                    {matrixData.productsList.map((p) => (
                      <th
                        key={p.id}
                        className="py-3 px-4 text-center font-bold text-slate-700 text-xs uppercase tracking-wider"
                      >
                        <div>{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          SKU: {p.sku} ({p.factoryName})
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixData.qaUsers.map((qa) => (
                    <tr key={qa.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{qa.name}</div>
                        <div className="text-xs text-slate-500 font-normal">
                          {qa.email} • {qa.factoryName}
                        </div>
                      </td>
                      {matrixData.productsList.map((prod) => {
                        const assigned = isAssigned(qa.id, prod.id);
                        const isPending = pendingAssignment === `${qa.id}_${prod.id}`;
                        return (
                          <td key={prod.id} className="py-3 px-4 text-center">
                            <label className="inline-flex items-center justify-center p-2 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                              <input
                                type="checkbox"
                                disabled={isPending}
                                checked={assigned}
                                onChange={() => handleAssignmentToggle(qa.id, prod.id, assigned)}
                                className="checkbox checkbox-primary checkbox-sm rounded-md"
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal: New Factory */}
      {facModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Create New Factory Plant
              </h3>
              <button
                onClick={() => setFacModalOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400"
              >
                ✕
              </button>
            </div>

            {facError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl mt-4 bg-red-50 text-red-700 border border-red-200">
                <span>{facError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFactory} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Factory Name
                </label>
                <input
                  type="text"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  placeholder="e.g. Hawassa Agro-Processing Plant"
                  className="input input-bordered w-full text-sm rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFacModalOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facSaving}
                  className="btn btn-sm btn-primary rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                >
                  {facSaving ? "Creating..." : "Create Factory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Provision User */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Provision Factory Team Member
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

            <form onSubmit={handleProvisionUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Abebe Kebede"
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
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="input input-bordered w-full text-sm rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Role
                  </label>
                  <select
                    className="select select-bordered w-full text-sm rounded-xl"
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as "fm" | "qa")}
                  >
                    <option value="fm">Factory Manager (FM)</option>
                    <option value="qa">QA Inspector (QA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Factory Assignment
                  </label>
                  <select
                    className="select select-bordered w-full text-sm rounded-xl"
                    value={userFactoryId}
                    onChange={(e) => setUserFactoryId(e.target.value)}
                    required
                  >
                    {factories.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Temporary Password
                </label>
                <div className="join w-full">
                  <input
                    type="text"
                    required
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="join-item input input-bordered w-full text-sm font-mono rounded-l-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(userPassword);
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
                  Forced password change is enabled for first login.
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
                  {userSaving ? "Provisioning..." : "Provision Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
