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
      date: "2026-11-13",
      status: "reviewed",
      reviewedBy: "om_1",
      reviewerName: "Dawit OM",
      reviewedAt: "2026-11-13T15:00:00.000Z",
      note: null,
    },
  }),
  unmarkDailyReportReviewedAction: vi.fn().mockResolvedValue({ success: true }),
  reviewItemAction: vi.fn().mockResolvedValue({
    success: true,
    itemReview: {
      status: "approved",
      reviewedAt: "2026-11-13T15:00:00.000Z",
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
  sendReportReminderAction: vi.fn().mockResolvedValue({
    success: true,
    notifiedCount: 2,
    recipients: ["Abebe FM", "Chala FM"],
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-12"
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

    // Click Previous Day (2026-11-12 -> 2026-11-11)
    fireEvent.click(prevDayBtn);
    expect(mockPush).toHaveBeenCalledWith("/entry?date=2026-11-11");

    // Click Next Day (2026-11-12 -> 2026-11-13)
    fireEvent.click(nextDayBtn);
    expect(mockPush).toHaveBeenCalledWith("/entry?date=2026-11-13");

    // Click Today
    fireEvent.click(todayBtn);
    expect(mockPush).toHaveBeenCalled();
  });

  it("disables save button when there are no changes, and enables when modified", () => {
    render(
      <DailyEntryClient
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
        initialDate="2026-11-13"
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
          initialDate="2026-11-13"
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
          date: "2026-11-13",
          status: "reviewed",
          reviewedBy: "om_1",
          reviewerName: "Dawit OM",
          reviewedAt: "2026-11-13T15:00:00.000Z",
          note: null,
        },
      });

      render(
        <DailyEntryClient
          initialDate="2026-11-13"
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
          date: "2026-11-13",
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
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="om"
          reportReview={{
            isReviewed: true,
            reviewedBy: "om_1",
            reviewerName: "Dawit OM",
            reviewedAt: "2026-11-13T15:00:00.000Z",
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
          date: "2026-11-13",
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
            createdAt: "2026-11-13T14:30:00.000Z",
          },
        },
      ];

      render(
        <DailyEntryClient
          initialDate="2026-11-13"
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
          initialDate="2026-11-13"
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
            createdAt: "2026-11-13T14:30:00.000Z",
          },
        },
      ];

      render(
        <DailyEntryClient
          initialDate="2026-11-13"
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
            createdAt: "2026-11-13T14:30:00.000Z",
          },
        },
      ];

      render(
        <DailyEntryClient
          initialDate="2026-11-13"
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
          initialDate="2026-11-13"
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
          date: "2026-11-13",
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
          date: "2026-11-13",
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
          initialDate="2026-11-13"
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
          initialDate="2026-11-13"
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
          date: "2026-11-13",
          planId: undefined,
          newDailyTarget: 150,
        });
      });
    });

    it("displays warning signs for factories and products that did not get review", () => {
      // Unreviewed rows and no reportReview
      render(
        <DailyEntryClient
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="fm"
          reportReview={null}
        />
      );

      // Warning banner for unreviewed daily report
      expect(screen.getByText(/Unreviewed Daily Report/i)).toBeDefined();
      expect(screen.getByText(/Review Pending/i)).toBeDefined();

      // Warning badge on product row for unreviewed product
      expect(screen.getAllByText("Unreviewed").length).toBeGreaterThan(0);
    });

    it("allows Operation Manager to send reminder notifications to Factory Managers", async () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="om"
          reportReview={null}
        />
      );

      // Find "Notify Factory Managers" button in the unreviewed banner
      const notifyBtn = screen.getByRole("button", { name: /Notify Factory Managers/i });
      fireEvent.click(notifyBtn);

      await waitFor(() => {
        expect(reviewActions.sendReportReminderAction).toHaveBeenCalledWith({
          factoryId: "fac_1",
          date: "2026-11-13",
        });
      });
    });

    it("strictly locks editing and alterations for Factory Managers when viewing a past month", () => {
      // 2025-01-10 is a past month relative to 2026-11
      render(
        <DailyEntryClient
          initialDate="2025-01-10"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="fm"
        />
      );

      // Lockout banner should be visible
      expect(screen.getByText(/Reporting Period Closed/i)).toBeDefined();
      expect(screen.getByText(/Month Passed • Locked/i)).toBeDefined();

      // Save bar should show locked message
      expect(screen.getAllByText(/Reporting Window Closed/i).length).toBeGreaterThan(0);

      // Numeric stepper buttons should be disabled
      const stepperMinusBtns = screen.getAllByRole("button", { name: /decrease/i });
      stepperMinusBtns.forEach((btn) => {
        expect(btn).toHaveProperty("disabled", true);
      });
    });

    it("opens responsive Ethiopian date picker bottom-sheet when Ethiopian calendar option is touched", () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="fm"
          calendarSystem="ethiopian"
        />
      );

      // Verify no date picker dialog is open initially
      expect(screen.queryByRole("dialog", { name: "Ethiopian Date Selection" })).toBeNull();

      // Click the Ethiopian calendar date button in the toolbar
      const ethDateBtn = screen.getAllByTitle("ቀን ምረጥ / Select Ethiopian Date")[0];
      fireEvent.click(ethDateBtn);

      // Bottom-sheet dialog should open
      const dialog = screen.getByRole("dialog", { name: "Ethiopian Date Selection" });
      expect(dialog).toBeDefined();
      expect(dialog.className).toContain("slide-in-from-bottom");
      expect(dialog.className).toContain("rounded-t-3xl");

      // Verify 7-column weekday headers are rendered (ሰኞ to እሁድ)
      expect(screen.getByText("ሰኞ")).toBeDefined();
      expect(screen.getByText("እሁድ")).toBeDefined();

      // Verify date buttons (1 to 30) exist
      const day1Btn = screen.getByRole("button", { name: "1" });
      expect(day1Btn).toBeDefined();

      // Test Month Steppers: Click Next Month and Prev Month
      const nextMonthBtn = screen.getByRole("button", { name: "Next Month" });
      const prevMonthBtn = screen.getByRole("button", { name: "Previous Month" });
      expect(nextMonthBtn).toBeDefined();
      expect(prevMonthBtn).toBeDefined();

      // Click cancel to close
      const cancelBtn = screen.getByRole("button", { name: "ይቅር (Cancel)" });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole("dialog", { name: "Ethiopian Date Selection" })).toBeNull();
    });

    it("allows selecting a date in the Ethiopian date picker and applies navigation", () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={sampleRows}
          userRole="fm"
          calendarSystem="ethiopian"
        />
      );

      const ethDateBtn = screen.getAllByTitle("ቀን ምረጥ / Select Ethiopian Date")[0];
      fireEvent.click(ethDateBtn);

      // Select day 1
      const day1Btn = screen.getByRole("button", { name: "1" });
      fireEvent.click(day1Btn);

      // Click Apply
      const applyBtn = screen.getByRole("button", { name: "አረጋግጥ (Apply)" });
      fireEvent.click(applyBtn);

      // Navigation should be triggered
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/entry?date="));
      expect(screen.queryByRole("dialog", { name: "Ethiopian Date Selection" })).toBeNull();
    });
  });

  describe("Search, Sorting & Layout Hierarchy Tests - DailyEntryClient", () => {
    const multiLineRows: GridRowData[] = [
      {
        lineId: "line_1",
        lineName: "Sewing Line Alpha",
        productId: "prod_1",
        productName: "T-Shirt Classic",
        sku: "TS-CLASSIC",
        plan: {
          startDate: "2026-11-01",
          endDate: "2026-11-30",
          plannedQty: 2500,
          dailyTarget: 100,
        },
        entry: {
          finishedGood: 80,
          rework: 2,
          reject: 1,
          scrap: 0,
          wip: 10,
          downtimeMinutes: 0,
          issueNote: null,
        },
      },
      {
        lineId: "line_2",
        lineName: "Sewing Line Beta",
        productId: "prod_2",
        productName: "Denim Jeans",
        sku: "DJ-SLIM",
        plan: {
          startDate: "2026-11-01",
          endDate: "2026-11-30",
          plannedQty: 5000,
          dailyTarget: 200,
        },
        entry: {
          finishedGood: 250,
          rework: 5,
          reject: 2,
          scrap: 1,
          wip: 20,
          downtimeMinutes: 15,
          issueNote: null,
        },
      },
      {
        lineId: "line_3",
        lineName: "Finishing Line Gamma",
        productId: "prod_1",
        productName: "T-Shirt Classic",
        sku: "TS-CLASSIC",
        plan: {
          startDate: "2026-11-01",
          endDate: "2026-11-30",
          plannedQty: 1000,
          dailyTarget: 50,
        },
        entry: {
          finishedGood: 30,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 5,
          downtimeMinutes: 0,
          issueNote: null,
        },
      },
    ];

    it("renders unreviewed reminder and smaller KPI cards at the top before the search & controls toolbar", () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={multiLineRows}
          userRole="fm"
          reportReview={null}
        />
      );

      // Verify unreviewed report banner is displayed
      const unreviewedBanner = screen.getByText(/Unreviewed Daily Report/i);
      expect(unreviewedBanner).toBeDefined();

      // Verify KPI cards are displayed
      const totalFGCard = screen.getByText(/Total Finished Good/i);
      expect(totalFGCard).toBeDefined();

      // Verify search & sorting toolbar is displayed
      const searchInput = screen.getByLabelText(/Search lines or products/i);
      const sortSelect = screen.getByLabelText(/Sort production entries/i);
      expect(searchInput).toBeDefined();
      expect(sortSelect).toBeDefined();

      // Verify relative DOM position hierarchy:
      // Unreviewed reminder banner precedes KPI cards, which precedes search toolbar, which precedes the table
      const bannerEl = screen.getByText(/Unreviewed Daily Report/i).closest("div.rounded-2xl");
      const kpiEl = screen.getByText(/Total Finished Good/i).closest("div.card");
      const toolbarEl = searchInput.closest("div.rounded-2xl");
      const tableEl = screen.getByRole("table");

      expect(bannerEl).toBeDefined();
      expect(kpiEl).toBeDefined();
      expect(toolbarEl).toBeDefined();
      expect(tableEl).toBeDefined();

      // Check document order: banner < kpi < toolbar < table
      const allElements = Array.from(document.querySelectorAll("*"));
      const bannerIndex = allElements.indexOf(bannerEl!);
      const kpiIndex = allElements.indexOf(kpiEl!);
      const toolbarIndex = allElements.indexOf(toolbarEl!);
      const tableIndex = allElements.indexOf(tableEl);

      expect(bannerIndex).toBeLessThan(kpiIndex);
      expect(kpiIndex).toBeLessThan(toolbarIndex);
      expect(toolbarIndex).toBeLessThan(tableIndex);
    });

    it("filters production lines by search text query matching line name, product name, or SKU", () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={multiLineRows}
          userRole="fm"
        />
      );

      const searchInput = screen.getByLabelText(/Search lines or products/i) as HTMLInputElement;

      // Initially all 3 lines are present in the document
      expect(screen.getByText("Sewing Line Alpha")).toBeDefined();
      expect(screen.getByText("Sewing Line Beta")).toBeDefined();
      expect(screen.getByText("Finishing Line Gamma")).toBeDefined();

      // Search by SKU: "DJ-SLIM"
      fireEvent.change(searchInput, { target: { value: "DJ-SLIM" } });

      // Sewing Line Beta should be shown, others filtered out
      expect(screen.getByText("Sewing Line Beta")).toBeDefined();
      expect(screen.queryByText("Sewing Line Alpha")).toBeNull();
      expect(screen.queryByText("Finishing Line Gamma")).toBeNull();

      // Clear search via clear button
      const clearBtn = screen.getByLabelText("Clear search");
      fireEvent.click(clearBtn);

      // All 3 lines are visible again
      expect(screen.getByText("Sewing Line Alpha")).toBeDefined();
      expect(screen.getByText("Sewing Line Beta")).toBeDefined();
      expect(screen.getByText("Finishing Line Gamma")).toBeDefined();

      // Search by Line name: "Gamma"
      fireEvent.change(searchInput, { target: { value: "Gamma" } });
      expect(screen.getByText("Finishing Line Gamma")).toBeDefined();
      expect(screen.queryByText("Sewing Line Alpha")).toBeNull();
      expect(screen.queryByText("Sewing Line Beta")).toBeNull();

      // Click "Reset Filters"
      const resetBtn = screen.getByRole("button", { name: /Reset Filters/i });
      fireEvent.click(resetBtn);
      expect(screen.getByText("Sewing Line Alpha")).toBeDefined();
      expect(screen.getByText("Sewing Line Beta")).toBeDefined();
    });

    it("sorts entries according to selected sort criteria in flat line mode", () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={multiLineRows}
          userRole="fm"
        />
      );

      // Switch to Flat Line View so rows appear directly in table order
      const byLineBtn = screen.getByTitle(/Flat Line View/i);
      fireEvent.click(byLineBtn);

      const sortSelect = screen.getByLabelText(/Sort production entries/i) as HTMLSelectElement;

      // Sort by Finished Goods High to Low
      fireEvent.change(sortSelect, { target: { value: "fg-desc" } });

      // Line Beta (250 FG) should appear before Line Alpha (80 FG) before Line Gamma (30 FG)
      let rowsAfterSort = Array.from(document.querySelectorAll("tbody tr")).map((tr) => tr.textContent || "");
      let betaIdx = rowsAfterSort.findIndex((t) => t.includes("Sewing Line Beta"));
      let alphaIdx = rowsAfterSort.findIndex((t) => t.includes("Sewing Line Alpha"));
      let gammaIdx = rowsAfterSort.findIndex((t) => t.includes("Finishing Line Gamma"));

      expect(betaIdx).toBeGreaterThanOrEqual(0);
      expect(alphaIdx).toBeGreaterThanOrEqual(0);
      expect(gammaIdx).toBeGreaterThanOrEqual(0);
      expect(betaIdx).toBeLessThan(alphaIdx);
      expect(alphaIdx).toBeLessThan(gammaIdx);

      // Sort by Finished Goods Low to High
      fireEvent.change(sortSelect, { target: { value: "fg-asc" } });
      rowsAfterSort = Array.from(document.querySelectorAll("tbody tr")).map((tr) => tr.textContent || "");
      betaIdx = rowsAfterSort.findIndex((t) => t.includes("Sewing Line Beta"));
      alphaIdx = rowsAfterSort.findIndex((t) => t.includes("Sewing Line Alpha"));
      gammaIdx = rowsAfterSort.findIndex((t) => t.includes("Finishing Line Gamma"));

      expect(gammaIdx).toBeLessThan(alphaIdx);
      expect(alphaIdx).toBeLessThan(betaIdx);
    });

    it("shows helpful empty state when search produces 0 matches, with a Clear Search button", () => {
      render(
        <DailyEntryClient
          initialDate="2026-11-13"
          factoryId="fac_1"
          factoryName="Addis Ababa Plant"
          workingDays={[1, 2, 3, 4, 5, 6]}
          initialRows={multiLineRows}
          userRole="fm"
        />
      );

      const searchInput = screen.getByLabelText(/Search lines or products/i);
      fireEvent.change(searchInput, { target: { value: "NonexistentItem12345" } });

      expect(screen.getByText(/No production lines match "NonexistentItem12345"/i)).toBeDefined();

      const clearSearchBtn = screen.getByRole("button", { name: "Clear Search" });
      fireEvent.click(clearSearchBtn);

      expect(screen.getByText("Sewing Line Alpha")).toBeDefined();
    });
  });
});
