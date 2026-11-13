"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Top Navigation Progress Indicator (Seamless Route Transitions)
 *
 * Provides instantaneous 0ms visual feedback when a user clicks any navigation link.
 * Progressively animates across the top of the viewport and completes upon route resolution.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // When pathname changes, the navigation has completed!
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const finishTimer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 180);
      return () => clearTimeout(finishTimer);
    }
  }, [pathname, isNavigating]);

  // Listen for navigation clicks across the document
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Find closest anchor tag
      const target = (e.target as HTMLElement).closest("a");
      if (!target || !target.href) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external protocols, downloads, hash jumps, or new tab openings
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        target.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      let destination: URL;
      try {
        destination = new URL(target.href, window.location.href);
      } catch {
        return;
      }

      // Ignore different origin
      if (destination.origin !== window.location.origin) return;

      // If navigating to the exact current pathname and query, skip
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      // Start instant navigation progress
      setIsNavigating(true);
      setProgress(35);

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 90;
          }
          return prev + Math.floor(Math.random() * 12 + 8);
        });
      }, 100);
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pathname]);

  if (!isNavigating && progress === 0) return null;

  return (
    <aside
      aria-label="Page loading progress"
      className="fixed top-0 left-0 right-0 h-[3px] z-[99999] pointer-events-none overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 shadow-[0_0_12px_2px_rgba(99,102,241,0.7)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition:
            progress === 100
              ? "width 120ms ease-out, opacity 180ms ease-in"
              : "width 150ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </aside>
  );
}
