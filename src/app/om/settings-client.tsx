"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  seedYearlySpecialDaysAction,
  createSpecialDayAction,
  deleteSpecialDayAction,
  createDowntimeReasonAction,
  toggleDowntimeReasonActiveAction,
  updateDowntimeReasonAction,
} from "@/actions/om-actions";
import {
  CalendarDays,
  Sparkles,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  Pencil,
  Tag,
  Calendar,
  X,
  Filter,
} from "lucide-react";

export type SpecialDayType =
  | "holiday"
  | "shutdown"
  | "custom_off_day"
  | "working_day"
  | "weekend"
  | "custom";

export interface SpecialDayItem {
  id: string;
  date: string; // YYYY-MM-DD
  nameEn: string;
  nameAm?: string | null;
  type: string;
  isWorkingDay: boolean;
  year?: number | null;
  createdAt?: Date | string;
}

export type DowntimeCategoryType =
  | "tooling"
  | "machine"
  | "power"
  | "material"
  | "quality"
  | "safety"
  | "other";

export interface DowntimeReasonItem {
  id: string;
  code: string;
  nameEn: string;
  nameAm?: string | null;
  category: DowntimeCategoryType | string;
  active: boolean;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: Date | string;
}

interface OMSettingsClientProps {
  initialSpecialDays?: SpecialDayItem[];
  initialDowntimeReasons?: DowntimeReasonItem[];
}

export function OMSettingsClient({
  initialSpecialDays = [],
  initialDowntimeReasons = [],
}: OMSettingsClientProps) {
  const router = useRouter();

  // -------------------------------------------------------------
  // Section 1: Special Days & Holidays State
  // -------------------------------------------------------------
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [specialDaysList, setSpecialDaysList] = useState<SpecialDayItem[]>(initialSpecialDays);
  const [seeding, setSeeding] = useState(false);
  const [specialModalOpen, setSpecialModalOpen] = useState(false);
  const [savingSpecial, setSavingSpecial] = useState(false);
  const [specialError, setSpecialError] = useState<string | null>(null);

  // New Special Day Form
  const [newDate, setNewDate] = useState<string>(`${selectedYear}-01-01`);
  const [newNameEn, setNewNameEn] = useState<string>("");
  const [newNameAm, setNewNameAm] = useState<string>("");
  const [newType, setNewType] = useState<SpecialDayType>("holiday");
  const [newIsWorkingDay, setNewIsWorkingDay] = useState<boolean>(false);

  // Year filter for special days table
  const [filterYear, setFilterYear] = useState<number | "all">("all");

  // -------------------------------------------------------------
  // Section 2: Downtime Reason Templates State
  // -------------------------------------------------------------
  const [reasonsList, setReasonsList] = useState<DowntimeReasonItem[]>(
    initialDowntimeReasons.map((r) => ({
      ...r,
      active: r.active !== undefined ? r.active : (r.isActive ?? true),
    }))
  );
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [savingReason, setSavingReason] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  // New Reason Form
  const [newReasonCode, setNewReasonCode] = useState<string>("");
  const [newReasonNameEn, setNewReasonNameEn] = useState<string>("");
  const [newReasonNameAm, setNewReasonNameAm] = useState<string>("");
  const [newReasonCategory, setNewReasonCategory] = useState<DowntimeCategoryType>("machine");

  // Edit Reason Modal
  const [editingReason, setEditingReason] = useState<DowntimeReasonItem | null>(null);

  // Global Toast
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // -------------------------------------------------------------
  // Actions: Special Days
  // -------------------------------------------------------------
  const handleSeedHolidays = async () => {
    setSeeding(true);
    setSpecialError(null);
    try {
      const res = await seedYearlySpecialDaysAction(selectedYear);
      setSeeding(false);
      if (res.success) {
        showToast(
          "success",
          `Successfully seeded yearly Ethiopian holidays for ${selectedYear} (${res.count || 13} days).`
        );
        // Optimistic refresh with standard holiday set if empty or updating
        const standardHolidays: SpecialDayItem[] = [
          {
            id: `sp_${selectedYear}_0107`,
            date: `${selectedYear}-01-07`,
            nameEn: "Ethiopian Christmas (Genna)",
            nameAm: "የገና በዓል",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0119`,
            date: `${selectedYear}-01-19`,
            nameEn: "Timkat (Epiphany)",
            nameAm: "ጥምቀት በዓል",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0302`,
            date: `${selectedYear}-03-02`,
            nameEn: "Victory of Adwa",
            nameAm: "የዓድዋ ድል በዓል",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0320`,
            date: `${selectedYear}-03-20`,
            nameEn: "Eid al-Fitr (End of Ramadan)",
            nameAm: "ዒድ አልፈጥር",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0501`,
            date: `${selectedYear}-05-01`,
            nameEn: "International Workers' Day",
            nameAm: "የሠራተኞች ቀን",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0505`,
            date: `${selectedYear}-05-05`,
            nameEn: "Patriots' Victory Day",
            nameAm: "የአርበኞች ቀን",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0508`,
            date: `${selectedYear}-05-08`,
            nameEn: "Ethiopian Good Friday (Siklet)",
            nameAm: "ስቅለት",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0510`,
            date: `${selectedYear}-05-10`,
            nameEn: "Ethiopian Easter (Fasika)",
            nameAm: "ትንሣኤ (ፋሲካ)",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0527`,
            date: `${selectedYear}-05-27`,
            nameEn: "Eid al-Adha (Arafa)",
            nameAm: "ዒድ አል አድሃ (አረፋ)",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0528`,
            date: `${selectedYear}-05-28`,
            nameEn: "Downfall of Derg Day",
            nameAm: "ደርግ የወደቀበት ቀን",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0826`,
            date: `${selectedYear}-08-26`,
            nameEn: "Mawlid (Prophet's Birthday)",
            nameAm: "መውሊድ",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0911`,
            date: `${selectedYear}-09-11`,
            nameEn: "Ethiopian New Year (Enkutatash)",
            nameAm: "እንቁጣጣሽ (አዲስ ዓመት)",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
          {
            id: `sp_${selectedYear}_0927`,
            date: `${selectedYear}-09-27`,
            nameEn: "Meskel (Finding of True Cross)",
            nameAm: "መስቀል (ደመራ)",
            type: "holiday",
            isWorkingDay: false,
            year: selectedYear,
          },
        ];

        setSpecialDaysList((prev) => {
          const filtered = prev.filter((d) => d.year !== selectedYear);
          return [...filtered, ...standardHolidays].sort((a, b) => a.date.localeCompare(b.date));
        });

        router.refresh();
      } else {
        showToast("error", res.error || "Failed to seed yearly holidays");
      }
    } catch {
      setSeeding(false);
      showToast("error", "Error contacting server to seed holidays");
    }
  };

  const handleCreateSpecialDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSpecial(true);
    setSpecialError(null);

    const payload = {
      date: newDate,
      nameEn: newNameEn.trim(),
      nameAm: newNameAm.trim() || newNameEn.trim(),
      type: newType,
      isWorkingDay: newIsWorkingDay,
    };

    const res = await createSpecialDayAction(payload);
    setSavingSpecial(false);

    if (res.success) {
      showToast("success", `Special date "${newNameEn}" added successfully.`);
      const year = parseInt(newDate.split("-")[0], 10);
      const newItem: SpecialDayItem = {
        id: `sp_local_${Date.now()}`,
        ...payload,
        year,
      };

      setSpecialDaysList((prev) =>
        [...prev.filter((d) => d.date !== newDate), newItem].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );

      setSpecialModalOpen(false);
      setNewNameEn("");
      setNewNameAm("");
      setNewIsWorkingDay(false);
      router.refresh();
    } else {
      setSpecialError(res.error || "Failed to create special day");
    }
  };

  const handleDeleteSpecialDay = async (id: string) => {
    const res = await deleteSpecialDayAction(id);
    if (res.success) {
      showToast("success", "Special day deleted.");
      setSpecialDaysList((prev) => prev.filter((d) => d.id !== id));
      router.refresh();
    } else {
      showToast("error", res.error || "Failed to delete special day");
    }
  };

  // -------------------------------------------------------------
  // Actions: Downtime Reasons
  // -------------------------------------------------------------
  const handleCreateReason = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReason(true);
    setReasonError(null);

    const payload = {
      code: newReasonCode.trim().toUpperCase(),
      nameEn: newReasonNameEn.trim(),
      nameAm: newReasonNameAm.trim() || newReasonNameEn.trim(),
      category: newReasonCategory,
      active: true,
    };

    const res = await createDowntimeReasonAction(payload);
    setSavingReason(false);

    if (res.success) {
      showToast("success", `Downtime reason template "${payload.code}" added.`);
      const newItem: DowntimeReasonItem = {
        id: `dtr_local_${Date.now()}`,
        ...payload,
      };
      setReasonsList((prev) => [...prev, newItem].sort((a, b) => a.code.localeCompare(b.code)));

      setReasonModalOpen(false);
      setNewReasonCode("");
      setNewReasonNameEn("");
      setNewReasonNameAm("");
      setNewReasonCategory("machine");
      router.refresh();
    } else {
      setReasonError(res.error || "Failed to create reason template");
    }
  };

  const handleToggleReason = async (id: string, currentActive: boolean) => {
    const newActive = !currentActive;
    // Optimistic toggle
    setReasonsList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: newActive, isActive: newActive } : r))
    );

    const res = await toggleDowntimeReasonActiveAction(id, newActive);
    if (res.success) {
      showToast("success", `Reason status updated to ${newActive ? "Active" : "Inactive"}.`);
      router.refresh();
    } else {
      // Revert on failure
      setReasonsList((prev) =>
        prev.map((r) => (r.id === id ? { ...r, active: currentActive, isActive: currentActive } : r))
      );
      showToast("error", res.error || "Failed to toggle reason status");
    }
  };

  const handleUpdateReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReason) return;

    setSavingReason(true);
    setReasonError(null);

    const res = await updateDowntimeReasonAction(editingReason.id, {
      code: editingReason.code,
      nameEn: editingReason.nameEn,
      nameAm: editingReason.nameAm,
      category: editingReason.category,
      active: editingReason.active,
    });

    setSavingReason(false);
    if (res.success) {
      showToast("success", `Reason template "${editingReason.code}" updated.`);
      setReasonsList((prev) =>
        prev.map((r) => (r.id === editingReason.id ? { ...editingReason } : r))
      );
      setEditingReason(null);
      router.refresh();
    } else {
      setReasonError(res.error || "Failed to update reason template");
    }
  };

  // Filtered special days
  const filteredSpecialDays =
    filterYear === "all"
      ? specialDaysList
      : specialDaysList.filter((d) => d.year === filterYear || d.date.startsWith(`${filterYear}-`));

  // Category Color Badge Helper
  const getCategoryBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case "tooling":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "machine":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "power":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "material":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "quality":
        return "bg-cyan-100 text-cyan-800 border-cyan-300";
      case "safety":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "holiday":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "shutdown":
        return "bg-red-100 text-red-800 border-red-200";
      case "custom_off_day":
      case "custom":
        return "bg-slate-100 text-slate-800 border-slate-200";
      case "working_day":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* Global Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className={`alert text-xs py-2.5 px-4 rounded-xl flex items-center justify-between transition-all shadow-md ${
            toastMsg.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span className="font-medium">{toastMsg.text}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 1: Special Date Setter & Yearly Calendar Seeding  */}
      {/* ========================================================= */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CalendarDays className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Special Date Setter & Yearly Calendar Seeding
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure public holidays, factory shutdowns, and special working days that adjust daily target calculation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Year:</span>
              <select
                aria-label="Select Year"
                value={selectedYear}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedYear(val);
                  setNewDate(`${val}-01-01`);
                }}
                className="select select-bordered select-sm rounded-xl font-bold text-slate-800 bg-white border-slate-200 focus:border-emerald-600"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
                <option value={2028}>2028</option>
              </select>
            </div>

            {/* Prominent Green Button */}
            <button
              onClick={handleSeedHolidays}
              disabled={seeding}
              style={{ backgroundColor: "#059669" }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 text-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {seeding
                  ? "Seeding Holidays..."
                  : "Seed Yearly Ethiopian Holidays (የዓመቱ የኢትዮጵያ በዓላት መዝግብ)"}
              </span>
            </button>

            {/* Add Special Date Button */}
            <button
              onClick={() => {
                setSpecialModalOpen(true);
                setSpecialError(null);
              }}
              className="btn btn-sm rounded-xl bg-slate-900 hover:bg-slate-800 text-white border-none flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Special Date</span>
            </button>
          </div>
        </div>

        {/* Filters and List Counts */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              Configured Special Days: {filteredSpecialDays.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter View by Year:</span>
            <select
              aria-label="Filter View by Year"
              value={filterYear}
              onChange={(e) =>
                setFilterYear(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="select select-bordered select-xs rounded-lg bg-white border-slate-200"
            >
              <option value="all">All Years</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2028}>2028</option>
            </select>
          </div>
        </div>

        {/* Configured Special Days Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="table w-full text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">English Name</th>
                <th className="py-3 px-4">Amharic Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Working Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSpecialDays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No special dates configured yet for this selection. Click{" "}
                    <strong className="text-emerald-700">
                      Seed Yearly Ethiopian Holidays
                    </strong>{" "}
                    to populate official national holidays.
                  </td>
                </tr>
              ) : (
                filteredSpecialDays.map((day) => (
                  <tr key={day.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {day.date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{day.nameEn}</td>
                    <td className="py-3 px-4 text-slate-600">{day.nameAm || "—"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getTypeBadge(
                          day.type
                        )}`}
                      >
                        {day.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {day.isWorkingDay ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Working
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-800 border border-rose-300 font-bold px-2.5 py-0.5 rounded-full text-xs inline-flex items-center gap-1">
                          <X className="w-3 h-3" />
                          Factory Off
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteSpecialDay(day.id)}
                        className="btn btn-ghost btn-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Delete Special Day"
                        aria-label={`Delete ${day.nameEn}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="ml-1">Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 2: Non-Completion & Downtime Reason Templates     */}
      {/* ========================================================= */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Non-Completion & Downtime Reason Templates
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configured by Operation Manager to categorize downtime or negative variance explanations.
            </p>
          </div>

          <button
            onClick={() => {
              setReasonModalOpen(true);
              setReasonError(null);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 px-4 py-2 text-sm shadow-md transition-all self-start md:self-center"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Reason Template</span>
          </button>
        </div>

        {/* Downtime Reasons Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="table w-full text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Name (EN & AM)</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {reasonsList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    No downtime reason templates configured yet. Click{" "}
                    <strong className="text-emerald-700">+ Add Reason Template</strong> to add one.
                  </td>
                </tr>
              ) : (
                reasonsList.map((reason) => (
                  <tr key={reason.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {reason.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{reason.nameEn}</div>
                      {reason.nameAm && (
                        <div className="text-xs text-slate-500 mt-0.5">{reason.nameAm}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getCategoryBadge(
                          reason.category
                        )}`}
                      >
                        {reason.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <label className="cursor-pointer inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Toggle active status for ${reason.code}`}
                          className="toggle toggle-success toggle-sm"
                          checked={reason.active}
                          onChange={() => handleToggleReason(reason.id, reason.active)}
                        />
                        <span
                          className={`text-xs font-semibold ${
                            reason.active ? "text-emerald-700" : "text-slate-400"
                          }`}
                        >
                          {reason.active ? "Active" : "Inactive"}
                        </span>
                      </label>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditingReason(reason);
                          setReasonError(null);
                        }}
                        className="btn btn-ghost btn-xs text-indigo-600 hover:bg-indigo-50 rounded-lg mr-1"
                        aria-label={`Edit ${reason.code}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="ml-1">Edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleReason(reason.id, reason.active)}
                        className={`btn btn-xs rounded-lg border-none ${
                          reason.active
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                        }`}
                        aria-label={`Toggle ${reason.code}`}
                      >
                        {reason.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================= */}
      {/* MODAL 1: Add Special Date                                 */}
      {/* ========================================================= */}
      {specialModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-lg">Add Special Date or Holiday</h3>
              </div>
              <button
                onClick={() => setSpecialModalOpen(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400"
              >
                ✕
              </button>
            </div>

            {specialError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl flex items-center gap-2 text-white">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{specialError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSpecialDay} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date (YYYY-MM-DD) *
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="input input-bordered input-sm w-full rounded-xl"
                  aria-label="Special Date"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  English Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Factory Maintenance Shutdown"
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  className="input input-bordered input-sm w-full rounded-xl"
                  aria-label="English Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amharic Name (የበዓሉ/የዕረፍቱ ስም)
                </label>
                <input
                  type="text"
                  placeholder="e.g. የፋብሪካ ጥገና ዕረፍት"
                  value={newNameAm}
                  onChange={(e) => setNewNameAm(e.target.value)}
                  className="input input-bordered input-sm w-full rounded-xl"
                  aria-label="Amharic Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date Type *
                </label>
                <select
                  aria-label="Date Type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as SpecialDayType)}
                  className="select select-bordered select-sm w-full rounded-xl"
                >
                  <option value="holiday">Holiday (የህዝብ በዓል)</option>
                  <option value="shutdown">Shutdown (የፋብሪካ መዘጋት)</option>
                  <option value="custom_off_day">Custom Off-Day (ልዩ የዕረፍት ቀን)</option>
                  <option value="working_day">Working Day (የሥራ ቀን)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="cursor-pointer flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="checkbox"
                    checked={newIsWorkingDay}
                    onChange={(e) => setNewIsWorkingDay(e.target.checked)}
                    className="checkbox checkbox-success checkbox-sm rounded"
                    aria-label="Is Working Day"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800">Is Working Day</span>
                    <span className="text-slate-500 block">
                      Check if machines operate on this day (counts toward target calculation).
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSpecialModalOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSpecial}
                  className="btn btn-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-none font-bold"
                >
                  {savingSpecial ? "Saving..." : "Add Special Date"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: Add Reason Template                              */}
      {/* ========================================================= */}
      {reasonModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-lg">Add Reason Template</h3>
              </div>
              <button
                onClick={() => setReasonModalOpen(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400"
              >
                ✕
              </button>
            </div>

            {reasonError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl flex items-center gap-2 text-white">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{reasonError}</span>
              </div>
            )}

            <form onSubmit={handleCreateReason} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Code (e.g. DOW-10) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DOW-10"
                  value={newReasonCode}
                  onChange={(e) => setNewReasonCode(e.target.value)}
                  className="input input-bordered input-sm w-full rounded-xl font-mono uppercase"
                  aria-label="Reason Code"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Name English *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generator Fuel Depletion"
                  value={newReasonNameEn}
                  onChange={(e) => setNewReasonNameEn(e.target.value)}
                  className="input input-bordered input-sm w-full rounded-xl"
                  aria-label="Reason English Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Name Amharic (የምክንያቱ ስም በአማርኛ)
                </label>
                <input
                  type="text"
                  placeholder="e.g. የጄኔሬተር ነዳጅ ማለቅ"
                  value={newReasonNameAm}
                  onChange={(e) => setNewReasonNameAm(e.target.value)}
                  className="input input-bordered input-sm w-full rounded-xl"
                  aria-label="Reason Amharic Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  aria-label="Reason Category"
                  value={newReasonCategory}
                  onChange={(e) => setNewReasonCategory(e.target.value as DowntimeCategoryType)}
                  className="select select-bordered select-sm w-full rounded-xl capitalize"
                >
                  <option value="tooling">Tooling (ሻጋታ / መሣሪያ)</option>
                  <option value="machine">Machine (ማሽን ብልሽት)</option>
                  <option value="power">Power (የኤሌክትሪክ ኃይል)</option>
                  <option value="material">Material (ጥሬ ዕቃ)</option>
                  <option value="quality">Quality (ጥራት ምርመራ)</option>
                  <option value="safety">Safety (የደህንነት ክስተት)</option>
                  <option value="other">Other (ሌላ ምክንያት)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReasonModalOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReason}
                  className="btn btn-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-none font-bold"
                >
                  {savingReason ? "Saving..." : "Add Reason Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: Edit Reason Template                             */}
      {/* ========================================================= */}
      {editingReason && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-lg">
                  Edit Reason Template: {editingReason.code}
                </h3>
              </div>
              <button
                onClick={() => setEditingReason(null)}
                className="btn btn-sm btn-ghost btn-circle text-slate-400"
              >
                ✕
              </button>
            </div>

            {reasonError && (
              <div className="alert alert-error text-xs py-2 px-3 rounded-xl flex items-center gap-2 text-white">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{reasonError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateReason} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  value={editingReason.code}
                  onChange={(e) =>
                    setEditingReason({ ...editingReason, code: e.target.value.toUpperCase() })
                  }
                  className="input input-bordered input-sm w-full rounded-xl font-mono uppercase"
                  aria-label="Edit Code"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Name English *
                </label>
                <input
                  type="text"
                  required
                  value={editingReason.nameEn}
                  onChange={(e) =>
                    setEditingReason({ ...editingReason, nameEn: e.target.value })
                  }
                  className="input input-bordered input-sm w-full rounded-xl"
                  aria-label="Edit English Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Name Amharic
                </label>
                <input
                  type="text"
                  value={editingReason.nameAm || ""}
                  onChange={(e) =>
                    setEditingReason({ ...editingReason, nameAm: e.target.value })
                  }
                  className="input input-bordered input-sm w-full rounded-xl"
                  aria-label="Edit Amharic Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  aria-label="Edit Category"
                  value={editingReason.category}
                  onChange={(e) =>
                    setEditingReason({
                      ...editingReason,
                      category: e.target.value as DowntimeCategoryType,
                    })
                  }
                  className="select select-bordered select-sm w-full rounded-xl capitalize"
                >
                  <option value="tooling">Tooling</option>
                  <option value="machine">Machine</option>
                  <option value="power">Power</option>
                  <option value="material">Material</option>
                  <option value="quality">Quality</option>
                  <option value="safety">Safety</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingReason(null)}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReason}
                  className="btn btn-sm rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-none font-bold"
                >
                  {savingReason ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
