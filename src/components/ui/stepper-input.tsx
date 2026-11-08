"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";

interface StepperInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  quickAdds?: number[];
  className?: string;
  name?: string;
  disabled?: boolean;
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

  return (
    <div className={`flex flex-col gap-1.5 items-start ${className}`}>
      {/* Main stepper row */}
      <div className="join w-full shadow-2xs border border-slate-200/90 rounded-xl overflow-hidden bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
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
          className="join-item input input-sm h-9 w-full text-center font-mono font-bold tabular-nums text-slate-900 border-none focus:outline-hidden focus:bg-indigo-50/40 text-sm tracking-tight px-1"
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={handleInc}
          disabled={disabled || value >= max}
          className="btn btn-sm h-9 min-w-[36px] sm:min-w-[40px] px-2.5 join-item border-none bg-slate-50 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 active:scale-90 transition-all disabled:opacity-30 disabled:hover:bg-slate-50"
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
              className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 active:scale-95 transition-all border border-slate-200/60"
            >
              +{amt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
