// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination, getPageNumbers } from "./use-pagination";

describe("usePagination Hook - State & Calculation Audit", () => {
  const sampleItems = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

  it("initializes with page 1, correct total pages and initial slice", () => {
    const { result } = renderHook(() =>
      usePagination({ items: sampleItems, initialPageSize: 10 })
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.totalItems).toBe(45);
    expect(result.current.paginatedItems.length).toBe(10);
    expect(result.current.paginatedItems[0].id).toBe(1);
    expect(result.current.paginatedItems[9].id).toBe(10);
    expect(result.current.canPrevPage).toBe(false);
    expect(result.current.canNextPage).toBe(true);
  });

  it("navigates to next page and updates slice correctly", () => {
    const { result } = renderHook(() =>
      usePagination({ items: sampleItems, initialPageSize: 10 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.canPrevPage).toBe(true);
    expect(result.current.paginatedItems[0].id).toBe(11);
    expect(result.current.paginatedItems[9].id).toBe(20);
  });

  it("navigates to previous page and respects boundaries", () => {
    const { result } = renderHook(() =>
      usePagination({ items: sampleItems, initialPage: 2, initialPageSize: 10 })
    );

    act(() => {
      result.current.prevPage();
    });
    expect(result.current.currentPage).toBe(1);

    // Prev from page 1 does not go below 1
    act(() => {
      result.current.prevPage();
    });
    expect(result.current.currentPage).toBe(1);
  });

  it("allows setting page size and resets to page 1", () => {
    const { result } = renderHook(() =>
      usePagination({ items: sampleItems, initialPage: 3, initialPageSize: 10 })
    );

    act(() => {
      result.current.setPageSize(25);
    });

    expect(result.current.pageSize).toBe(25);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.paginatedItems.length).toBe(25);
  });

  it("clamps out-of-bound page requests safely", () => {
    const { result } = renderHook(() =>
      usePagination({ items: sampleItems, initialPageSize: 10 })
    );

    act(() => {
      result.current.setPage(999);
    });
    expect(result.current.currentPage).toBe(5);

    act(() => {
      result.current.setPage(-5);
    });
    expect(result.current.currentPage).toBe(1);
  });

  describe("getPageNumbers windowing logic", () => {
    it("returns all pages when totalPages <= 7", () => {
      expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it("returns ellipsis at end when near the start", () => {
      expect(getPageNumbers(2, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
    });

    it("returns ellipsis at start when near the end", () => {
      expect(getPageNumbers(9, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
    });

    it("returns ellipsis at both sides when in the middle", () => {
      expect(getPageNumbers(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    });
  });
});
