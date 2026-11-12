import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QAClient } from "./qa-client";
import * as qaActions from "@/actions/qa-actions";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/actions/qa-actions", () => ({
  reviewQAEntryAction: vi.fn().mockResolvedValue({ success: true }),
  getQAEntriesAction: vi.fn().mockResolvedValue({ success: true, entries: [], userRole: "qa" }),
  createQAInspectionAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Button & Approval Interaction Tests - QAClient", () => {
  const sampleEntries: qaActions.QAEntryItem[] = [
    {
      id: "entry_1",
      date: "2026-11-08",
      lineId: "line_1",
      lineName: "Sewing Line 1",
      productId: "prod_1",
      productName: "Water 1L Bottle",
      productSku: "WAT-1L",
      factoryId: "fac_1",
      factoryName: "Hawassa Plant",
      finishedGood: 1200,
      rework: 15,
      reject: 5,
      scrap: 2,
      wip: 40,
      downtimeMinutes: 10,
      issueNote: "Needle tension adjusted / መርፌ ማስተካከል",
      downtimeReasonCode: "MAC-01",
      downtimeReasonName: "Mechanical",
      downtimeReasonNameAm: "የማሽን ብልሽት",
      reporterName: "Abebe FM",
      updatedAt: new Date().toISOString(),
      status: "pending",
      qaApprovalId: null,
      qaNote: null,
      qaReviewerName: null,
      qaReviewedAt: null,
    },
    {
      id: "entry_2",
      date: "2026-11-07",
      lineId: "line_2",
      lineName: "Bottling Line 2",
      productId: "prod_1",
      productName: "Water 1L Bottle",
      productSku: "WAT-1L",
      factoryId: "fac_1",
      factoryName: "Hawassa Plant",
      finishedGood: 800,
      rework: 0,
      reject: 3,
      scrap: 0,
      wip: 10,
      downtimeMinutes: 0,
      issueNote: null,
      reporterName: "Dawit FM",
      updatedAt: new Date().toISOString(),
      status: "approved",
      qaApprovalId: "qapp_1",
      qaNote: "Tolerances verified",
      qaReviewerName: "Hanna QA",
      qaReviewedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderQA = (initial = sampleEntries) => {
    return render(<QAClient initialEntries={initial} userRole="qa" />);
  };

  it("renders pending review entries with FM reported numbers", () => {
    renderQA();

    // Summary counts
    expect(screen.getAllByText("Pending Review").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Water 1L Bottle")).toBeDefined();
    expect(screen.getByText(/Sewing Line 1/i)).toBeDefined();
    expect(screen.getByText(/1,200/i)).toBeDefined();
    expect(screen.getByText(/Abebe FM/i)).toBeDefined();

    // Verify Action buttons exist
    expect(screen.getByRole("button", { name: /Approve \(አጽድቅ\)/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Reject \(ውድቅ አድርግ\)/i })).toBeDefined();
  });

  it("approves pending entry calling reviewQAEntryAction with status = 'approved'", async () => {
    renderQA();

    const approveBtn = screen.getByRole("button", { name: /Approve \(አጽድቅ\)/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(qaActions.reviewQAEntryAction).toHaveBeenCalledWith({
        reportEntryId: "entry_1",
        status: "approved",
        note: undefined,
      });
    });
  });

  it("opens rejection modal and submits rejection with note calling reviewQAEntryAction with status = 'rejected'", async () => {
    renderQA();

    // Click Reject button
    const rejectBtn = screen.getByRole("button", { name: /Reject \(ውድቅ አድርግ\)/i });
    fireEvent.click(rejectBtn);

    // Modal opens
    expect(screen.getByText(/Reject Production Batch/i)).toBeDefined();

    // Fill rejection reason
    const reasonInput = screen.getByPlaceholderText(/Reject rate exceeds 5% threshold/i);
    fireEvent.change(reasonInput, {
      target: { value: "Seal integrity failure on batch 12" },
    });

    // Confirm Rejection
    const confirmBtn = screen.getByRole("button", { name: /Confirm Rejection/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(qaActions.reviewQAEntryAction).toHaveBeenCalledWith({
        reportEntryId: "entry_1",
        status: "rejected",
        note: "Seal integrity failure on batch 12",
      });
    });
  });

  it("switches tabs to Previous Approvals & Decisions and displays past approvals", () => {
    renderQA();

    // Switch to history tab
    const historyTab = screen.getByRole("button", {
      name: /Previous Approvals & Decisions/i,
    });
    fireEvent.click(historyTab);

    // Approved item from history is displayed
    expect(screen.getByText("Approved (የጸደቀ)")).toBeDefined();
    expect(screen.getByText(/Bottling Line 2/i)).toBeDefined();
    expect(screen.getByText("Hanna QA")).toBeDefined();
    expect(screen.getByText(/Tolerances verified/i)).toBeDefined();
  });

  it("filters previous approvals by filter pills (Approved Only / Rejected Only)", () => {
    renderQA();

    // Switch to history tab
    const historyTab = screen.getByRole("button", {
      name: /Previous Approvals & Decisions/i,
    });
    fireEvent.click(historyTab);

    // Filter to Rejected Only (there are 0 rejected initially)
    const rejectedOnlyBtn = screen.getByRole("button", { name: /Rejected Only/i });
    fireEvent.click(rejectedOnlyBtn);

    expect(screen.getByText(/No decisions found for this filter/i)).toBeDefined();

    // Filter back to Approved Only (1 item)
    const approvedOnlyBtn = screen.getByRole("button", { name: /Approved Only/i });
    fireEvent.click(approvedOnlyBtn);

    expect(screen.getByText("Approved (የጸደቀ)")).toBeDefined();
  });

  it("allows reversing decision on an approved entry via 'Change to Rejected'", async () => {
    renderQA();

    // Switch to history tab
    const historyTab = screen.getByRole("button", {
      name: /Previous Approvals & Decisions/i,
    });
    fireEvent.click(historyTab);

    const changeBtn = screen.getByRole("button", { name: /Change to Rejected/i });
    fireEvent.click(changeBtn);

    // Opens modal for reversal
    expect(screen.getByText(/Reject Production Batch/i)).toBeDefined();
  });
});
