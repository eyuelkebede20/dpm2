"use client";

import { useState, useMemo, useCallback, useEffect } from "react";

export interface UsePaginationOptions<T> {
  items: T[];
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

export interface UsePaginationReturn<T> {
  paginatedItems: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
  canPrevPage: boolean;
  canNextPage: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  pageNumbers: (number | "ellipsis")[];
}

/**
 * Calculates accessible page numbers with smart ellipsis windowing:
 * e.g., [1, 2, 3, 4, 5] or [1, 'ellipsis', 4, 5, 6, 'ellipsis', 20]
 */
export function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // If near the start
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }

  // If near the end
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  // In the middle
  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}

export function usePagination<T>({
  items,
  initialPage = 1,
  initialPageSize = 10,
}: UsePaginationOptions<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset to valid page boundary if items length or page size changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const setPage = useCallback((page: number) => {
    setCurrentPage((prev) => {
      const target = Math.max(1, Math.min(page, totalPages));
      return target;
    });
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    if (size > 0) {
      setPageSizeState(size);
      setCurrentPage(1);
    }
  }, []);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const pageNumbers = useMemo(() => {
    return getPageNumbers(currentPage, totalPages);
  }, [currentPage, totalPages]);

  return {
    paginatedItems,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    startIndex,
    endIndex,
    canPrevPage: currentPage > 1,
    canNextPage: currentPage < totalPages,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    pageNumbers,
  };
}
