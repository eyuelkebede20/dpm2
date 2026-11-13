// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { NavigationProgress } from "./navigation-progress";

let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

describe("NavigationProgress Component - 0ms Route Transition Feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/dashboard";
  });

  afterEach(() => {
    cleanup();
  });

  it("renders null initially when not navigating", () => {
    const { container } = render(<NavigationProgress />);
    expect(container.firstChild).toBeNull();
  });

  it("activates progress bar immediately when an internal navigation link is clicked", () => {
    const { unmount } = render(
      <div>
        <NavigationProgress />
        <a href="/admin">Go to Admin</a>
      </div>
    );

    const link = screen.getByRole("link", { name: /go to admin/i });

    act(() => {
      fireEvent.click(link);
    });

    const progressElem = screen.getByLabelText(/page loading progress/i);
    expect(progressElem).toBeDefined();

    unmount();
  });

  it("does not activate progress for external or hash links", () => {
    const { unmount } = render(
      <div>
        <NavigationProgress />
        <a href="https://google.com">External</a>
        <a href="#section">Hash</a>
        <a href="/dashboard">Same page</a>
      </div>
    );

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: /external/i }));
    });
    expect(screen.queryByLabelText(/page loading progress/i)).toBeNull();

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: /hash/i }));
    });
    expect(screen.queryByLabelText(/page loading progress/i)).toBeNull();

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: /same page/i }));
    });
    expect(screen.queryByLabelText(/page loading progress/i)).toBeNull();

    unmount();
  });
});
