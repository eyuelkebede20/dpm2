import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional icon to render on the left of the input */
  leftIcon?: React.ReactNode;
  /** Optional icon or action to render on the right of the input */
  rightIcon?: React.ReactNode;
  /** Error message or flag to highlight invalid state */
  hasError?: boolean;
  /** Sizing variant: 'md' (standard 44px min-height) or 'lg' (48px) */
  inputSize?: "md" | "lg";
}

/**
 * Standardized Accessible Input component.
 * - Minimum height: 44px (touch target compliant, preventing cramped inputs on big screens)
 * - Text size: text-base sm:text-sm (prevents iOS auto-zoom on mobile, crisp typography on desktop)
 * - Cohesive border, background, focus ring, and disabled state styling.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = "",
      leftIcon,
      rightIcon,
      hasError = false,
      inputSize = "md",
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      md: "min-h-[44px] h-11 text-base sm:text-sm px-3.5",
      lg: "min-h-[48px] h-12 text-base sm:text-base px-4",
    }[inputSize];

    const paddingLeft = leftIcon ? "pl-10" : "";
    const paddingRight = rightIcon ? "pr-10" : "";

    const borderStyle = hasError
      ? "border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-600 focus:ring-rose-500/20"
      : "border-slate-200 bg-white hover:border-slate-300 focus:border-indigo-600 focus:ring-indigo-500/20 text-slate-900";

    const disabledStyle = disabled
      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75 shadow-none"
      : "shadow-2xs";

    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={hasError ? "true" : undefined}
          className={`w-full rounded-xl border font-medium placeholder:text-slate-400 transition-all duration-150 focus:outline-hidden focus:ring-2 ${sizeClasses} ${paddingLeft} ${paddingRight} ${borderStyle} ${disabledStyle} ${className}`.trim()}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
