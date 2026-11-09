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
  createQAInspectionAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Button Interaction Tests - QAClient", () => {
  const sampleProducts = [
    {
      id: "prod_1",
      name: "Water 1L Bottle",
      sku: "WAT-1L",
      factoryId: "fac_1",
    },
  ];

  const sampleLines = [
    {
      id: "line_1",
      name: "Line A - Packaging",
      factoryId: "fac_1",
    },
  ];

  const sampleInspections = [
    {
      id: "insp_1",
      date: "2026-03-24",
      checked: 200,
      defects: 4,
      note: "Minor label wrinkle / የክዳን መላላት",
      createdAt: new Date(),
      productName: "Water 1L Bottle",
      productSku: "WAT-1L",
      lineName: "Line A - Packaging",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderQA = (products = sampleProducts, lines = sampleLines, inspections = sampleInspections) => {
    return render(
      <QAClient
        assignedProducts={products}
        availableLines={lines}
        inspections={inspections}
      />
    );
  };

  it("updates defect quantity using quick-click pill buttons (0 defects, +1, +5)", () => {
    renderQA();

    const defectInput = screen.getAllByRole("spinbutton")[1] as HTMLInputElement;
    expect(defectInput.value).toBe("0");

    // Click "+1" button
    const plus1Btn = screen.getByRole("button", { name: "+1" });
    fireEvent.click(plus1Btn);
    expect(defectInput.value).toBe("1");

    // Click "+5" button
    const plus5Btn = screen.getByRole("button", { name: "+5" });
    fireEvent.click(plus5Btn);
    expect(defectInput.value).toBe("6");

    // Click "0 defects" button
    const zeroBtn = screen.getByRole("button", { name: /0 defects/i });
    fireEvent.click(zeroBtn);
    expect(defectInput.value).toBe("0");
  }, 15000);

  it("recalculates live defect rate when defect pill buttons are clicked", () => {
    renderQA();

    // Checked Qty is 100 by default, 0 defects -> 0%
    expect(screen.getByText("0%")).toBeDefined();

    // Click "+1" defect -> 1 / 100 = 1%
    const plus1Btn = screen.getByRole("button", { name: "+1" });
    fireEvent.click(plus1Btn);
    expect(screen.getByText("1%")).toBeDefined();

    // Click "+5" defect -> 6 / 100 = 6%
    const plus5Btn = screen.getByRole("button", { name: "+5" });
    fireEvent.click(plus5Btn);
    expect(screen.getByText("6%")).toBeDefined();
  });

  it("submits inspection report when 'Submit Inspection Report' button is clicked", async () => {
    renderQA();

    // Increase defects using quick button
    const plus1Btn = screen.getByRole("button", { name: "+1" });
    fireEvent.click(plus1Btn);

    // Enter note
    const noteArea = screen.getByPlaceholderText(/e\.g\. Cap misalignment on bottle neck #4/i);
    fireEvent.change(noteArea, { target: { value: "Cap loose on sample 3" } });

    // Click Submit
    const submitBtn = screen.getByRole("button", { name: /submit inspection report/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(qaActions.createQAInspectionAction).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: "prod_1",
          lineId: "line_1",
          checked: 100,
          defects: 1,
          note: "Cap loose on sample 3",
        })
      );
    });

    // Check success message appears
    expect(await screen.findByText(/inspection logged successfully!/i)).toBeDefined();
  });

  it("disables 'Submit Inspection Report' button when no products are assigned", () => {
    renderQA([]);

    const submitBtn = screen.getByRole("button", { name: /submit inspection report/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it("renders summary statistics cards for Total Checked, Defect Rate, and Passed Units", () => {
    renderQA();

    // Summary cards exist
    expect(screen.getByText("Total Checked")).toBeDefined();
    expect(screen.getByText("Defect Rate")).toBeDefined();
    expect(screen.getByText("Passed Units")).toBeDefined();

    // In sampleInspections: checked = 200, defects = 4 => passed = 196, rate = 2.0%
    expect(screen.getAllByText("200").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2.0%")).toBeDefined();
    expect(screen.getByText("196")).toBeDefined();
    expect(screen.getByText(/98% pass rate/i)).toBeDefined();
  });

  it("toggles pass/fail verdict between 'Pass (Spec OK)' and 'Defects Found'", () => {
    renderQA();

    const defectInput = screen.getAllByRole("spinbutton")[1] as HTMLInputElement;
    expect(defectInput.value).toBe("0");

    const failToggleBtn = screen.getByRole("button", { name: /defects found/i });
    const passToggleBtn = screen.getByRole("button", { name: /pass \(spec ok\)/i });

    // Tap Defects Found -> should set defects to at least 1
    fireEvent.click(failToggleBtn);
    expect(defectInput.value).toBe("1");

    // Tap Pass (Spec OK) -> should reset defects to 0
    fireEvent.click(passToggleBtn);
    expect(defectInput.value).toBe("0");
  });

  it("displays past inspection notes with Amharic / Ethiopic defect descriptions", () => {
    renderQA();

    // Confirms Amharic defect note renders properly
    expect(screen.getByText(/Minor label wrinkle \/ የክዳን መላላት/i)).toBeDefined();
  });
});
