import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Pagination } from "./pagination";

describe("Pagination Component - Accessibility & Interaction Audit", () => {
  const defaultProps = {
    currentPage: 2,
    totalPages: 5,
    totalItems: 45,
    pageSize: 10,
    startIndex: 10,
    endIndex: 20,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    pageNumbers: [1, 2, 3, 4, 5] as (number | "ellipsis")[],
    itemLabel: "users",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with accessible navigation landmark and summary text", () => {
    render(<Pagination {...defaultProps} />);

    const nav = screen.getByRole("navigation", { name: /pagination navigation/i });
    expect(nav).toBeDefined();

    expect(screen.getByText(/showing/i)).toBeDefined();
    expect(screen.getByText(/11/)).toBeDefined();
    expect(screen.getByText(/20/)).toBeDefined();
    expect(screen.getByText(/45/)).toBeDefined();
    expect(screen.getByText(/users/)).toBeDefined();
  });

  it("marks current active page with aria-current='page'", () => {
    render(<Pagination {...defaultProps} />);

    const activeBtn = screen.getByRole("button", { name: "Go to page 2" });
    expect(activeBtn.getAttribute("aria-current")).toBe("page");

    const page1Btn = screen.getByRole("button", { name: "Go to page 1" });
    expect(page1Btn.getAttribute("aria-current")).toBeNull();
  });

  it("calls onPageChange when page numbers are clicked", () => {
    const handlePageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={handlePageChange} />);

    const page3Btn = screen.getByRole("button", { name: "Go to page 3" });
    fireEvent.click(page3Btn);

    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it("disables Prev button on first page and Next button on last page", () => {
    const { rerender } = render(
      <Pagination {...defaultProps} currentPage={1} startIndex={0} endIndex={10} />
    );

    const prevBtn = screen.getByRole("button", { name: /go to previous page/i });
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <Pagination {...defaultProps} currentPage={5} startIndex={40} endIndex={45} />
    );
    const nextBtn = screen.getByRole("button", { name: /go to next page/i });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("handles page size selection change", () => {
    const handleSizeChange = vi.fn();
    render(<Pagination {...defaultProps} onPageSizeChange={handleSizeChange} />);

    const select = screen.getByLabelText(/items per page/i);
    fireEvent.change(select, { target: { value: "25" } });

    expect(handleSizeChange).toHaveBeenCalledWith(25);
  });

  it("renders nothing when totalItems is 0", () => {
    const { container } = render(
      <Pagination {...defaultProps} totalItems={0} totalPages={1} />
    );
    expect(container.firstChild).toBeNull();
  });
});
