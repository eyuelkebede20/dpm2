"use client";

import React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
  onPageChange?: (page: number) => void;
  setPage?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  setPageSize?: (size: number) => void;
  pageSizeOptions?: number[];
  pageNumbers: (number | "ellipsis")[];
  className?: string;
  itemLabel?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  startIndex,
  endIndex,
  onPageChange,
  setPage,
  onPageSizeChange,
  setPageSize,
  pageSizeOptions = [10, 25, 50],
  pageNumbers,
  className = "",
  itemLabel = "items",
}: PaginationProps) {
  if (totalItems === 0) return null;

  const handlePageChange = onPageChange || setPage || (() => {});
  const handlePageSizeChange = onPageSizeChange || setPageSize;

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 ${className}`}
    >
      {/* Range Summary & Page Size Selector */}
      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium order-2 sm:order-1">
        <span>
          Showing{" "}
          <strong className="font-bold text-slate-800">
            {totalItems === 0 ? 0 : startIndex + 1}
          </strong>{" "}
          to{" "}
          <strong className="font-bold text-slate-800">{endIndex}</strong> of{" "}
          <strong className="font-bold text-slate-800">{totalItems}</strong>{" "}
          {itemLabel}
        </span>

        {handlePageSizeChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
            <label htmlFor="pagination-page-size" className="sr-only">
              Items per page
            </label>
            <span className="text-slate-400">Rows:</span>
            <select
              id="pagination-page-size"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="select select-xs select-bordered rounded-lg bg-white text-slate-700 font-bold border-slate-200 focus:border-indigo-500 focus:outline-hidden py-0 h-7 text-xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Controls */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Go to previous page"
          className="btn btn-sm btn-ghost border border-slate-200 rounded-xl px-2.5 h-8 min-h-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-semibold">Prev</span>
        </button>

        {/* Numbered Page Buttons & Ellipses */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, idx) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 select-none"
                  aria-hidden="true"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </span>
              );
            }

            const isActive = page === currentPage;

            return (
              <button
                key={`page-${page}`}
                type="button"
                onClick={() => handlePageChange(page)}
                aria-label={`Go to page ${page}`}
                aria-current={isActive ? "page" : undefined}
                className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-2xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Go to next page"
          className="btn btn-sm btn-ghost border border-slate-200 rounded-xl px-2.5 h-8 min-h-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed transition-all"
        >
          <span className="hidden sm:inline text-xs font-semibold">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
