"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";

export type StepperThemeColor = "emerald" | "slate" | "amber" | "rose" | "blue";
export type StepperSize = "sm" | "md" | "lg";

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
  size?: StepperSize;
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
  size = "md",
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

  // Theme-specific styles
  const getBorderAndFocusClass = () => {
    switch (themeColor) {
      case "emerald":
        return "border-emerald-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-200/80";
      case "amber":
        return "border-amber-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200/80";
      case "rose":
        return "border-rose-300 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-200/80";
      case "blue":
        return "border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200/80";
      default:
        return "border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100";
    }
  };

  const getIncButtonClass = () => {
    switch (themeColor) {
      case "emerald":
        return "bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white active:scale-95 transition-all";
      case "amber":
        return "bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white active:scale-95 transition-all";
      case "rose":
        return "bg-rose-50 hover:bg-rose-500 text-rose-800 hover:text-white active:scale-95 transition-all";
      case "blue":
        return "bg-blue-50 hover:bg-blue-600 text-blue-800 hover:text-white active:scale-95 transition-all";
      default:
        return "bg-slate-50 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 active:scale-95 transition-all";
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
      case "blue":
        return "bg-blue-50 hover:bg-blue-600 text-blue-800 hover:text-white border border-blue-300 hover:border-blue-600 shadow-2xs font-extrabold active:scale-95 transition-all";
      default:
        return "bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 border border-slate-200/80 font-bold active:scale-95 transition-all";
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
      case "blue":
        return "focus:bg-blue-50/40 text-blue-950 font-black";
      default:
        return "focus:bg-indigo-50/40 text-slate-900 font-bold";
    }
  };

  // Dimensions based on size prop (touch targets >= 44x44 on lg / mobile cards)
  const isLarge = size === "lg";
  const isSmall = size === "sm";

  const buttonDimensions = isLarge
    ? "h-11 min-w-[44px] sm:min-w-[44px] px-3 touch-manipulation"
    : isSmall
    ? "h-8 min-w-[32px] px-2 touch-manipulation"
    : "h-9 min-w-[36px] sm:min-w-[40px] px-2.5 touch-manipulation";

  const inputDimensions = isLarge
    ? "h-11 text-base tracking-normal font-black px-2"
    : isSmall
    ? "h-8 text-xs px-1"
    : "h-9 text-sm tracking-tight px-1";

  const iconDimensions = isLarge ? "w-4 h-4 stroke-[2.5]" : "w-3.5 h-3.5 stroke-[2.5]";

  const quickAddDimensions = isLarge
    ? "text-xs font-mono min-h-[34px] min-w-[38px] px-2.5 py-1 rounded-lg touch-manipulation"
    : "text-[11px] font-mono px-2 py-0.5 rounded-md touch-manipulation";

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
          className={`btn btn-sm ${buttonDimensions} join-item border-none bg-slate-50 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 active:scale-95 transition-all select-none disabled:opacity-30 disabled:hover:bg-slate-50`}
          title="Decrease"
          aria-label="Decrease quantity"
        >
          <Minus className={iconDimensions} />
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
          className={`join-item input input-sm ${inputDimensions} w-full text-center font-mono tabular-nums border-none focus:outline-hidden ${getInputFocusClass()}`}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={handleInc}
          disabled={disabled || value >= max}
          className={`btn btn-sm ${buttonDimensions} join-item border-none ${getIncButtonClass()} select-none disabled:opacity-30 disabled:hover:bg-slate-50`}
          title="Increase"
          aria-label="Increase quantity"
        >
          <Plus className={iconDimensions} />
        </button>
      </div>

      {/* Quick Add Pills */}
      {quickAdds && quickAdds.length > 0 && !disabled && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {quickAdds.map((amt) => (
            <button
              key={amt}
              type="button"
              tabIndex={-1}
              onClick={(e) => handleQuickAdd(amt, e)}
              className={`${quickAddDimensions} ${getQuickAddButtonClass()}`}
            >
              +{amt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
