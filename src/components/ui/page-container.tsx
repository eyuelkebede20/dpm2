import React from "react";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "main" | "section";
  /**
   * Maximum width constraints for big screens:
   * - "7xl": standard 80rem (1280px)
   * - "8xl": wide 96rem (1536px) on 2xl screens (recommended for data-dense dashboards/grids)
   * - "full": 100% width while retaining consistent left/right gutters
   * - "narrow": 56rem (896px) for focused settings/forms
   */
  maxWidth?: "7xl" | "8xl" | "full" | "narrow";
  /**
   * Controls top/bottom padding:
   * - "standard": py-6 sm:py-8
   * - "compact": py-3 sm:py-4
   * - "none": no vertical padding
   */
  paddingY?: "standard" | "compact" | "none";
}

/**
 * Standardized responsive page container for DPM.
 * Enforces cohesive left and right page padding across mobile, tablet, laptop,
 * and ultra-wide / big screens (px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16).
 */
export function PageContainer({
  as: Component = "div",
  maxWidth = "8xl",
  paddingY = "standard",
  className = "",
  children,
  ...props
}: PageContainerProps) {
  const maxWidthClass = {
    "7xl": "max-w-7xl",
    "8xl": "max-w-7xl 2xl:max-w-8xl",
    full: "max-w-full",
    narrow: "max-w-4xl",
  }[maxWidth];

  const paddingYClass = {
    standard: "py-6 sm:py-8",
    compact: "py-3 sm:py-4.5",
    none: "",
  }[paddingY];

  // Cohesive responsive horizontal gutter for all viewports, especially big screens
  const horizontalPadding = "px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16";

  return (
    <Component
      className={`w-full mx-auto ${maxWidthClass} ${horizontalPadding} ${paddingYClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
}
