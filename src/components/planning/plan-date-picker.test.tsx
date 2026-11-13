import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PlanDatePicker } from "./plan-date-picker";
import { ETH_MONTH_NAMES_AM, ETH_MONTH_NAMES_EN } from "@/lib/ethiopian-calendar";

describe("PlanDatePicker - Ethiopian Calendar & Month Accuracy Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders 13 Ethiopian months correctly with 1-based indexing (Hamle = 11, Nehase = 12, Pagume = 13)", () => {
    const mockOnChange = vi.fn();
    render(
      <PlanDatePicker
        label="Start Date"
        value="2026-07-08" // Hamle 1, 2018 EC
        onChange={mockOnChange}
        calendarSystem="ethiopian"
      />
    );

    const monthSelect = screen.getByRole("combobox", { name: "Start Date Ethiopian Month" }) as HTMLSelectElement;
    expect(monthSelect).toBeDefined();

    const options = Array.from(monthSelect.options);
    expect(options.length).toBe(13); // exactly 13 months, no blank 0th element

    // Month 1 = Meskerem
    expect(options[0].value).toBe("1");
    expect(options[0].textContent).toContain("1. መስከረም (Meskerem)");

    // Month 11 = Hamle (ሐምሌ)
    expect(options[10].value).toBe("11");
    expect(options[10].textContent).toContain("11. ሐምሌ (Hamle)");

    // Month 12 = Nehase (ነሐሴ)
    expect(options[11].value).toBe("12");
    expect(options[11].textContent).toContain("12. ነሐሴ (Nehase)");

    // Month 13 = Pagume (ጳጉሜ)
    expect(options[12].value).toBe("13");
    expect(options[12].textContent).toContain("13. ጳጉሜ (Pagume)");
  });

  it("handles selecting Hamle 1, 2018 EC and converts to correct Gregorian date (2026-07-08)", () => {
    const mockOnChange = vi.fn();
    render(
      <PlanDatePicker
        label="Start Date"
        value="2026-07-08"
        onChange={mockOnChange}
        calendarSystem="ethiopian"
      />
    );

    const yearSelect = screen.getByRole("combobox", { name: "Start Date Ethiopian Year" });
    const monthSelect = screen.getByRole("combobox", { name: "Start Date Ethiopian Month" });
    const daySelect = screen.getByRole("combobox", { name: "Start Date Ethiopian Day" });

    // Select Year 2018, Month 11 (Hamle), Day 1
    fireEvent.change(yearSelect, { target: { value: "2018" } });
    fireEvent.change(monthSelect, { target: { value: "11" } });
    fireEvent.change(daySelect, { target: { value: "1" } });

    // Last call to onChange should be 2026-07-08
    expect(mockOnChange).toHaveBeenLastCalledWith("2026-07-08");

    // Live preview chip should show Hamle 1, 2018
    expect(screen.getByText(/ሐምሌ 1 ቀን 2018 ዓ\.ም/)).toBeDefined();
    expect(screen.getByText(/GC: Jul 8, 2026/)).toBeDefined();
  });

  it("handles selecting Nehase 30, 2018 EC with full 30 days and converts to correct Gregorian date (2026-09-05)", () => {
    const mockOnChange = vi.fn();
    render(
      <PlanDatePicker
        label="End Date"
        value="2026-09-05" // Nehase 30, 2018 EC
        onChange={mockOnChange}
        calendarSystem="ethiopian"
      />
    );

    const monthSelect = screen.getByRole("combobox", { name: "End Date Ethiopian Month" });
    const daySelect = screen.getByRole("combobox", { name: "End Date Ethiopian Day" }) as HTMLSelectElement;

    // Month 12 (Nehase) must have 30 days available
    fireEvent.change(monthSelect, { target: { value: "12" } });
    expect(daySelect.options.length).toBe(30);

    // Select Day 30
    fireEvent.change(daySelect, { target: { value: "30" } });

    expect(mockOnChange).toHaveBeenLastCalledWith("2026-09-05");
    expect(screen.getByText(/ነሐሴ 30 ቀን 2018 ዓ\.ም/)).toBeDefined();
    expect(screen.getByText(/GC: Sep 5, 2026/)).toBeDefined();
  });

  it("clamps Pagume (Month 13) to 5 or 6 days without affecting Nehase (Month 12)", () => {
    function ControlledPicker() {
      const [val, setVal] = React.useState("2026-09-05"); // Nehase 30, 2018 EC
      return (
        <PlanDatePicker
          label="End Date"
          value={val}
          onChange={setVal}
          calendarSystem="ethiopian"
        />
      );
    }
    render(<ControlledPicker />);

    const monthSelect = screen.getByRole("combobox", { name: "End Date Ethiopian Month" });
    const daySelect = screen.getByRole("combobox", { name: "End Date Ethiopian Day" }) as HTMLSelectElement;

    // Switch to Pagume (Month 13)
    fireEvent.change(monthSelect, { target: { value: "13" } });
    // In year 2018 (2018 % 4 === 2, not leap), Pagume has 5 days
    expect(daySelect.options.length).toBe(5);

    // Switch back to Nehase (Month 12) - must immediately have 30 days
    fireEvent.change(monthSelect, { target: { value: "12" } });
    expect(daySelect.options.length).toBe(30);
  });
});
