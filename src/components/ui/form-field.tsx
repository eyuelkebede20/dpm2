import React from "react";
import { AlertCircle } from "lucide-react";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  error?: string | null;
  hint?: string;
  maxWidthClass?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Standard FormField wrapper that pairs labels, inputs, error alerts,
 * and contextual hints with proper typographic scale and accessibility.
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  optional = false,
  error,
  hint,
  maxWidthClass = "max-w-md",
  className = "",
  children,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 w-full ${maxWidthClass} ${className}`.trim()}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={htmlFor}
          className="block text-xs font-bold uppercase tracking-wider text-slate-700 leading-relaxed"
        >
          {label}
          {required && <span className="text-rose-500 ml-1 font-black">*</span>}
        </label>
        {optional && (
          <span className="text-[11px] font-normal text-slate-400 italic">
            (optional)
          </span>
        )}
      </div>

      {children}

      {error && (
        <p
          role="alert"
          className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 mt-1 animate-in fade-in duration-150"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {!error && hint && (
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{hint}</p>
      )}
    </div>
  );
}
