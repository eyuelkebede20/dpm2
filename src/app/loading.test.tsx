// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Loading from "./loading";

describe("Root Loading Skeleton - Next.js Instant Route Transition", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with accessible status role and label", () => {
    render(<Loading />);
    const statusElem = screen.getByRole("status");
    expect(statusElem).toBeDefined();
    expect(statusElem.getAttribute("aria-label")).toBe("Loading page content");
  });

  it("renders screen-reader announcement text", () => {
    render(<Loading />);
    expect(screen.getByText(/loading page data, please wait.../i)).toBeDefined();
  });
});
