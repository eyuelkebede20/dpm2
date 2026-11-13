"use client";

import { useMemo } from "react";
import {
  gregorianToEth,
  ethToGregorian,
  daysInMonthEth,
  ETH_MONTH_NAMES_AM,
  ETH_MONTH_NAMES_EN,
  formatEthDate,
} from "@/lib/ethiopian-calendar";
import { format, parseISO } from "date-fns";
import { Calendar, Globe, Sparkles } from "lucide-react";

interface PlanDatePickerProps {
  label: string;
  value: string; // ISO date string: YYYY-MM-DD
  onChange: (isoDate: string) => void;
  calendarSystem: "ethiopian" | "gregorian";
  minDate?: string;
  disabled?: boolean;
}

export function PlanDatePicker({
  label,
  value,
  onChange,
  calendarSystem,
  minDate,
  disabled = false,
}: PlanDatePickerProps) {
  // Ethiopian parsed date
  const ethDate = useMemo(() => {
    try {
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return gregorianToEth(value);
      }
    } catch {
      // Fallback to today
    }
    return gregorianToEth(new Date());
  }, [value]);

  const maxEthDays = useMemo(() => {
    return daysInMonthEth(ethDate.year, ethDate.month);
  }, [ethDate.year, ethDate.month]);

  // Handle Ethiopian selector changes
  const handleEthChange = (part: "year" | "month" | "day", numVal: number) => {
    let y = ethDate.year;
    let m = ethDate.month;
    let d = ethDate.day;

    if (part === "year") y = numVal;
    if (part === "month") m = numVal;
    if (part === "day") d = numVal;

    // Clamp day to valid days for that month (e.g. Pagume 5 or 6)
    const maxDays = daysInMonthEth(y, m);
    if (d > maxDays) d = maxDays;

    try {
      const iso = ethToGregorian(y, m, d);
      onChange(iso);
    } catch (e) {
      console.error("Error converting Ethiopian date:", e);
    }
  };

  // Live Gregorian preview when Ethiopian is selected
  const gregorianEquiv = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    try {
      return format(parseISO(value), "MMM d, yyyy");
    } catch {
      return "";
    }
  }, [value]);

  // Live Ethiopian preview when Gregorian is selected
  const ethiopianEquiv = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    try {
      const eth = gregorianToEth(value);
      return formatEthDate(eth, "full_am");
    } catch {
      return "";
    }
  }, [value]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span>{label}</span>
        </label>
        <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
          {calendarSystem === "ethiopian" ? (
            <>
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>የኢትዮጵያ ካላንደር (Sys Admin Mode)</span>
            </>
          ) : (
            <>
              <Globe className="w-3 h-3 text-indigo-600" />
              <span>Gregorian Calendar (Sys Admin Mode)</span>
            </>
          )}
        </span>
      </div>

      {calendarSystem === "ethiopian" ? (
        <div className="space-y-1.5">
          {/* 3 Coordinated Selects: Year, Month (1-13), Day (1-30) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Year Select */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Year (ዓ.ም)
              </span>
              <select
                aria-label={`${label} Ethiopian Year`}
                disabled={disabled}
                value={ethDate.year}
                onChange={(e) => handleEthChange("year", parseInt(e.target.value, 10))}
                className="select select-sm select-bordered w-full rounded-xl text-xs font-bold font-mono h-9 min-h-0"
              >
                {[2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022].map((y) => (
                  <option key={y} value={y}>
                    {y} ዓ.ም
                  </option>
                ))}
              </select>
            </div>

            {/* Month Select (1 to 13) */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Month (ወር)
              </span>
              <select
                aria-label={`${label} Ethiopian Month`}
                disabled={disabled}
                value={ethDate.month}
                onChange={(e) => handleEthChange("month", parseInt(e.target.value, 10))}
                className="select select-sm select-bordered w-full rounded-xl text-xs font-bold h-9 min-h-0 truncate"
              >
                {Array.from({ length: 13 }, (_, i) => i + 1).map((mNum) => {
                  const amName = ETH_MONTH_NAMES_AM[mNum];
                  const enName = ETH_MONTH_NAMES_EN[mNum];
                  return (
                    <option key={mNum} value={mNum}>
                      {mNum}. {amName} ({enName})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Day Select (1 to 30 or 5/6) */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Day (ቀን)
              </span>
              <select
                aria-label={`${label} Ethiopian Day`}
                disabled={disabled}
                value={ethDate.day}
                onChange={(e) => handleEthChange("day", parseInt(e.target.value, 10))}
                className="select select-sm select-bordered w-full rounded-xl text-xs font-bold font-mono h-9 min-h-0"
              >
                {Array.from({ length: maxEthDays }).map((_, idx) => {
                  const d = idx + 1;
                  return (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Dual Date Feedback Chip */}
          <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-950 font-mono">
              🇪🇹 {formatEthDate(ethDate, "full_am")}
            </span>
            {gregorianEquiv && (
              <span className="text-[11px] font-mono text-emerald-700/80">
                GC: {gregorianEquiv}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Standard Gregorian Calendar Input */
        <div className="space-y-1.5">
          <input
            aria-label={label}
            type="date"
            disabled={disabled}
            value={value}
            min={minDate}
            onChange={(e) => onChange(e.target.value)}
            className="input input-sm input-bordered w-full rounded-xl text-xs font-mono font-bold h-9 min-h-0"
          />

          {/* Dual Date Feedback Chip */}
          {value && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 font-mono">
                🌐 {gregorianEquiv || value}
              </span>
              {ethiopianEquiv && (
                <span className="text-[11px] font-mono text-slate-500">
                  EC: {ethiopianEquiv}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
