import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SearchInput } from "./search-input";

describe("SearchInput Component - Impeccable Standards", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with search icon and 44px min-height", () => {
    render(<SearchInput placeholder="Search records..." value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText("Search records...");
    expect(input).toBeDefined();
    expect(input.className).toContain("min-h-[44px]");
    expect(input.className).toContain("pl-10");
  });

  it("shows clear button only when value is present, and triggers clear on click", () => {
    const handleClear = vi.fn();
    const { rerender } = render(
      <SearchInput
        placeholder="Search records..."
        value=""
        onChange={() => {}}
        onClear={handleClear}
      />
    );

    // No clear button when empty
    expect(screen.queryByRole("button", { name: /clear search/i })).toBeNull();

    // Rerender with value
    rerender(
      <SearchInput
        placeholder="Search records..."
        value="Sewing Line"
        onChange={() => {}}
        onClear={handleClear}
      />
    );

    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    expect(clearBtn).toBeDefined();
    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
