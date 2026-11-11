"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createFactoryAction,
  provisionFactoryUserAction,
  toggleFactoryUserStatusAction,
  updateFactoryUserRoleAction,
  toggleQAProductAssignmentAction,
  bulkAssignQAProductsAction,
  getOMFactoryCalendarDataAction,
} from "@/actions/om-actions";
import { SearchInput } from "@/components/ui";
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
  CalendarCog,
  Calendar as CalendarIcon,
  ArrowLeft,
  Package,
  Wrench,
  Sparkles,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronDown,
  Search,
  X,
  Filter,
} from "lucide-react";
import { OMSettingsClient } from "./settings-client";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { format } from "date-fns";
import {
  gregorianToEth,
  getEthiopianMonthRange,
} from "@/lib/ethiopian-calendar";

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
  initialSpecialDays?: any[];
  initialDowntimeReasons?: any[];
  linesList?: Array<{
    id: string;
    factoryId: string;
    name: string;
    code?: string;
    active: boolean;
  }>;
}

export function OMClient({
  factories,
  factoryUsers,
  matrixData,
  initialSpecialDays,
  initialDowntimeReasons,
  linesList = [],
}: OMClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "factories" | "users" | "matrix" | "settings"
  >("factories");

  // Selected Factory Plant Hub State
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null);
  const [plantSubTab, setPlantSubTab] = useState<
    "calendar" | "teams" | "matrix" | "lines"
  >("calendar");

  // Factory Plant Calendar State
  const [plantCalendarData, setPlantCalendarData] = useState<{
    workingDays: number[];
    entries: any[];
    plans: any[];
    specialDays: any[];
  } | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

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
  const [selectedQAProductIds, setSelectedQAProductIds] = useState<string[]>([]);

  // User Search and Filter State (Factory Teams tab & Plant Team subtab)
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "fm" | "qa">("all");
  const [userFactoryFilter, setUserFactoryFilter] = useState<string>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "active" | "inactive" | "must_change">("all");
  const [plantUserSearchQuery, setPlantUserSearchQuery] = useState("");

  // Matrix Optimistic / Pending state
  const [pendingAssignment, setPendingAssignment] = useState<string | null>(null);
  const [matrixPlantFilter, setMatrixPlantFilter] = useState<string>("all");
  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>("");
  const [bulkAssigningUserId, setBulkAssigningUserId] = useState<string | null>(null);

  // Role Assignment change state & notification
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Today in Gregorian and Ethiopian
  const today = useMemo(() => new Date(), []);
  const todayGC = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const currentGregMonth = useMemo(() => format(today, "yyyy-MM"), [today]);
  const currentEth = useMemo(() => gregorianToEth(todayGC), [todayGC]);

  const ethRange = useMemo(() => {
    return getEthiopianMonthRange(currentEth.year, currentEth.month);
  }, [currentEth]);

  // Selected Factory Object
  const selectedFactory = useMemo(() => {
    if (!selectedFactoryId) return null;
    return factories.find((f) => f.id === selectedFactoryId) || null;
  }, [factories, selectedFactoryId]);

  // Products belonging to the currently selected or modal factory
  const factoryProductsForModal = useMemo(() => {
    const targetFacId = userFactoryId || selectedFactoryId || factories[0]?.id;
    return matrixData.productsList.filter((p) => p.factoryId === targetFacId);
  }, [matrixData.productsList, userFactoryId, selectedFactoryId, factories]);

  // Load factory calendar data when a factory is selected or calendar sub-tab opened
  useEffect(() => {
    if (!selectedFactoryId) {
      setPlantCalendarData(null);
      return;
    }

    let isCancelled = false;
    async function loadCalendar() {
      setCalendarLoading(true);
      const res = await getOMFactoryCalendarDataAction(
        selectedFactoryId!,
        ethRange.from,
        ethRange.to
      );
      if (!isCancelled) {
        setCalendarLoading(false);
        if (res.success && res.data) {
          setPlantCalendarData(res.data);
        } else {
          setPlantCalendarData(null);
        }
      }
    }

    loadCalendar();
    return () => {
      isCancelled = true;
    };
  }, [selectedFactoryId, ethRange]);

  // Open provision modal pre-configured for a specific factory
  const handleOpenProvisionForFactory = (facId?: string) => {
    const targetId = facId || selectedFactoryId || factories[0]?.id || "";
    setUserFactoryId(targetId);
    setUserName("");
    setUserEmail("");
    setUserPassword("TemporaryPass123!");
    setUserRole("fm");
    setSelectedQAProductIds([]);
    setUserError(null);
    setUserModalOpen(true);
  };

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

  // Submit Provision User (with QA product assignments)
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
      assignedProductIds: userRole === "qa" ? selectedQAProductIds : undefined,
    });

    setUserSaving(false);
    if (res.success) {
      setUserModalOpen(false);
      setUserName("");
      setUserEmail("");
      setUserPassword("TemporaryPass123!");
      setSelectedQAProductIds([]);
      setToastMsg({
        type: "success",
        text: `Provisioned ${userName} successfully${
          userRole === "qa" && selectedQAProductIds.length > 0
            ? ` with ${selectedQAProductIds.length} QA product assignment(s)`
            : ""
        }.`,
      });
      setTimeout(() => setToastMsg(null), 4000);
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

  // Bulk QA Product Assignment (Assign all / Clear all for a QA user in a plant)
  const handleBulkAssignment = async (
    qaUserId: string,
    productIds: string[],
    assignAll: boolean
  ) => {
    setBulkAssigningUserId(qaUserId);
    try {
      const res = await bulkAssignQAProductsAction({
        qaUserId,
        productIds,
        assignAll,
      });
      if (res.success) {
        setToastMsg({
          type: "success",
          text: assignAll
            ? "All products assigned to inspector"
            : "Product assignments cleared for inspector",
        });
      } else {
        setToastMsg({ type: "error", text: res.error || "Failed to update assignments" });
      }
      setTimeout(() => setToastMsg(null), 3000);
      router.refresh();
    } catch (err) {
      setToastMsg({ type: "error", text: "Failed to update assignments" });
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setBulkAssigningUserId(null);
    }
  };

  const isAssigned = (qaUserId: string, productId: string) => {
    return matrixData.assignments.some(
      (a) => a.qaUserId === qaUserId && a.productId === productId
    );
  };

  // Filtered lists for the selected factory
  const plantTeamUsers = useMemo(() => {
    if (!selectedFactoryId) return [];
    return factoryUsers.filter((u) => u.factoryId === selectedFactoryId);
  }, [factoryUsers, selectedFactoryId]);

  // Filtered factory users for the Global Factory Teams (users) tab
  const filteredFactoryUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase().trim();
    return factoryUsers.filter((u) => {
      if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
      if (userFactoryFilter !== "all" && u.factoryId !== userFactoryFilter) return false;
      if (userStatusFilter === "active" && !u.active) return false;
      if (userStatusFilter === "inactive" && u.active) return false;
      if (userStatusFilter === "must_change" && !u.mustChangePassword) return false;

      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.factoryName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [factoryUsers, userSearchQuery, userRoleFilter, userFactoryFilter, userStatusFilter]);

  // Filtered plant team users for Plant Hub teams sub-tab
  const filteredPlantTeamUsers = useMemo(() => {
    const q = plantUserSearchQuery.toLowerCase().trim();
    return plantTeamUsers.filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [plantTeamUsers, plantUserSearchQuery]);

  const plantQAUsers = useMemo(() => {
    if (!selectedFactoryId) return [];
    return matrixData.qaUsers.filter((q) => q.factoryId === selectedFactoryId);
  }, [matrixData.qaUsers, selectedFactoryId]);

  const plantProducts = useMemo(() => {
    if (!selectedFactoryId) return [];
    return matrixData.productsList.filter((p) => p.factoryId === selectedFactoryId);
  }, [matrixData.productsList, selectedFactoryId]);

  const plantLines = useMemo(() => {
    if (!selectedFactoryId) return [];
    return linesList.filter((l) => l.factoryId === selectedFactoryId);
  }, [linesList, selectedFactoryId]);

  return (
    <div className="space-y-6">
      {/* Global Toast */}
      {toastMsg && (
        <div
          className={`alert text-xs py-2.5 px-4 rounded-2xl flex items-center gap-2 shadow-md animate-in fade-in duration-200 ${
            toastMsg.type === "success"
              ? "bg-emerald-600 text-white font-bold"
              : "bg-rose-600 text-white font-bold"
          }`}
        >
          {toastMsg.type === "success" ? (
            <Check className="w-4 h-4 text-white" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Main OM Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-1 sm:gap-2">
        <button
          onClick={() => {
            setActiveTab("factories");
            // If returning from another tab, preserve selected factory
          }}
          className={`py-3 px-4 sm:px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors shrink-0 min-h-[44px] ${
            activeTab === "factories"
              ? "border-emerald-600 text-emerald-800 font-extrabold bg-emerald-50/40 sm:bg-transparent rounded-t-xl sm:rounded-none"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Operating Plants ({factories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`py-3 px-4 sm:px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors shrink-0 min-h-[44px] ${
            activeTab === "users"
              ? "border-emerald-600 text-emerald-800 font-extrabold bg-emerald-50/40 sm:bg-transparent rounded-t-xl sm:rounded-none"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Factory Teams ({factoryUsers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("matrix")}
          className={`py-3 px-4 sm:px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors shrink-0 min-h-[44px] ${
            activeTab === "matrix"
              ? "border-emerald-600 text-emerald-800 font-extrabold bg-emerald-50/40 sm:bg-transparent rounded-t-xl sm:rounded-none"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>QA Assignment Matrix</span>
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`py-3 px-4 sm:px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors shrink-0 min-h-[44px] ${
            activeTab === "settings"
              ? "border-emerald-600 text-emerald-800 font-extrabold bg-emerald-50/40 sm:bg-transparent rounded-t-xl sm:rounded-none"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CalendarCog className="w-4 h-4" />
          <span className="leading-relaxed">Settings & Calendars (ቅንብሮች)</span>
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: OPERATING PLANTS & SPECIFIC FACTORY HUB                */}
      {/* ============================================================= */}
      {activeTab === "factories" && (
        <div className="space-y-6">
          {/* VIEW A: Full List of Operating Plants (Clickable cards) */}
          {!selectedFactoryId && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                    <span>Operating Plants</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any plant to inspect its specific Calendar, Teams, Lines, and QA product matrix.
                  </p>
                </div>
                <button
                  onClick={() => setFacModalOpen(true)}
                  className="btn btn-sm min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Factory</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {factories.map((f) => {
                  const membersCount = factoryUsers.filter((u) => u.factoryId === f.id).length;
                  const plantProductsCount = matrixData.productsList.filter((p) => p.factoryId === f.id).length;
                  const plantLinesCount = linesList.filter((l) => l.factoryId === f.id).length;

                  return (
                    <div
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      aria-label={f.name}
                      onClick={() => {
                        setSelectedFactoryId(f.id);
                        setPlantSubTab("calendar");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedFactoryId(f.id);
                          setPlantSubTab("calendar");
                        }
                      }}
                      className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-md hover:border-emerald-500 cursor-pointer transition-all group flex flex-col justify-between text-left focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <span
                            className={`badge badge-sm font-bold ${
                              f.active ? "bg-emerald-100 text-emerald-800 border-none" : "badge-ghost text-slate-400"
                            }`}
                          >
                            {f.active ? "Active" : "Archived"}
                          </span>
                        </div>

                        <h3 className="font-black text-slate-900 text-lg mt-3 group-hover:text-emerald-700 transition-colors">
                          {f.name}
                        </h3>
                        <p className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">ID: {f.id}</p>

                        {/* Quick Statistics Strip */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Team</span>
                            <span className="font-mono tabular-nums font-bold text-slate-800 text-xs">{membersCount}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Lines</span>
                            <span className="font-mono tabular-nums font-bold text-slate-800 text-xs">{plantLinesCount}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Products</span>
                            <span className="font-mono tabular-nums font-bold text-slate-800 text-xs">{plantProductsCount}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800 min-h-[36px]">
                        <span>Open Plant Hub</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW B: Specific Plant Operations Hub */}
          {selectedFactory && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Plant Header & Back Button */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedFactoryId(null)}
                      className="btn btn-sm min-h-[44px] btn-ghost rounded-xl text-xs font-bold gap-1 text-slate-600 hover:text-slate-900 px-3"
                      title="Back to All Plants"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Plants</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                          {selectedFactory.name}
                        </h2>
                        <span className="badge badge-sm bg-emerald-100 text-emerald-800 font-bold border-none">
                          Plant Operations Hub
                        </span>
                        <span className="badge badge-sm bg-slate-100 text-slate-700 font-bold border-none">
                          {selectedFactory.active ? "Active" : "Archived"}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        Plant Hub ID: {selectedFactory.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenProvisionForFactory(selectedFactory.id)}
                      className="btn btn-sm min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs border-none gap-1.5 px-4"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Personnel to Plant</span>
                    </button>
                  </div>
                </div>

                {/* Plant Sub-Navigation Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 min-h-[44px]">
                  <button
                    type="button"
                    onClick={() => setPlantSubTab("calendar")}
                    className={`btn btn-sm min-h-[44px] rounded-xl font-bold text-xs gap-1.5 shrink-0 px-3.5 ${
                      plantSubTab === "calendar"
                        ? "bg-slate-900 text-white border-none shadow-xs"
                        : "btn-ghost text-slate-600"
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4 text-emerald-400" />
                    <span>Calendar & Production</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlantSubTab("teams")}
                    className={`btn btn-sm min-h-[44px] rounded-xl font-bold text-xs gap-1.5 shrink-0 px-3.5 ${
                      plantSubTab === "teams"
                        ? "bg-slate-900 text-white border-none shadow-xs"
                        : "btn-ghost text-slate-600"
                    }`}
                  >
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Plant Team ({plantTeamUsers.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlantSubTab("matrix")}
                    className={`btn btn-sm min-h-[44px] rounded-xl font-bold text-xs gap-1.5 shrink-0 px-3.5 ${
                      plantSubTab === "matrix"
                        ? "bg-slate-900 text-white border-none shadow-xs"
                        : "btn-ghost text-slate-600"
                    }`}
                  >
                    <Grid className="w-4 h-4 text-emerald-400" />
                    <span>QA Matrix ({plantQAUsers.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlantSubTab("lines")}
                    className={`btn btn-sm min-h-[44px] rounded-xl font-bold text-xs gap-1.5 shrink-0 px-3.5 ${
                      plantSubTab === "lines"
                        ? "bg-slate-900 text-white border-none shadow-xs"
                        : "btn-ghost text-slate-600"
                    }`}
                  >
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Lines & Products ({plantLines.length}/{plantProducts.length})</span>
                  </button>
                </div>
              </div>

              {/* SUB-VIEW 1: Factory Calendar */}
              {plantSubTab === "calendar" && (
                <div>
                  {calendarLoading ? (
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-2xs space-y-3">
                      <span className="loading loading-spinner loading-md text-emerald-600"></span>
                      <p className="text-sm font-bold text-slate-600">Loading plant production calendar...</p>
                    </div>
                  ) : plantCalendarData ? (
                    <CalendarClient
                      factoryId={selectedFactory.id}
                      factoryName={selectedFactory.name}
                      workingDays={plantCalendarData.workingDays}
                      calendarType="ethiopian"
                      ethiopianYear={currentEth.year}
                      ethiopianMonth={currentEth.month}
                      gregorianMonthStr={currentGregMonth}
                      startDateStr={ethRange.from}
                      endDateStr={ethRange.to}
                      entries={plantCalendarData.entries}
                      plans={plantCalendarData.plans}
                      specialDays={plantCalendarData.specialDays}
                    />
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center text-slate-400 text-sm">
                      No production entries recorded for this plant yet.
                    </div>
                  )}
                </div>
              )}

              {/* SUB-VIEW 2: Factory Team Members */}
              {plantSubTab === "teams" && (
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        {selectedFactory.name} Personnel
                      </h3>
                      <p className="text-xs text-slate-500">
                        Assigned Factory Managers and QA Inspectors for this facility.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenProvisionForFactory(selectedFactory.id)}
                      className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs border-none gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Personnel & Set QA</span>
                    </button>
                  </div>

                  {/* Plant Team Search Bar */}
                  {plantTeamUsers.length > 0 && (
                    <SearchInput
                      value={plantUserSearchQuery}
                      onChange={(e) => setPlantUserSearchQuery(e.target.value)}
                      onClear={() => setPlantUserSearchQuery("")}
                      placeholder="Search personnel by name, email, or role..."
                      maxWidthClass="max-w-md"
                    />
                  )}

                  <div className="overflow-x-auto">
                    {plantTeamUsers.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">
                        No team members assigned to {selectedFactory.name} yet.
                        <div className="mt-3">
                          <button
                            onClick={() => handleOpenProvisionForFactory(selectedFactory.id)}
                            className="btn btn-sm bg-emerald-600 text-white font-bold rounded-xl"
                          >
                            + Provision First Member
                          </button>
                        </div>
                      </div>
                    ) : filteredPlantTeamUsers.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        No members found matching &ldquo;{plantUserSearchQuery}&rdquo;.
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setPlantUserSearchQuery("")}
                            className="btn btn-xs btn-outline btn-neutral rounded-lg"
                          >
                            Clear Search
                          </button>
                        </div>
                      </div>
                    ) : (
                      <table className="table w-full text-sm">
                        <thead>
                          <tr className="text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                            <th>Name / Email</th>
                            <th>Role</th>
                            <th>Reassign Role</th>
                            <th>Assigned QA Products</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPlantTeamUsers.map((u) => {
                            const isUpdating = updatingRoleId === u.id;
                            const assignedProds = matrixData.productsList.filter((p) =>
                              matrixData.assignments.some(
                                (a) => a.qaUserId === u.id && a.productId === p.id
                              )
                            );

                            return (
                              <tr key={u.id} className="hover:bg-slate-50/50">
                                <td>
                                  <div className="font-bold text-slate-900">{u.name}</div>
                                  <div className="text-xs text-slate-500">{u.email}</div>
                                </td>
                                <td>
                                  <span
                                    className={`badge badge-sm font-bold uppercase text-[10px] ${
                                      u.role === "fm"
                                        ? "bg-slate-900 text-white"
                                        : "bg-emerald-100 text-emerald-800 border-none"
                                    }`}
                                  >
                                    {u.role === "fm" ? "Factory Mgr" : "QA Inspector"}
                                  </span>
                                </td>
                                <td>
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      disabled={isUpdating}
                                      value={u.role}
                                      onChange={(e) =>
                                        handleRoleChange(u.id, e.target.value as "fm" | "qa")
                                      }
                                      className="select select-bordered select-xs rounded-lg text-xs font-medium cursor-pointer"
                                    >
                                      <option value="fm">Factory Manager (FM)</option>
                                      <option value="qa">QA Inspector (QA)</option>
                                    </select>
                                    {isUpdating && (
                                      <span className="loading loading-spinner loading-xs text-emerald-600"></span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  {u.role === "qa" ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {assignedProds.length > 0 ? (
                                        assignedProds.map((p) => (
                                          <span
                                            key={p.id}
                                            className="badge badge-xs bg-slate-100 border border-slate-200 text-slate-700 font-medium"
                                          >
                                            {p.name}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-xs text-slate-400 italic">None assigned</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">All Factory Lines (FM)</span>
                                  )}
                                </td>
                                <td>
                                  <span
                                    className={`badge badge-sm font-bold ${
                                      u.active ? "bg-emerald-100 text-emerald-800 border-none" : "badge-ghost text-slate-400"
                                    }`}
                                  >
                                    {u.active ? "Active" : "Inactive"}
                                  </span>
                                </td>
                                <td>
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

              {/* SUB-VIEW 3: QA Matrix for Selected Plant */}
              {plantSubTab === "matrix" && (
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                        <Grid className="w-5 h-5 text-emerald-600" />
                        <span>QA Product Assignment Matrix ({selectedFactory.name})</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure QA inspector product permissions specifically for products manufactured in {selectedFactory.name}.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-700 font-mono">
                        {plantQAUsers.length} QA Inspectors
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-bold text-emerald-800 font-mono">
                        {plantProducts.length} Products
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setUserFactoryId(selectedFactory.id);
                          setUserRole("qa");
                          setUserName("");
                          setUserEmail("");
                          setUserPassword("TemporaryPass123!");
                          setSelectedQAProductIds([]);
                          setUserError(null);
                          setUserModalOpen(true);
                        }}
                        className="btn btn-xs sm:btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs border-none gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add QA Inspector</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                    {plantQAUsers.length === 0 || plantProducts.length === 0 ? (
                      <div className="text-center py-12 px-4 text-slate-400 text-sm">
                        {plantQAUsers.length === 0 ? (
                          <div className="space-y-3">
                            <Shield className="w-8 h-8 text-slate-300 mx-auto" />
                            <div className="font-bold text-slate-700">
                              No QA Inspectors provisioned for {selectedFactory.name}
                            </div>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                              This plant has {plantProducts.length} product{plantProducts.length === 1 ? "" : "s"} ready for inspection. Add a QA Inspector to configure assignments.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setUserFactoryId(selectedFactory.id);
                                setUserRole("qa");
                                setUserName("");
                                setUserEmail("");
                                setUserPassword("TemporaryPass123!");
                                setSelectedQAProductIds([]);
                                setUserError(null);
                                setUserModalOpen(true);
                              }}
                              className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs border-none"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Provision QA Inspector for {selectedFactory.name}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Package className="w-8 h-8 text-slate-300 mx-auto" />
                            <div className="font-bold text-slate-700">
                              No Products configured for {selectedFactory.name}
                            </div>
                            <p className="text-xs text-slate-400">
                              Products must be registered to this plant before QA inspections can be assigned.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <table className="table w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <th className="py-3 px-4 font-black text-slate-700 text-xs uppercase tracking-wider sticky left-0 bg-slate-50 z-20 min-w-[200px]">
                              <div>QA Inspector</div>
                              <div className="text-[10px] text-slate-400 font-normal normal-case">
                                {plantQAUsers.length} assigned to plant
                              </div>
                            </th>
                            {plantProducts.map((p) => {
                              const assignedInspectorsCount = plantQAUsers.filter((qa) => isAssigned(qa.id, p.id)).length;
                              return (
                                <th
                                  key={p.id}
                                  className="py-3 px-4 text-center font-bold text-slate-700 text-xs uppercase tracking-wider min-w-[130px]"
                                >
                                  <div className="font-black text-slate-900 truncate max-w-[150px] mx-auto" title={p.name}>
                                    {p.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono tabular-nums font-normal bg-slate-200/70 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                    {p.sku}
                                  </div>
                                  <div className="text-[9px] text-emerald-700 font-mono font-normal normal-case mt-0.5">
                                    {assignedInspectorsCount} inspector{assignedInspectorsCount === 1 ? "" : "s"}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {plantQAUsers.map((qa) => {
                            const inspectorAssignedProducts = plantProducts.filter((p) => isAssigned(qa.id, p.id));
                            const isAllAssigned = inspectorAssignedProducts.length === plantProducts.length;
                            const isBulkLoading = bulkAssigningUserId === qa.id;

                            return (
                              <tr key={qa.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-4 sticky left-0 bg-white z-10">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="font-black text-slate-900 text-sm">{qa.name}</div>
                                      <div className="text-xs text-slate-500 font-normal">{qa.email}</div>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                                          inspectorAssignedProducts.length > 0
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-slate-100 text-slate-400"
                                        }`}>
                                          {inspectorAssignedProducts.length} / {plantProducts.length} products
                                        </span>
                                      </div>
                                    </div>

                                    {/* Inspector Row Bulk Actions */}
                                    <div className="flex flex-col gap-1 items-end shrink-0">
                                      <button
                                        type="button"
                                        disabled={isBulkLoading || isAllAssigned}
                                        onClick={() =>
                                          handleBulkAssignment(
                                            qa.id,
                                            plantProducts.map((p) => p.id),
                                            true
                                          )
                                        }
                                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
                                      >
                                        Assign All
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBulkLoading || inspectorAssignedProducts.length === 0}
                                        onClick={() =>
                                          handleBulkAssignment(
                                            qa.id,
                                            plantProducts.map((p) => p.id),
                                            false
                                          )
                                        }
                                        className="text-[10px] font-bold text-slate-400 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
                                      >
                                        Clear All
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                {plantProducts.map((prod) => {
                                  const assigned = isAssigned(qa.id, prod.id);
                                  const isPending = pendingAssignment === `${qa.id}_${prod.id}` || isBulkLoading;

                                  return (
                                    <td key={prod.id} className="py-2 px-3 text-center">
                                      <label className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                        <input
                                          type="checkbox"
                                          aria-label={`Assign ${prod.name} to ${qa.name}`}
                                          disabled={isPending}
                                          checked={assigned}
                                          onChange={() =>
                                            handleAssignmentToggle(qa.id, prod.id, assigned)
                                          }
                                          className="checkbox checkbox-sm checkbox-primary rounded-md"
                                        />
                                      </label>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-VIEW 4: Lines & Products for Selected Plant */}
              {plantSubTab === "lines" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Lines Card */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Production Lines ({plantLines.length})</span>
                    </h4>

                    {plantLines.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        No production lines added to this plant yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {plantLines.map((l) => (
                          <div
                            key={l.id}
                            className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">{l.name}</span>
                              {l.code && <span className="font-mono text-slate-400">Code: {l.code}</span>}
                            </div>
                            <span
                              className={`badge badge-xs font-bold ${
                                l.active ? "bg-emerald-100 text-emerald-800 border-none" : "badge-ghost"
                              }`}
                            >
                              {l.active ? "Active" : "Disabled"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Products Card */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-600" />
                      <span>Manufactured Products ({plantProducts.length})</span>
                    </h4>

                    {plantProducts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        No products configured for this plant yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {plantProducts.map((p) => (
                          <div
                            key={p.id}
                            className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">{p.name}</span>
                              <span className="font-mono text-slate-400">SKU: {p.sku}</span>
                            </div>
                            <span className="badge badge-xs bg-slate-200 text-slate-700 font-mono">
                              Active
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: GLOBAL FACTORY TEAMS (FM & QA)                         */}
      {/* ============================================================= */}
      {activeTab === "users" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Factory Personnel & Role Assignment
              </h2>
              <p className="text-xs text-slate-500">
                Provision Factory Managers and Quality Assurance inspectors and reassign roles directly.
              </p>
            </div>
            <button
              onClick={() => handleOpenProvisionForFactory()}
              className="btn btn-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Provision Team Member
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
            {/* Search Input */}
            <SearchInput
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              onClear={() => setUserSearchQuery("")}
              placeholder="Search personnel by name, email, role, or plant..."
              maxWidthClass="flex-1 max-w-lg"
            />

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Role Filter */}
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value as any)}
                className="select select-xs select-bordered rounded-xl text-xs font-semibold h-8 min-h-0 bg-white"
                aria-label="Filter by Role"
              >
                <option value="all">All Roles</option>
                <option value="fm">Factory Manager (FM)</option>
                <option value="qa">Quality Assurance (QA)</option>
              </select>

              {/* Factory Filter */}
              {factories.length > 0 && (
                <select
                  value={userFactoryFilter}
                  onChange={(e) => setUserFactoryFilter(e.target.value)}
                  className="select select-xs select-bordered rounded-xl text-xs font-semibold h-8 min-h-0 bg-white"
                  aria-label="Filter by Plant"
                >
                  <option value="all">All Plants ({factories.length})</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Status Filter */}
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value as any)}
                className="select select-xs select-bordered rounded-xl text-xs font-semibold h-8 min-h-0 bg-white"
                aria-label="Filter by Status"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="must_change">Pending First Login</option>
              </select>

              {/* Reset Filters Button */}
              {(userSearchQuery || userRoleFilter !== "all" || userFactoryFilter !== "all" || userStatusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setUserSearchQuery("");
                    setUserRoleFilter("all");
                    setUserFactoryFilter("all");
                    setUserStatusFilter("all");
                  }}
                  className="btn btn-xs btn-ghost text-rose-600 font-bold rounded-lg"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Result Count Strip */}
          <div className="text-xs text-slate-500 flex items-center justify-between px-1">
            <span>
              Showing <b className="text-slate-800 font-mono">{filteredFactoryUsers.length}</b> of{" "}
              <b className="font-mono">{factoryUsers.length}</b> team members
            </span>
            {userSearchQuery && (
              <span className="text-slate-400 font-medium truncate max-w-[200px]">
                Matching &ldquo;{userSearchQuery}&rdquo;
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            {factoryUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No factory team members provisioned yet.
              </div>
            ) : filteredFactoryUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No personnel found matching your search and filter criteria.
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUserSearchQuery("");
                      setUserRoleFilter("all");
                      setUserFactoryFilter("all");
                      setUserStatusFilter("all");
                    }}
                    className="btn btn-xs btn-outline btn-neutral rounded-lg"
                  >
                    Reset Filters
                  </button>
                </div>
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
                  {filteredFactoryUsers.map((u) => {
                    const isUpdating = updatingRoleId === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td>
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm font-bold uppercase text-[10px] ${
                              u.role === "fm"
                                ? "bg-slate-900 text-white"
                                : "bg-emerald-100 text-emerald-800 border-none"
                            }`}
                          >
                            {u.role === "fm" ? "Factory Mgr" : "QA Inspector"}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <select
                              disabled={isUpdating}
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(u.id, e.target.value as "fm" | "qa")
                              }
                              className="select select-bordered select-xs rounded-lg text-xs font-medium cursor-pointer"
                            >
                              <option value="fm">Factory Manager (FM)</option>
                              <option value="qa">QA Inspector (QA)</option>
                            </select>
                            {isUpdating && (
                              <span className="loading loading-spinner loading-xs text-emerald-600"></span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="font-bold text-slate-800">{u.factoryName}</span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm font-bold ${
                              u.active ? "bg-emerald-100 text-emerald-800 border-none" : "badge-ghost text-slate-400"
                            }`}
                          >
                            {u.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          {u.mustChangePassword ? (
                            <span className="badge badge-sm bg-amber-100 text-amber-900 border-none font-bold">
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

      {/* ============================================================= */}
      {/* TAB 3: QA PRODUCT ASSIGNMENT MATRIX (PER-PLANT TABLES)        */}
      {/* ============================================================= */}
      {activeTab === "matrix" && (
        <div className="space-y-6">
          {/* Header & Explanatory Banner */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Grid className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    QA Product Assignment Matrix
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Each plant maintains its own dedicated QA product matrix. Assign Quality Assurance inspectors to the specific products produced at their facility.
                </p>
              </div>

              {/* Summary KPIs */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-700 font-mono">
                  {factories.length} Plant{factories.length === 1 ? "" : "s"}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-bold text-emerald-800 font-mono">
                  {matrixData.qaUsers.length} QA Inspectors
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200/80 text-xs font-bold text-blue-800 font-mono">
                  {matrixData.productsList.length} Total Products
                </span>
              </div>
            </div>

            {/* Filter Toolbar: Plant Switcher & Search */}
            <div className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Plant Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setMatrixPlantFilter("all")}
                  className={`btn btn-xs rounded-xl font-bold min-h-[36px] px-3.5 transition-all text-xs shrink-0 ${
                    matrixPlantFilter === "all"
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-none"
                  }`}
                >
                  All Plants ({factories.length})
                </button>
                {factories.map((fac) => {
                  const facProds = matrixData.productsList.filter((p) => p.factoryId === fac.id);
                  const isSelected = matrixPlantFilter === fac.id;
                  return (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => setMatrixPlantFilter(fac.id)}
                      className={`btn btn-xs rounded-xl font-bold min-h-[36px] px-3.5 transition-all text-xs shrink-0 ${
                        isSelected
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-none"
                      }`}
                    >
                      <span>{fac.name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isSelected ? "bg-emerald-700 text-emerald-100" : "bg-slate-200 text-slate-700"}`}>
                        {facProds.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Inspector Search Input */}
              <SearchInput
                placeholder="Search QA Inspector..."
                value={matrixSearchQuery}
                onChange={(e) => setMatrixSearchQuery(e.target.value)}
                onClear={() => setMatrixSearchQuery("")}
                maxWidthClass="min-w-[240px] max-w-xs"
              />
            </div>
          </div>

          {/* Plant-by-Plant QA Matrix Tables */}
          <div className="space-y-6">
            {(matrixPlantFilter === "all" ? factories : factories.filter((f) => f.id === matrixPlantFilter)).map((fac) => {
              const plantQA = matrixData.qaUsers.filter((u) => u.factoryId === fac.id);
              const plantProducts = matrixData.productsList.filter((p) => p.factoryId === fac.id);
              const q = matrixSearchQuery.toLowerCase().trim();
              const filteredPlantQA = q
                ? plantQA.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                : plantQA;
              const plantAssignmentsCount = plantQA.reduce(
                (sum, qa) => sum + plantProducts.filter((prod) => isAssigned(qa.id, prod.id)).length,
                0
              );
              const maxPossible = plantQA.length * plantProducts.length;
              const coveragePct = maxPossible > 0 ? Math.round((plantAssignmentsCount / maxPossible) * 100) : 0;

              return (
                <div
                  key={`matrix_fac_${fac.id}`}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4"
                >
                  {/* Plant Header Strip */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold shrink-0">
                        <Building2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-slate-900">
                            {fac.name}
                          </h3>
                          <span className="badge badge-sm badge-ghost font-mono text-[10px]">
                            ID: {fac.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                          <span>{plantQA.length} QA Inspector{plantQA.length === 1 ? "" : "s"}</span>
                          <span>•</span>
                          <span>{plantProducts.length} Product{plantProducts.length === 1 ? "" : "s"}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-700">
                            {plantAssignmentsCount} active assignments ({coveragePct}% coverage)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setUserFactoryId(fac.id);
                          setUserRole("qa");
                          setUserName("");
                          setUserEmail("");
                          setUserPassword("TemporaryPass123!");
                          setSelectedQAProductIds([]);
                          setUserError(null);
                          setUserModalOpen(true);
                        }}
                        className="btn btn-xs sm:btn-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add QA Inspector</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFactoryId(fac.id);
                          setPlantSubTab("matrix");
                        }}
                        className="btn btn-xs sm:btn-sm btn-ghost text-slate-600 hover:text-slate-900 font-bold rounded-xl gap-1"
                      >
                        <span>Plant Hub</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Plant Matrix Table or Empty State */}
                  {plantProducts.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                      <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div className="text-sm font-bold text-slate-700">
                        No Products Registered for {fac.name}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Each plant maintains its own product catalog. Products must be registered in this plant before QA inspectors can be assigned.
                      </p>
                    </div>
                  ) : plantQA.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                      <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div className="text-sm font-bold text-slate-700">
                        No QA Inspectors in {fac.name}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        This plant has {plantProducts.length} product{plantProducts.length === 1 ? "" : "s"} ready for inspection, but no QA Inspectors are provisioned yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setUserFactoryId(fac.id);
                          setUserRole("qa");
                          setUserName("");
                          setUserEmail("");
                          setUserPassword("TemporaryPass123!");
                          setSelectedQAProductIds([]);
                          setUserError(null);
                          setUserModalOpen(true);
                        }}
                        className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs mt-3 border-none"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Provision QA Inspector for {fac.name}</span>
                      </button>
                    </div>
                  ) : filteredPlantQA.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No QA Inspectors in {fac.name} matching &quot;{matrixSearchQuery}&quot;.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                      <table className="table w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <th className="py-3 px-4 font-black text-slate-700 text-xs uppercase tracking-wider sticky left-0 bg-slate-50 z-20 min-w-[200px]">
                              <div>QA Inspector</div>
                              <div className="text-[10px] text-slate-400 font-normal normal-case">
                                {plantQA.length} assigned to plant
                              </div>
                            </th>
                            {plantProducts.map((p) => {
                              const assignedInspectorsCount = plantQA.filter((qa) => isAssigned(qa.id, p.id)).length;
                              return (
                                <th
                                  key={p.id}
                                  className="py-3 px-4 text-center font-bold text-slate-700 text-xs uppercase tracking-wider min-w-[140px]"
                                >
                                  <div className="font-black text-slate-900 truncate max-w-[160px] mx-auto" title={p.name}>
                                    {p.name}
                                  </div>
                                  <div className="flex items-center justify-center gap-1 mt-0.5">
                                    <span className="text-[10px] text-slate-500 font-mono font-normal bg-slate-200/70 px-1.5 py-0.2 rounded">
                                      {p.sku}
                                    </span>
                                  </div>
                                  <div className="text-[9px] text-emerald-700 font-mono font-normal normal-case mt-0.5">
                                    {assignedInspectorsCount} inspector{assignedInspectorsCount === 1 ? "" : "s"}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPlantQA.map((qa) => {
                            const inspectorAssignedProducts = plantProducts.filter((p) => isAssigned(qa.id, p.id));
                            const isAllAssigned = inspectorAssignedProducts.length === plantProducts.length;
                            const isBulkLoading = bulkAssigningUserId === qa.id;

                            return (
                              <tr key={qa.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-4 sticky left-0 bg-white z-10">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="font-black text-slate-900 text-sm">
                                        {qa.name}
                                      </div>
                                      <div className="text-xs text-slate-500 font-normal">
                                        {qa.email}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                                          inspectorAssignedProducts.length > 0
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-slate-100 text-slate-400"
                                        }`}>
                                          {inspectorAssignedProducts.length} / {plantProducts.length} products
                                        </span>
                                      </div>
                                    </div>

                                    {/* Inspector Row Bulk Actions */}
                                    <div className="flex flex-col gap-1 items-end shrink-0">
                                      <button
                                        type="button"
                                        disabled={isBulkLoading || isAllAssigned}
                                        onClick={() =>
                                          handleBulkAssignment(
                                            qa.id,
                                            plantProducts.map((p) => p.id),
                                            true
                                          )
                                        }
                                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
                                      >
                                        Assign All
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBulkLoading || inspectorAssignedProducts.length === 0}
                                        onClick={() =>
                                          handleBulkAssignment(
                                            qa.id,
                                            plantProducts.map((p) => p.id),
                                            false
                                          )
                                        }
                                        className="text-[10px] font-bold text-slate-400 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
                                      >
                                        Clear All
                                      </button>
                                    </div>
                                  </div>
                                </td>

                                {plantProducts.map((prod) => {
                                  const assigned = isAssigned(qa.id, prod.id);
                                  const isPending = pendingAssignment === `${qa.id}_${prod.id}` || isBulkLoading;

                                  return (
                                    <td key={prod.id} className="py-2 px-3 text-center">
                                      <label className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                        <input
                                          type="checkbox"
                                          aria-label={`Assign ${prod.name} to ${qa.name}`}
                                          disabled={isPending}
                                          checked={assigned}
                                          onChange={() =>
                                            handleAssignmentToggle(qa.id, prod.id, assigned)
                                          }
                                          className="checkbox checkbox-primary checkbox-sm rounded-md"
                                        />
                                      </label>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 4: SETTINGS & CALENDARS                                   */}
      {/* ============================================================= */}
      {activeTab === "settings" && (
        <OMSettingsClient
          initialSpecialDays={initialSpecialDays}
          initialDowntimeReasons={initialDowntimeReasons}
        />
      )}

      {/* ============================================================= */}
      {/* MODAL: CREATE NEW FACTORY                                     */}
      {/* ============================================================= */}
      {facModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                Create New Factory Plant
              </h3>
              <button
                type="button"
                onClick={() => setFacModalOpen(false)}
                aria-label="Close modal"
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px]"
              >
                ✕
              </button>
            </div>

            {facError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl mt-4 bg-rose-50 text-rose-700 border border-rose-200">
                <span>{facError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFactory} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Factory Name
                </label>
                <input
                  type="text"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  placeholder="e.g. Hawassa Agro-Processing Plant"
                  className="input input-bordered w-full text-sm rounded-xl font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFacModalOpen(false)}
                  className="btn btn-sm min-h-[44px] btn-ghost rounded-xl font-bold px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facSaving}
                  className="btn btn-sm min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-none px-4"
                >
                  {facSaving ? "Creating..." : "Create Factory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: PROVISION TEAM MEMBER & SET QA PRODUCTS               */}
      {/* ============================================================= */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Provision Team Member & Set QA
                </h3>
                <span className="text-xs text-slate-500">
                  Create credentials and assign quality inspection products
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                aria-label="Close modal"
                className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px]"
              >
                ✕
              </button>
            </div>

            {userError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl mt-3 bg-rose-50 text-rose-700 border border-rose-200">
                <span>{userError}</span>
              </div>
            )}

            <form onSubmit={handleProvisionUser} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Abebe Kebede"
                  className="input input-bordered w-full min-h-[44px] h-11 text-base sm:text-sm rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="input input-bordered w-full min-h-[44px] h-11 text-base sm:text-sm rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="user-role-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Role
                  </label>
                  <select
                    id="user-role-select"
                    aria-label="User Role"
                    className="select select-bordered w-full min-h-[44px] h-11 text-base sm:text-sm rounded-xl font-bold"
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as "fm" | "qa")}
                  >
                    <option value="fm">Factory Manager (FM)</option>
                    <option value="qa">QA Inspector (QA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Factory Plant
                  </label>
                  {selectedFactory ? (
                    <div className="input input-bordered w-full min-h-[44px] h-11 text-base sm:text-sm rounded-xl font-bold bg-slate-50 flex items-center text-slate-700">
                      {selectedFactory.name}
                    </div>
                  ) : (
                    <select
                      aria-label="Factory Plant"
                      className="select select-bordered w-full min-h-[44px] h-11 text-base sm:text-sm rounded-xl font-bold"
                      value={userFactoryId}
                      onChange={(e) => {
                        setUserFactoryId(e.target.value);
                        setSelectedQAProductIds([]); // Reset when factory changes
                      }}
                      required
                    >
                      {factories.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* QA Product Assignment Checklist (Visible when role === "qa") */}
              {userRole === "qa" && (
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 block uppercase tracking-wider leading-relaxed">
                        Set QA Product Inspections & Assign QA Products (የጥራት ቁጥጥር ምርቶች)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Select products this inspector is authorized to evaluate
                      </span>
                    </div>

                    {factoryProductsForModal.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedQAProductIds(factoryProductsForModal.map((p) => p.id))
                          }
                          className="btn btn-xs btn-ghost text-emerald-700 font-bold"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedQAProductIds([])}
                          className="btn btn-xs btn-ghost text-slate-400 font-bold"
                        >
                          None
                        </button>
                      </div>
                    )}
                  </div>

                  {factoryProductsForModal.length === 0 ? (
                    <div className="text-center py-3 text-slate-400 text-xs italic">
                      No products found in this factory. You can still provision the inspector now and configure product assignments later.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pt-1">
                      {factoryProductsForModal.map((prod) => {
                        const isChecked = selectedQAProductIds.includes(prod.id);
                        return (
                          <label
                            key={prod.id}
                            htmlFor={`modal-prod-${prod.id}`}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer min-h-[44px] transition-colors ${
                              isChecked
                                ? "bg-white border-emerald-500 text-slate-900 font-bold shadow-2xs"
                                : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={`modal-prod-${prod.id}`}
                              aria-label={prod.name}
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedQAProductIds((prev) => [...prev, prod.id]);
                                } else {
                                  setSelectedQAProductIds((prev) =>
                                    prev.filter((id) => id !== prod.id)
                                  );
                                }
                              }}
                              className="checkbox checkbox-xs checkbox-primary rounded-md"
                            />
                            <div className="truncate">
                              <span className="block truncate font-medium">{prod.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono tabular-nums font-normal">
                                {prod.sku}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Temporary Password
                </label>
                <div className="join w-full">
                  <input
                    type="text"
                    required
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="join-item input input-bordered w-full min-h-[44px] h-11 text-base sm:text-sm font-mono tabular-nums rounded-l-xl font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(userPassword);
                      setPasswordCopied(true);
                      setTimeout(() => setPasswordCopied(false), 2000);
                    }}
                    className="btn join-item btn-outline rounded-r-xl text-xs gap-1 font-bold min-h-[44px] px-3.5"
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
                  User will be prompted to choose a permanent password on first login.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="btn btn-sm min-h-[44px] btn-ghost rounded-xl font-bold px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSaving}
                  className="btn btn-sm min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-none shadow-xs px-4"
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
