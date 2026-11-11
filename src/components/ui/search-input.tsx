import React from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  onClear?: () => void;
  maxWidthClass?: string;
}

/**
 * Standardized Search Bar with embedded search icon, clear button,
 * and WCAG AA touch-target compliance.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = "Search...",
      maxWidthClass = "max-w-md",
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const hasValue = Boolean(value && String(value).length > 0);

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: { value: "" },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <div className={`relative w-full ${maxWidthClass}`}>
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
          <Search className="w-4 h-4" />
        </div>

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={props["aria-label"] || placeholder}
          className={`w-full min-h-[44px] h-11 pl-10 ${
            hasValue ? "pr-10" : "pr-4"
          } text-base sm:text-sm font-medium rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`.trim()}
          {...props}
        />

        {hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 active:scale-95 transition-colors cursor-pointer"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
