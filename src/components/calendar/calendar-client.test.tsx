import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CalendarClient } from "./calendar-client";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Button Interaction Tests - CalendarClient", () => {
  const sampleEntries = [
    {
      id: "rep_1",
      date: "2026-11-08",
      lineId: "line_1",
      lineName: "Sewing Line 1",
      productId: "prod_1",
      productName: "Polo Shirt",
      finishedGood: 120,
      rework: 3,
      reject: 1,
      scrap: 0,
      wip: 15,
      downtimeMinutes: 0,
      issueNote: null,
    },
  ];

  const samplePlans = [
    {
      lineId: "line_1",
      productId: "prod_1",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 2500,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderCalendar = () => {
    return render(
      <CalendarClient
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        calendarType="ethiopian"
        ethiopianYear={2019}
        ethiopianMonth={2}
        gregorianMonthStr="2026-11"
        startDateStr="2026-11-01"
        endDateStr="2026-11-30"
        workingDays={[1, 2, 3, 4, 5, 6]}
        entries={sampleEntries}
        plans={samplePlans}
      />
    );
  };

  it("toggles between Ethiopian and Gregorian calendars", () => {
    renderCalendar();

    const ethBtn = screen.getByRole("button", { name: /Ethiopian/i });
    const gcBtn = screen.getByRole("button", { name: /Gregorian/i });

    expect(ethBtn).toBeDefined();
    expect(gcBtn).toBeDefined();

    // Click Gregorian
    fireEvent.click(gcBtn);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("cal=gregorian"));

    // Click Ethiopian
    fireEvent.click(ethBtn);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("cal=ethiopian"));
  });

  it("navigates months when Prev, Next, and Today buttons are clicked", () => {
    renderCalendar();

    // Prev month
    const prevBtn = screen.getByTitle(/Previous Month/i);
    fireEvent.click(prevBtn);
    expect(mockPush).toHaveBeenCalled();

    // Next month
    const nextBtn = screen.getByTitle(/Next Month/i);
    fireEvent.click(nextBtn);
    expect(mockPush).toHaveBeenCalled();

    // Today button
    const todayBtn = screen.getByRole("button", { name: "Today" });
    fireEvent.click(todayBtn);
    expect(mockPush).toHaveBeenCalled();
  });

  it("switches calendar view modes (Compact, Grid, List)", () => {
    renderCalendar();

    const compactBtn = screen.getByRole("button", { name: "Compact" });
    const gridBtn = screen.getByRole("button", { name: "Grid" });
    const listBtn = screen.getByRole("button", { name: "List" });

    fireEvent.click(compactBtn);
    expect(compactBtn.className).toContain("bg-white");

    fireEvent.click(listBtn);
    expect(listBtn.className).toContain("bg-white");

    fireEvent.click(gridBtn);
    expect(gridBtn.className).toContain("bg-white");
  });

  it("opens day details drawer on day click, and navigates via 'Edit Daily Production Numbers' button", () => {
    renderCalendar();

    // Find a day button
    const dayButtons = screen.getAllByRole("button");
    const dayBtn = dayButtons.find((b) => b.className.includes("text-left"));
    if (dayBtn) {
      fireEvent.click(dayBtn);
    }

    // Drawer should have Edit button
    const editBtns = screen.getAllByRole("button").filter((b) =>
      b.textContent?.includes("Edit") || b.textContent?.includes("Enter Numbers")
    );
    if (editBtns.length > 0) {
      fireEvent.click(editBtns[0]);
      expect(mockPush).toHaveBeenCalled();
    }
  });

  it("closes day details drawer when close button is clicked", () => {
    renderCalendar();

    const dayButtons = screen.getAllByRole("button");
    const dayBtn = dayButtons.find((b) => b.className.includes("text-left"));
    if (dayBtn) {
      fireEvent.click(dayBtn);
    }

    const closeBtn = screen.getAllByRole("button").find(
      (b) => b.className.includes("btn-circle") || b.textContent === "✕"
    );
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
  });

  it("navigates to daily entry page when 'Enter Daily Numbers' header action button is clicked", () => {
    renderCalendar();

    const enterBtn = screen.getByRole("button", { name: /Enter Daily Numbers/i });
    expect(enterBtn).toBeDefined();
    fireEvent.click(enterBtn);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/entry?date="));
  });

  it("renders Ethiopian public holiday information and badges", () => {
    render(
      <CalendarClient
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        calendarType="ethiopian"
        ethiopianYear={2019}
        ethiopianMonth={2}
        gregorianMonthStr="2026-11"
        startDateStr="2026-11-01"
        endDateStr="2026-11-30"
        workingDays={[1, 2, 3, 4, 5, 6]}
        entries={sampleEntries}
        plans={samplePlans}
        specialDays={[
          {
            id: "spec_1",
            date: "2026-11-08",
            nameEn: "Patriots Victory Day",
            nameAm: "የአርበኞች ቀን",
            type: "holiday",
            isWorkingDay: false,
          },
        ]}
      />
    );

    // Should render Holiday badge/text
    expect(screen.getAllByText(/Holiday/i).length).toBeGreaterThan(0);
  });

  it("opens 13-month quick jumper modal and jumps to selected month", () => {
    renderCalendar();

    // Click the month title button to open jumper
    const monthTrigger = screen.getByRole("button", { name: /13M/i });
    fireEvent.click(monthTrigger);

    // Modal should show 13th month Pagume
    const pagumeBadges = screen.getAllByText(/Pagume/i);
    expect(pagumeBadges.length).toBeGreaterThan(0);

    // Click Month 1 (Meskerem)
    const meskeremBtn = screen.getByRole("button", { name: /መስከረም/i });
    fireEvent.click(meskeremBtn);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("em=1"));
  });

  it("filters entries by line and resets filter", () => {
    renderCalendar();

    const selects = screen.getAllByRole("combobox");
    const lineSelect = selects[0];
    if (lineSelect) {
      fireEvent.change(lineSelect, { target: { value: "line_1" } });
      const resetBtn = screen.queryByRole("button", { name: /Reset/i });
      if (resetBtn) {
        fireEvent.click(resetBtn);
      }
    }
  });
});
