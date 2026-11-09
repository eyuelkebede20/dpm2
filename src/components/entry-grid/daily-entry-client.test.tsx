import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DailyEntryClient, GridRowData } from "./daily-entry-client";
import * as reportActions from "@/actions/report-actions";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/actions/report-actions", () => ({
  saveDailyReportEntryAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Button Interaction Tests - DailyEntryClient", () => {
  const sampleRows: GridRowData[] = [
    {
      lineId: "line_1",
      lineName: "Sewing Line 1",
      productId: "prod_1",
      productName: "T-Shirt",
      sku: "TS-01",
      plan: {
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 2500,
      },
      entry: {
        finishedGood: 100,
        rework: 2,
        reject: 1,
        scrap: 0,
        wip: 10,
        downtimeMinutes: 0,
        issueNote: null,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("switches view mode when Table and Cards buttons are clicked", () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
      />
    );

    const cardsBtn = screen.getByTitle(/Card View/i);
    const tableBtn = screen.getByTitle(/Table View/i);

    expect(cardsBtn).toBeDefined();
    expect(tableBtn).toBeDefined();

    // Click cards view
    fireEvent.click(cardsBtn);
    expect(screen.getByText("Sewing Line 1")).toBeDefined();

    // Click table view back
    fireEvent.click(tableBtn);
    expect(screen.getByRole("table")).toBeDefined();
  });

  it("navigates to previous day, next day, and today when date buttons are clicked", () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
      />
    );

    const prevDayBtn = screen.getByTitle("Previous Day");
    const nextDayBtn = screen.getByTitle("Next Day");
    const todayBtn = screen.getByRole("button", { name: "Today" });

    // Click Previous Day (2026-11-08 -> 2026-11-07)
    fireEvent.click(prevDayBtn);
    expect(mockPush).toHaveBeenCalledWith("/entry?date=2026-11-07");

    // Click Next Day (2026-11-08 -> 2026-11-09)
    fireEvent.click(nextDayBtn);
    expect(mockPush).toHaveBeenCalledWith("/entry?date=2026-11-09");

    // Click Today
    fireEvent.click(todayBtn);
    expect(mockPush).toHaveBeenCalled();
  });

  it("disables save button when there are no changes, and enables when modified", () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
      />
    );

    const saveBtn = screen.getByRole("button", { name: /save daily numbers/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    // Click Increase quantity button on Finished Goods
    const incBtns = screen.getAllByRole("button", { name: /increase quantity/i });
    fireEvent.click(incBtns[0]);

    // Save button should now be enabled
    expect(saveBtn.disabled).toBe(false);
  });

  it("triggers save action and displays feedback when 'Save Daily Numbers' button is clicked", async () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
      />
    );

    const incBtns = screen.getAllByRole("button", { name: /increase quantity/i });
    fireEvent.click(incBtns[0]);

    const saveBtn = screen.getByRole("button", { name: /save daily numbers/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(reportActions.saveDailyReportEntryAction).toHaveBeenCalledTimes(1);
    });
  });

  it("resets edits when 'Reset' button is clicked", () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
      />
    );

    const incBtns = screen.getAllByRole("button", { name: /increase quantity/i });
    fireEvent.click(incBtns[0]);

    const resetBtn = screen.getByRole("button", { name: /reset/i });
    expect(resetBtn).toBeDefined();

    fireEvent.click(resetBtn);

    // After reset, save button should become disabled again
    const saveBtn = screen.getByRole("button", { name: /save daily numbers/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("displays special day holiday banner and sets target to 0 when non-working specialDay is passed", () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
        specialDay={{
          nameEn: "Victory Day",
          nameAm: "የድል ቀን",
          type: "holiday",
          isWorkingDay: false,
        }}
      />
    );

    expect(screen.getByText(/Special Off-Day: Victory Day \(የድል ቀን\)/i)).toBeDefined();
    expect(screen.getByText(/Daily Target: 0/i)).toBeDefined();
    expect(screen.getByText("holiday")).toBeDefined();
  });

  it("populates issue note when a downtime reason template is selected", () => {
    const downtimeReasons = [
      {
        id: "dtr_1",
        code: "DOW-01",
        nameEn: "Tool Wear",
        nameAm: "የመሳሪያ መሸርሸር",
        category: "tooling",
      },
      {
        id: "dtr_2",
        code: "DOW-02",
        nameEn: "Machine Fault",
        nameAm: "የማሽን ብልሽት",
        category: "machine",
      },
    ];

    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
        downtimeReasons={downtimeReasons}
      />
    );

    const select = screen.getByLabelText(/OM Reason Template/i) as HTMLSelectElement;
    expect(select).toBeDefined();

    // Select DOW-01
    fireEvent.change(select, { target: { value: "dtr_1" } });

    const noteInput = screen.getByPlaceholderText(/Note stoppage or quality issue/i) as HTMLInputElement;
    expect(noteInput.value).toBe("[DOW-01: Tool Wear] ");

    // Change to DOW-02 and verify prefix replaced
    fireEvent.change(select, { target: { value: "dtr_2" } });
    expect(noteInput.value).toBe("[DOW-02: Machine Fault] ");
  });

  it("renders Weekly Planned and Left from Weekly Planned and dynamically recalculates remaining balance when finished goods change", () => {
    const rowsWithPlan: GridRowData[] = [
      {
        lineId: "line_1",
        lineName: "Sewing Line 1",
        productId: "prod_1",
        productName: "T-Shirt",
        sku: "TS-01",
        plan: {
          startDate: "2026-11-01",
          endDate: "2026-11-30",
          plannedQty: 2500,
          weeklyPlanned: 2500,
          priorFinishedGood: 500,
        },
        entry: {
          finishedGood: 100,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
          issueNote: null,
        },
      },
    ];

    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={rowsWithPlan}
        userRole="fm"
      />
    );

    // Verify headers
    expect(screen.getByText("Weekly Planned")).toBeDefined();
    expect(screen.getByText("Left from Weekly Planned")).toBeDefined();

    // Prior 500 + current 100 = 600 total produced. Remaining: 2500 - 600 = 1900.
    expect(screen.getByText("1,900")).toBeDefined();
    expect(screen.getByText("600 produced")).toBeDefined();

    // Increase finished good by 1 (using +1 quick-add or stepper)
    const incBtns = screen.getAllByRole("button", { name: /increase quantity/i });
    fireEvent.click(incBtns[0]); // FG is now 101 -> total 601 -> Left: 1899

    expect(screen.getByText("1,899")).toBeDefined();
    expect(screen.getByText("601 produced")).toBeDefined();
  });

  it("filters rows and displays product performance strip", () => {
    const multiProductRows: GridRowData[] = [
      {
        lineId: "line_1",
        lineName: "Sewing Line 1",
        productId: "prod_1",
        productName: "T-Shirt",
        sku: "TS-01",
        plan: {
          startDate: "2026-11-01",
          endDate: "2026-11-30",
          plannedQty: 2500,
        },
        entry: {
          finishedGood: 120,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
          issueNote: null,
        },
      },
      {
        lineId: "line_2",
        lineName: "Sewing Line 2",
        productId: "prod_2",
        productName: "Denim Jeans",
        sku: "DJ-02",
        plan: {
          startDate: "2026-11-01",
          endDate: "2026-11-30",
          plannedQty: 1000,
        },
        entry: {
          finishedGood: 80,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
          issueNote: null,
        },
      },
    ];

    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={multiProductRows}
        userRole="fm"
      />
    );

    // Verify Product Performance Overview Strip is rendered
    expect(screen.getByText(/Product Performance Overview/i)).toBeDefined();
    expect(screen.getByText("All Products")).toBeDefined();

    // Verify Product filter dropdown
    const productFilter = screen.getByLabelText(/Filter by Product/i) as HTMLSelectElement;
    expect(productFilter).toBeDefined();

    // Select Denim Jeans
    fireEvent.change(productFilter, { target: { value: "prod_2" } });

    // Sewing Line 2 should be displayed, and Sewing Line 1 hidden
    expect(screen.getByText("Sewing Line 2")).toBeDefined();
    expect(screen.queryByText("Sewing Line 1")).toBeNull();
  });

  it("toggles between 'By Product' and 'By Line' grouping modes", () => {
    const multiProductRows: GridRowData[] = [
      {
        lineId: "line_1",
        lineName: "Sewing Line 1",
        productId: "prod_1",
        productName: "T-Shirt",
        sku: "TS-01",
        plan: null,
        entry: {
          finishedGood: 100,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
          issueNote: null,
        },
      },
    ];

    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={multiProductRows}
        userRole="fm"
      />
    );

    const byProductBtn = screen.getByTitle(/Display Based on Product/i);
    const byLineBtn = screen.getByTitle(/Flat Line View/i);

    expect(byProductBtn).toBeDefined();
    expect(byLineBtn).toBeDefined();

    // Switch to By Line
    fireEvent.click(byLineBtn);
    expect(screen.getByText(/Active Production Lines/i)).toBeDefined();

    // Switch back to By Product
    fireEvent.click(byProductBtn);
    expect(screen.getByText(/Grouped By Product/i)).toBeDefined();
  });
});
