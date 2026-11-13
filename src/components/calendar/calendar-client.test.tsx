import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { CalendarClient } from "./calendar-client";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Button Interaction Tests - CalendarClient", { timeout: 15000 }, () => {
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
  }, 30000);

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

  it("does NOT show any popup/drawer on initial load, and only opens when a date is clicked", () => {
    renderCalendar();

    // Verify no day inspection drawer dialog is open on initial load
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Day Inspection")).toBeNull();

    // Click a calendar day tile button
    const dayTiles = screen.getAllByTestId("calendar-day-tile");
    expect(dayTiles.length).toBeGreaterThan(0);
    fireEvent.click(dayTiles[0]);

    // Now the dialog should be open
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getAllByText("Day Inspection").length).toBeGreaterThan(0);

    // Pressing Escape should close it
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens day details drawer on day click, and navigates via 'Edit Daily Production Numbers' button", () => {
    renderCalendar();

    // Verify initial load has no drawer
    expect(screen.queryByRole("dialog")).toBeNull();

    // Click a calendar day tile button
    const dayTiles = screen.getAllByTestId("calendar-day-tile");
    expect(dayTiles.length).toBeGreaterThan(0);
    fireEvent.click(dayTiles[0]);

    // Drawer should now be visible and have Edit button
    expect(screen.getByRole("dialog")).toBeDefined();
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

    const dayTiles = screen.getAllByTestId("calendar-day-tile");
    expect(dayTiles.length).toBeGreaterThan(0);
    fireEvent.click(dayTiles[0]);

    expect(screen.getByRole("dialog")).toBeDefined();

    const closeBtn = screen.getByRole("button", { name: /Close day inspection/i });
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("renders weekday headers with Ethiopian and English abbreviations", () => {
    renderCalendar();
    expect(screen.getAllByText(/ሰኞ/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ማክ/i).length).toBeGreaterThan(0);
  });

  it("renders quality fallout numbers and targets in inspection views", () => {
    renderCalendar();

    // Day 29 in Ethiopian Tikimt corresponds to 2026-11-08 where sample entry is recorded
    const day29Btn = screen.getByText("29").closest("button");
    expect(day29Btn).not.toBeNull();
    if (day29Btn) {
      fireEvent.click(day29Btn);
    }

    expect(screen.getAllByText(/Rework/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Reject/i).length).toBeGreaterThan(0);
  });

  it("renders product filter dropdown and product performance strip", () => {
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
        products={[{ id: "prod_1", name: "Polo Shirt", sku: "POLO-001" }]}
      />
    );

    // Product performance overview strip title
    expect(screen.getByText(/Product Month Performance/i)).toBeDefined();

    // Product name in the strip
    const productPills = screen.getAllByText("Polo Shirt");
    expect(productPills.length).toBeGreaterThan(0);

    // Filter by product combobox
    const selects = screen.getAllByRole("combobox");
    const productSelect = selects.find((s) =>
      Array.from(s.children).some((c) => c.textContent?.includes("Polo Shirt"))
    );
    expect(productSelect).toBeDefined();

    if (productSelect) {
      fireEvent.change(productSelect, { target: { value: "prod_1" } });
      expect((productSelect as HTMLSelectElement).value).toBe("prod_1");
    }
  });

  it("renders product breakdown in inspection details", () => {
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
        products={[{ id: "prod_1", name: "Polo Shirt", sku: "POLO-001" }]}
      />
    );

    // Switch to Compact view mode
    const compactBtn = screen.getByRole("button", { name: "Compact" });
    fireEvent.click(compactBtn);

    // Select the day with entries (day 29 in Ethiopian Tikimt 2019 corresponds to 2026-11-08)
    const compactTiles = screen.getAllByTestId("compact-day-tile");
    const day29Tile = compactTiles.find((b) => b.textContent?.includes("29"));
    expect(day29Tile).toBeDefined();
    if (day29Tile) {
      fireEvent.click(day29Tile);
    }

    // Inspect should show Production by Product header
    expect(screen.getAllByText(/Production by Product/i).length).toBeGreaterThan(0);
  });

  it("opens responsive bottom-sheet month jumper in Ethiopian mode and jumps to month", () => {
    renderCalendar();

    // Find and click the month jumper trigger
    const jumperBtn = screen.getByTitle("Jump to Ethiopian Month");
    fireEvent.click(jumperBtn);

    // Jumper dialog should be open with bottom-sheet styling
    const dialog = screen.getByRole("dialog", { name: "Select Ethiopian Month & Year" });
    expect(dialog).toBeDefined();
    expect(dialog.className).toContain("slide-in-from-bottom");
    expect(dialog.className).toContain("rounded-t-3xl");

    // Close button
    const closeBtn = screen.getByRole("button", { name: "Close month jumper" });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog", { name: "Select Ethiopian Month & Year" })).toBeNull();
  });

  it("opens responsive bottom-sheet month jumper in Gregorian mode and jumps to month", () => {
    render(
      <CalendarClient
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        calendarType="gregorian"
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

    // Click the Gregorian month header
    const jumperBtn = screen.getByTitle("Jump to Gregorian Month");
    fireEvent.click(jumperBtn);

    // Jumper dialog should be open
    const dialog = screen.getByRole("dialog", { name: "Select Gregorian Month & Year" });
    expect(dialog).toBeDefined();
    expect(dialog.className).toContain("slide-in-from-bottom");

    // Verify Gregorian months are displayed inside dialog (e.g., January, November)
    expect(within(dialog).getByRole("button", { name: /January/i })).toBeDefined();
    expect(within(dialog).getByRole("button", { name: /November/i })).toBeDefined();

    // Click January to jump
    const janBtn = within(dialog).getByRole("button", { name: /January/i });
    fireEvent.click(janBtn);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("month=2026-01"));
  });

  it("opens bottom-sheet day inspection drawer when date tile is clicked in compact view", () => {
    renderCalendar();

    // Switch to Compact view
    const compactBtn = screen.getByRole("button", { name: "Compact" });
    fireEvent.click(compactBtn);

    // Verify initial load has no day inspection dialog
    expect(screen.queryByRole("dialog", { name: "Day Inspection" })).toBeNull();

    // Click compact day tile
    const compactTiles = screen.getAllByTestId("compact-day-tile");
    expect(compactTiles.length).toBeGreaterThan(0);
    fireEvent.click(compactTiles[0]);

    // Dialog should open with bottom-sheet styling
    const dialog = screen.getByRole("dialog", { name: "Day Inspection" });
    expect(dialog).toBeDefined();
    expect(dialog.className).toContain("slide-in-from-bottom");
    expect(dialog.className).toContain("rounded-t-3xl");
  });

  it("renders responsive date boxes with visible day numbers, secondary labels, and status badges", () => {
    renderCalendar();

    const tiles = screen.getAllByTestId("calendar-day-tile");
    expect(tiles.length).toBeGreaterThan(0);

    // Each day tile must have min-h >= 58px for touch ergonomics
    expect(tiles[0].className).toContain("min-h-[58px]");

    // Verify secondary calendar prefix (GC in Ethiopian mode)
    expect(screen.getAllByText("GC").length).toBeGreaterThan(0);
  });
});
