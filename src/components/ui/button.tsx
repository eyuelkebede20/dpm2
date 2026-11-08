"use client";

import React, { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  debounceMs?: number; // Double-click protection threshold in ms
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm hover:shadow shadow-indigo-100 border-transparent",
  secondary:
    "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm border-transparent",
  accent:
    "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm border-transparent",
  outline:
    "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 shadow-2xs",
  ghost:
    "bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 border-transparent shadow-none",
  danger:
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm border-transparent",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "h-7 min-h-[28px] px-2.5 text-xs rounded-lg gap-1",
  sm: "h-8 min-h-[32px] sm:min-h-[36px] px-3 text-xs rounded-xl gap-1.5",
  md: "h-10 min-h-[40px] sm:min-h-[44px] px-4 text-sm rounded-xl gap-2",
  lg: "h-12 min-h-[48px] px-6 text-base rounded-2xl gap-2.5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled = false,
      onClick,
      debounceMs = 350,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const [isInternalPending, setIsInternalPending] = useState(false);
    const lastClickTimeRef = useRef<number>(0);

    const isBusy = loading || isInternalPending;
    const isDisabled = disabled || isBusy;

    const handleClick = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isDisabled) {
          e.preventDefault();
          return;
        }

        const now = Date.now();
        // Double-click lockout protection
        if (now - lastClickTimeRef.current < debounceMs) {
          e.preventDefault();
          return;
        }
        lastClickTimeRef.current = now;

        if (onClick) {
          const result: unknown = onClick(e);
          // If onClick returns a promise, automatically lock button until it settles
          if (result && typeof (result as any).then === "function") {
            try {
              setIsInternalPending(true);
              await result;
            } finally {
              setIsInternalPending(false);
            }
          }
        }
      },
      [isDisabled, debounceMs, onClick]
    );

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isBusy ? "true" : undefined}
        aria-disabled={isDisabled ? "true" : undefined}
        onClick={handleClick}
        className={twMerge(
          clsx(
            // Base styles
            "inline-flex items-center justify-center font-semibold border select-none text-center cursor-pointer",
            "transition-all duration-150 ease-out",
            // Accessible Focus styles
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            // Motion press
            "active:scale-[0.98]",
            // Variants and sizes
            VARIANT_CLASSES[variant],
            SIZE_CLASSES[size],
            // Disabled styles
            isDisabled &&
              "opacity-50 cursor-not-allowed pointer-events-none active:scale-100 shadow-none",
            className
          )
        )}
        {...props}
      >
        {isBusy ? (
          <>
            <Loader2
              className="w-4 h-4 animate-spin shrink-0"
              aria-hidden="true"
            />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="shrink-0 inline-flex items-center" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            {children}
            {rightIcon && (
              <span className="shrink-0 inline-flex items-center" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
