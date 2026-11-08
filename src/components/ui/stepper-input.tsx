"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";

export type StepperThemeColor = "emerald" | "slate" | "amber" | "rose" | "blue";

export interface StepperInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  quickAdds?: number[];
  className?: string;
  name?: string;
  disabled?: boolean;
  themeColor?: StepperThemeColor;
}

export function StepperInput({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  quickAdds = [1, 5, 10],
  className = "",
  disabled = false,
  themeColor = "slate",
}: StepperInputProps) {
  const handleDec = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(Math.max(min, (value || 0) - step));
  };

  const handleInc = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(Math.min(max, (value || 0) + step));
  };

  const handleQuickAdd = (amount: number, e: React.MouseEvent) => {
    e.preventDefault();
    onChange(Math.min(max, (value || 0) + amount));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(max, (value || 0) + step));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(min, (value || 0) - step));
    } else if (e.key === "Enter") {
      // Find next numeric input on form and focus
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>("input[inputmode='numeric']")
      );
      const index = inputs.indexOf(e.currentTarget);
      if (index >= 0 && index < inputs.length - 1) {
        inputs[index + 1]?.focus();
        inputs[index + 1]?.select();
      }
    }
  };

  // Theme-specific styles inspired by ../dpm
  const getBorderAndFocusClass = () => {
    switch (themeColor) {
      case "emerald":
        return "border-emerald-300/90 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-200/80";
      case "amber":
        return "border-amber-300/90 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200/80";
      case "rose":
        return "border-rose-300/90 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-200/80";
      case "blue":
        return "border-blue-300/90 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200/80";
      default:
        return "border-slate-200/90 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100";
    }
  };

  const getIncButtonClass = () => {
    switch (themeColor) {
      case "emerald":
        return "bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white active:scale-90 transition-all";
      case "amber":
        return "bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white active:scale-90 transition-all";
      case "rose":
        return "bg-rose-50 hover:bg-rose-500 text-rose-800 hover:text-white active:scale-90 transition-all";
      default:
        return "bg-slate-50 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 active:scale-90 transition-all";
    }
  };

  const getQuickAddButtonClass = () => {
    switch (themeColor) {
      case "emerald":
        return "bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 hover:border-emerald-600 shadow-2xs font-extrabold active:scale-95 transition-all";
      case "amber":
        return "bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-300 hover:border-amber-600 shadow-2xs font-extrabold active:scale-95 transition-all";
      case "rose":
        return "bg-rose-50 hover:bg-rose-600 text-rose-800 hover:text-white border border-rose-300 hover:border-rose-600 shadow-2xs font-extrabold active:scale-95 transition-all";
      default:
        return "bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 border border-slate-200/60 font-bold active:scale-95 transition-all";
    }
  };

  const getInputFocusClass = () => {
    switch (themeColor) {
      case "emerald":
        return "focus:bg-emerald-50/40 text-emerald-950 font-black";
      case "amber":
        return "focus:bg-amber-50/40 text-amber-950 font-black";
      case "rose":
        return "focus:bg-rose-50/40 text-rose-950 font-black";
      default:
        return "focus:bg-indigo-50/40 text-slate-900 font-bold";
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 items-start ${className}`}>
      {/* Main stepper row */}
      <div
        className={`join w-full shadow-2xs border rounded-xl overflow-hidden bg-white transition-all ${getBorderAndFocusClass()}`}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={handleDec}
          disabled={disabled || value <= min}
          className="btn btn-sm h-9 min-w-[36px] sm:min-w-[40px] px-2.5 join-item border-none bg-slate-50 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-slate-50"
          title="Decrease"
          aria-label="Decrease quantity"
        >
          <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value === 0 ? "0" : value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          className={`join-item input input-sm h-9 w-full text-center font-mono tabular-nums border-none focus:outline-hidden text-sm tracking-tight px-1 ${getInputFocusClass()}`}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={handleInc}
          disabled={disabled || value >= max}
          className={`btn btn-sm h-9 min-w-[36px] sm:min-w-[40px] px-2.5 join-item border-none ${getIncButtonClass()} disabled:opacity-30 disabled:hover:bg-slate-50`}
          title="Increase"
          aria-label="Increase quantity"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Quick Add Pills */}
      {quickAdds && quickAdds.length > 0 && !disabled && (
        <div className="flex items-center gap-1 flex-wrap">
          {quickAdds.map((amt) => (
            <button
              key={amt}
              type="button"
              tabIndex={-1}
              onClick={(e) => handleQuickAdd(amt, e)}
              className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${getQuickAddButtonClass()}`}
            >
              +{amt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
