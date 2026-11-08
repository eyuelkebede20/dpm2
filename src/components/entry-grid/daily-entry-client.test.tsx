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
});
