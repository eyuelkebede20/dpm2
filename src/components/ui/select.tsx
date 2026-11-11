import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
  maxWidthClass?: string;
}

/**
 * Standardized Accessible Select component.
 * - Minimum height: 44px (touch target compliant)
 * - Text size: text-base sm:text-sm (prevents mobile auto-zoom)
 * - Cohesive border, background, focus ring, and disabled state styling.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className = "",
      hasError = false,
      maxWidthClass = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const borderStyle = hasError
      ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-600 focus:ring-rose-500/20"
      : "border-slate-200 bg-white hover:border-slate-300 focus:border-indigo-600 focus:ring-indigo-500/20 text-slate-900";

    const disabledStyle = disabled
      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75 shadow-none"
      : "shadow-2xs";

    return (
      <div className={`relative w-full ${maxWidthClass}`.trim()}>
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={hasError ? "true" : undefined}
          className={`w-full min-h-[44px] h-11 pl-3.5 pr-10 appearance-none rounded-xl border text-base sm:text-sm font-medium transition-all duration-150 focus:outline-hidden focus:ring-2 cursor-pointer ${borderStyle} ${disabledStyle} ${className}`.trim()}
          {...props}
        >
          {children}
        </select>

        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";
