import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { DailyEntryClient, GridRowData } from "./daily-entry-client";
import * as reportActions from "@/actions/report-actions";
import * as reviewActions from "@/actions/review-actions";

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
  saveDailyReportBatchAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/actions/review-actions", () => ({
  markDailyReportReviewedAction: vi.fn().mockResolvedValue({
    success: true,
    review: {
      id: "rev_1",
      factoryId: "fac_1",
      date: "2026-11-08",
      status: "reviewed",
      reviewedBy: "om_1",
      reviewerName: "Dawit OM",
      reviewedAt: "2026-11-08T15:00:00.000Z",
      note: null,
    },
  }),
  unmarkDailyReportReviewedAction: vi.fn().mockResolvedValue({ success: true }),
  reviewItemAction: vi.fn().mockResolvedValue({
    success: true,
    itemReview: {
      status: "approved",
      reviewedAt: "2026-11-08T15:00:00.000Z",
      note: null,
    },
  }),
  updateDailyPlanAction: vi.fn().mockResolvedValue({
    success: true,
    plan: {
      id: "plan_1",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      initialPlannedQty: 2500,
      plannedQty: 3000,
      dailyTarget: 120,
    },
  }),
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
      expect(reportActions.saveDailyReportBatchAction).toHaveBeenCalledTimes(1);
    });
  });

  it("locks inputs, displays locked banner and replaces save button with completion badge when isDaySubmitted is true for FM", () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
        isDaySubmitted={true}
      />
    );

    // Verify "Daily Data Entry Completed" banner is displayed
    expect(
      screen.getAllByText(/Daily Data Entry Completed/i).length
    ).toBeGreaterThan(0);

    // Verify "Save Daily Numbers" button is NOT rendered
    expect(screen.queryByText(/Save Daily Numbers/i)).toBeNull();

    // Verify completion badge is rendered in the bottom action bar
    expect(
      screen.getByText(/Daily Entry Completed \(የዕለቱ መረጃ ተመዝግቧል\)/i)
    ).toBeDefined();

    // Verify steppers/inputs are disabled (read-only)
    const inputs = screen.getAllByRole("textbox");
    const numInputs = document.querySelectorAll("input[type='number'], input[inputmode='numeric']");
    numInputs.forEach((input) => {
      expect((input as HTMLInputElement).disabled).toBe(true);
    });
  });

  it("locks inputs immediately after FM saves daily numbers (strict one data entry per day)", async () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="fm"
        isDaySubmitted={false}
      />
    );

    // Initially save button exists
    const saveBtn = screen.getByRole("button", { name: /save daily numbers/i });
    expect(saveBtn).toBeDefined();

    // Dirty the state
    const incBtns = screen.getAllByRole("button", { name: /increase quantity/i });
    fireEvent.click(incBtns[0]);

    // Save numbers
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(reportActions.saveDailyReportBatchAction).toHaveBeenCalledTimes(1);
    });

    // Verify screen transitioned to locked completed state
    await waitFor(() => {
      expect(
        screen.getAllByText(/Daily Data Entry Completed/i).length
      ).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: /save daily numbers/i })).toBeNull();
    });
  });

  it("allows Sys Admin to edit even when isDaySubmitted is true (admin override)", () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-08"
        factoryId="fac_1"
        factoryName="Addis Ababa Plant"
        workingDays={[1, 2, 3, 4, 5, 6]}
        initialRows={sampleRows}
        userRole="sys_admin"
        isDaySubmitted={true}
      />
    );

    // Verify Admin Override banner is displayed
    expect(screen.getByText(/Admin Override Mode/i)).toBeDefined();

    // Verify Save Daily Numbers button is rendered for Sys Admin
    expect(screen.getByRole("button", { name: /save daily numbers/i })).toBeDefined();
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
    expect(screen.getByText("Initial Set Plan")).toBeDefined();
    expect(screen.getAllByText("Edited Plan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Left from Plan")).toBeDefined();

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

  describe("Operation Manager (OM) Review & Read-Only Tests", () => {
    it("renders read-only mode banner and disables editing for OM role", () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="om"
        />
      );

      // Verify OM banner is displayed
      expect(
        screen.getByText(/Operation Manager Review Mode/i)
      ).toBeDefined();
      expect(screen.getAllByText(/Read-Only/i).length).toBeGreaterThan(0);

      // Verify "Save Daily Numbers" button is NOT rendered
      expect(screen.queryByText("Save Daily Numbers")).toBeNull();

      // Verify "Mark as Reviewed" button is displayed
      expect(
        screen.getByRole("button", { name: /Mark as Reviewed/i })
      ).toBeDefined();

      // Verify inputs are disabled
      const numericInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>("input[inputmode='numeric']")
      );
      expect(numericInputs.length).toBeGreaterThan(0);
      numericInputs.forEach((input) => {
        expect(input.disabled).toBe(true);
      });
    });

    it("allows OM to click Mark as Reviewed and updates state", async () => {
      vi.mocked(reviewActions.markDailyReportReviewedAction).mockResolvedValueOnce({
        success: true,
        review: {
          id: "rev_1",
          factoryId: "fac_1",
          date: "2026-11-08",
          status: "reviewed",
          reviewedBy: "om_1",
          reviewerName: "Dawit OM",
          reviewedAt: "2026-11-08T15:00:00.000Z",
          note: null,
        },
      });

      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="om"
        />
      );

      const reviewBtn = screen.getByRole("button", {
        name: /Mark as Reviewed/i,
      });
      fireEvent.click(reviewBtn);

      await waitFor(() => {
        expect(
          reviewActions.markDailyReportReviewedAction
        ).toHaveBeenCalledWith({
          factoryId: "fac_1",
          date: "2026-11-08",
        });
      });

      // After review succeeds, check that "Reviewed by Dawit OM" appears
      await waitFor(() => {
        expect(screen.getAllByText(/Reviewed by Dawit OM/i).length).toBeGreaterThan(0);
      });
    });

    it("displays reviewed badge and allows revoking review when report is already reviewed", async () => {
      vi.mocked(reviewActions.unmarkDailyReportReviewedAction).mockResolvedValueOnce({
        success: true,
      });

      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="om"
          reportReview={{
            isReviewed: true,
            reviewedBy: "om_1",
            reviewerName: "Dawit OM",
            reviewedAt: "2026-11-08T15:00:00.000Z",
            note: null,
          }}
        />
      );

      expect(screen.getAllByText(/Reviewed by Dawit OM/i).length).toBeGreaterThan(0);
      const revokeBtn = screen.getByRole("button", { name: /Revoke Review/i });
      expect(revokeBtn).toBeDefined();

      fireEvent.click(revokeBtn);

      await waitFor(() => {
        expect(
          reviewActions.unmarkDailyReportReviewedAction
        ).toHaveBeenCalledWith({
          factoryId: "fac_1",
          date: "2026-11-08",
        });
      });
    });
  });

  describe("QA Review Status Display Tests", () => {
    it("displays QA review section at the bottom of the report card when reviewed", () => {
      const rowsWithQA: GridRowData[] = [
        {
          ...sampleRows[0],
          qaReview: {
            status: "approved",
            isReviewed: true,
            inspectorId: "qa_1",
            inspectorName: "Abebe Kebede",
            checked: 500,
            defects: 5,
            defectRate: 1.0,
            note: "Quality within acceptable tolerance",
            createdAt: "2026-11-08T14:30:00.000Z",
          },
        },
      ];

      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={rowsWithQA}
          userRole="fm"
        />
      );

      // Switch to Card View
      const cardsBtn = screen.getByTitle(/Card View/i);
      fireEvent.click(cardsBtn);

      // Verify QA review section at bottom of card
      expect(screen.getByText("QA Section Review (የጥራት ቁጥጥር ክለሳ)")).toBeDefined();
      expect(screen.getByText(/QA Approved \(ፅድቅ \/ Spec OK\)/i)).toBeDefined();
      expect(screen.getByText("Abebe Kebede")).toBeDefined();
      expect(screen.getByText("500 pcs")).toBeDefined();
      expect(screen.getByText("5 (1%)")).toBeDefined();
      expect(screen.getByText("Quality within acceptable tolerance")).toBeDefined();
    });

    it("displays 'Not Reviewed by QA' state on report card when pending inspection", () => {
      const rowsPendingQA: GridRowData[] = [
        {
          ...sampleRows[0],
          qaReview: {
            isReviewed: false,
            inspectorId: null,
            inspectorName: null,
            checked: 0,
            defects: 0,
            defectRate: 0,
            note: null,
            createdAt: null,
          },
        },
      ];

      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={rowsPendingQA}
          userRole="fm"
        />
      );

      // Switch to Card View
      const cardsBtn = screen.getByTitle(/Card View/i);
      fireEvent.click(cardsBtn);

      expect(screen.getByText("Pending QA Inspection")).toBeDefined();
      expect(
        screen.getByText("Pending inspection by QA section for this product line.")
      ).toBeDefined();
    });

    it("displays QA Review column header and status in Table View", () => {
      const rowsWithQA: GridRowData[] = [
        {
          ...sampleRows[0],
          qaReview: {
            status: "denied",
            isReviewed: true,
            inspectorId: "qa_1",
            inspectorName: "Abebe Kebede",
            checked: 500,
            defects: 5,
            defectRate: 1.0,
            note: null,
            createdAt: "2026-11-08T14:30:00.000Z",
          },
        },
      ];

      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={rowsWithQA}
          userRole="fm"
        />
      );

      // Table View
      expect(screen.getByText("QA Review")).toBeDefined();
      expect(screen.getByText(/QA Denied/i)).toBeDefined(); // 5 defects > 0 -> QA Denied
      expect(screen.getByText("by Abebe Kebede")).toBeDefined();
      expect(screen.getByText("5 defects (1%)")).toBeDefined();
    });

    it("displays QA Approved when defects is 0 and QA Denied when defects is > 0", () => {
      const rowsZeroDefects: GridRowData[] = [
        {
          ...sampleRows[0],
          qaReview: {
            isReviewed: true,
            status: "approved",
            verdict: "QA Approved",
            inspectorId: "qa_1",
            inspectorName: "Abebe Kebede",
            checked: 500,
            defects: 0,
            defectRate: 0,
            note: "All good",
            createdAt: "2026-11-08T14:30:00.000Z",
          },
        },
      ];

      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={rowsZeroDefects}
          userRole="fm"
        />
      );

      expect(screen.getByText(/QA Approved/i)).toBeDefined();
      expect(screen.getByText("0 defects (0%)")).toBeDefined();
    });
  });

  describe("Operation Manager Item Reviews & Daily Plan Editing", () => {
    it("allows OM to review per-item (approve or deny) and calls reviewItemAction", async () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="om"
        />
      );

      // Verify OM Review column header is rendered
      expect(screen.getByText("OM Review")).toBeDefined();
      expect(screen.getByText("Pending OM")).toBeDefined();

      // Click Approve button in table
      const approveBtn = screen.getByRole("button", { name: /Approve/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(reviewActions.reviewItemAction).toHaveBeenCalledWith({
          factoryId: "fac_1",
          date: "2026-11-08",
          lineId: "line_1",
          productId: "prod_1",
          status: "approved",
        });
      });

      // Click Deny button in table
      const denyBtn = screen.getByRole("button", { name: /Deny/i });
      fireEvent.click(denyBtn);

      await waitFor(() => {
        expect(reviewActions.reviewItemAction).toHaveBeenCalledWith({
          factoryId: "fac_1",
          date: "2026-11-08",
          lineId: "line_1",
          productId: "prod_1",
          status: "denied",
        });
      });
    });

    it("displays Initial Set Plan and Edited Plan side by side in table and card view", () => {
      const rowsWithPreservedPlan: GridRowData[] = [
        {
          ...sampleRows[0],
          plan: {
            id: "plan_1",
            startDate: "2026-11-01",
            endDate: "2026-11-30",
            initialPlannedQty: 2500,
            plannedQty: 3200,
            weeklyPlanned: 3200,
            dailyTarget: 128,
          },
        },
      ];

      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={rowsWithPreservedPlan}
          userRole="om"
        />
      );

      // In Table View: both Initial Set Plan and Edited Plan headers and values are visible
      expect(screen.getAllByText("Initial Set Plan").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Edited Plan").length).toBeGreaterThan(0);
      expect(screen.getByText("2,500")).toBeDefined();
      expect(screen.getByText("3,200")).toBeDefined();

      // Switch to Card View
      const cardsBtn = screen.getByTitle(/Card View/i);
      fireEvent.click(cardsBtn);

      // Verify side-by-side display on Card
      expect(screen.getAllByText("2,500 pcs").length).toBeGreaterThan(0);
      expect(screen.getAllByText("3,200 pcs").length).toBeGreaterThan(0);
      expect(screen.getByText("Baseline")).toBeDefined();
      expect(screen.getByText("Active Target")).toBeDefined();
    });

    it("allows OM to open Edit Daily Plan modal, adjust daily target, and updates annual plan", async () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-08"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="om"
        />
      );

      // Switch to Card View
      const cardsBtn = screen.getByTitle(/Card View/i);
      fireEvent.click(cardsBtn);

      // Click "Edit Daily Plan" button on Card
      const editPlanBtn = screen.getByRole("button", { name: /Edit Daily Plan/i });
      fireEvent.click(editPlanBtn);

      // Modal should open
      expect(screen.getByText("Edit Daily Plan Target")).toBeDefined();
      expect(screen.getByText("Initial Set Annual Plan")).toBeDefined();
      expect(screen.getByText("Current Edited Annual Plan")).toBeDefined();

      // Adjust Daily Target input
      const targetInput = screen.getByRole("spinbutton") as HTMLInputElement;
      fireEvent.change(targetInput, { target: { value: "150" } });

      // Click "Save Daily Plan"
      const savePlanBtn = screen.getByRole("button", { name: /Save Daily Plan/i });
      fireEvent.click(savePlanBtn);

      await waitFor(() => {
        expect(reviewActions.updateDailyPlanAction).toHaveBeenCalledWith({
          factoryId: "fac_1",
          lineId: "line_1",
          productId: "prod_1",
          date: "2026-11-08",
          planId: undefined,
          newDailyTarget: 150,
        });
      });
    });
  });
});
