import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FMClient } from "./fm-client";
import * as fmActions from "@/actions/fm-actions";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/actions/fm-actions", () => ({
  createLineAction: vi.fn().mockResolvedValue({ success: true }),
  toggleLineActiveAction: vi.fn().mockResolvedValue({ success: true }),
  createProductAction: vi.fn().mockResolvedValue({ success: true }),
  toggleProductActiveAction: vi.fn().mockResolvedValue({ success: true }),
  toggleLineProductAction: vi.fn().mockResolvedValue({ success: true }),
  createPlanAction: vi.fn().mockResolvedValue({ success: true }),
  updatePlanAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Button Interaction Tests - FMClient", () => {
  const sampleLines = [
    {
      id: "line_1",
      name: "Line 1 - PET Bottling",
      active: true,
      createdAt: new Date(),
    },
  ];

  const sampleProducts = [
    {
      id: "prod_1",
      name: "Mineral Water 500ml",
      sku: "WAT-500",
      active: true,
      createdAt: new Date(),
    },
  ];

  const sampleLinks = [
    {
      lineId: "line_1",
      productId: "prod_1",
    },
  ];

  const samplePlans = [
    {
      id: "plan_1",
      lineId: "line_1",
      lineName: "Line 1 - PET Bottling",
      productId: "prod_1",
      productName: "Mineral Water 500ml",
      productSku: "WAT-500",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      plannedQty: 50000,
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderFM = () => {
    return render(
      <FMClient
        factoryName="Hawassa Mega Plant"
        lines={sampleLines}
        products={sampleProducts}
        lineProducts={sampleLinks}
        plans={samplePlans}
      />
    );
  };

  it("switches tabs between Plans, Lines, Products, and Links via tab buttons", () => {
    renderFM();

    // Default tab is Plans
    expect(screen.getByText("Monthly & Periodic Production Plans")).toBeDefined();

    // Switch to Lines tab
    const linesTab = screen.getByRole("button", { name: /lines \(1\)/i });
    fireEvent.click(linesTab);
    expect(screen.getByText("Production Lines")).toBeDefined();

    // Switch to Products tab
    const prodsTab = screen.getByRole("button", { name: /products \(1\)/i });
    fireEvent.click(prodsTab);
    expect(screen.getByText("Product Catalog")).toBeDefined();

    // Switch to Links tab
    const linksTab = screen.getByRole("button", { name: /line ↔ product links/i });
    fireEvent.click(linksTab);
    expect(screen.getByText("Link Products to Lines")).toBeDefined();

    // Switch back to Plans tab
    const plansTab = screen.getByRole("button", { name: /production plans \(1\)/i });
    fireEvent.click(plansTab);
    expect(screen.getByText("Monthly & Periodic Production Plans")).toBeDefined();
  });

  it("opens, cancels, and submits 'New Production Plan' modal via buttons", async () => {
    renderFM();

    const newPlanBtn = screen.getByRole("button", { name: /new production plan/i });
    fireEvent.click(newPlanBtn);

    expect(screen.getByRole("heading", { name: /create production plan/i })).toBeDefined();

    // Cancel modal
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("heading", { name: /create production plan/i })).toBeNull();

    // Reopen and submit
    fireEvent.click(newPlanBtn);
    const saveBtn = screen.getByRole("button", { name: /save plan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fmActions.createPlanAction).toHaveBeenCalledWith(
        expect.objectContaining({
          lineId: "line_1",
          productId: "prod_1",
          plannedQty: 25000,
        })
      );
    });
  });

  it("opens, cancels, and submits 'Add Line' modal via buttons", async () => {
    renderFM();

    // Go to Lines tab
    const linesTab = screen.getByRole("button", { name: /lines \(1\)/i });
    fireEvent.click(linesTab);

    // Open modal
    const addLineBtn = screen.getByRole("button", { name: /add line/i });
    fireEvent.click(addLineBtn);

    expect(screen.getByRole("heading", { name: /add production line/i })).toBeDefined();

    // Cancel
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("heading", { name: /add production line/i })).toBeNull();

    // Reopen and fill
    fireEvent.click(addLineBtn);
    const input = screen.getByPlaceholderText(/e\.g\. Line 3 - Aseptic Bottling/i);
    fireEvent.change(input, { target: { value: "Line 2 - Canning" } });

    // Submit (modal submit button has text "Add Line")
    const submitBtns = screen.getAllByRole("button", { name: /add line/i });
    const modalSubmitBtn = submitBtns[submitBtns.length - 1];
    fireEvent.click(modalSubmitBtn);

    await waitFor(() => {
      expect(fmActions.createLineAction).toHaveBeenCalledWith({
        name: "Line 2 - Canning",
      });
    });
  });

  it("triggers line active status toggle when Deactivate/Activate button is clicked", async () => {
    renderFM();

    const linesTab = screen.getByRole("button", { name: /lines \(1\)/i });
    fireEvent.click(linesTab);

    const deactBtn = screen.getByRole("button", { name: /deactivate/i });
    fireEvent.click(deactBtn);

    await waitFor(() => {
      expect(fmActions.toggleLineActiveAction).toHaveBeenCalledWith("line_1", false);
    });
  });

  it("opens, fills and submits 'Add Product' modal via buttons", async () => {
    renderFM();

    const prodsTab = screen.getByRole("button", { name: /products \(1\)/i });
    fireEvent.click(prodsTab);

    const addProdBtn = screen.getByRole("button", { name: /add product/i });
    fireEvent.click(addProdBtn);

    expect(screen.getByRole("heading", { name: /add product/i })).toBeDefined();

    const nameInput = screen.getByPlaceholderText(/e\.g\. Sparkling Water 1L/i);
    const skuInput = screen.getByPlaceholderText(/e\.g\. WAT-1000/i);

    fireEvent.change(nameInput, { target: { value: "Juice 250ml" } });
    fireEvent.change(skuInput, { target: { value: "JUC-250" } });

    const submitBtns = screen.getAllByRole("button", { name: /add product/i });
    const modalSubmitBtn = submitBtns[submitBtns.length - 1];
    fireEvent.click(modalSubmitBtn);

    await waitFor(() => {
      expect(fmActions.createProductAction).toHaveBeenCalledWith({
        name: "Juice 250ml",
        sku: "JUC-250",
      });
    });
  });

  it("triggers product active status toggle when Deactivate/Activate button is clicked", async () => {
    renderFM();

    const prodsTab = screen.getByRole("button", { name: /products \(1\)/i });
    fireEvent.click(prodsTab);

    const deactBtn = screen.getByRole("button", { name: /deactivate/i });
    fireEvent.click(deactBtn);

    await waitFor(() => {
      expect(fmActions.toggleProductActiveAction).toHaveBeenCalledWith("prod_1", false);
    });
  });

  it("toggles Line-Product link checkbox calling toggleLineProductAction", async () => {
    renderFM();

    const linksTab = screen.getByRole("button", { name: /line ↔ product links/i });
    fireEvent.click(linksTab);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(fmActions.toggleLineProductAction).toHaveBeenCalledWith({
        lineId: "line_1",
        productId: "prod_1",
        linked: false,
      });
    });
  });

  it("opens, edits, and submits 'Edit Production Plan' modal via Edit button", async () => {
    renderFM();

    // Find Edit button on plan
    const editBtns = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editBtns[0]);

    expect(screen.getByRole("heading", { name: /edit production plan/i })).toBeDefined();

    // Cancel modal
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("heading", { name: /edit production plan/i })).toBeNull();

    // Reopen and submit
    fireEvent.click(editBtns[0]);
    const saveChangesBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveChangesBtn);

    await waitFor(() => {
      expect(fmActions.updatePlanAction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "plan_1",
          plannedQty: 50000,
        })
      );
    });
  });

  it("renders Initial Set Plan and Edited Plan side by side in the Plans table", () => {
    const plansWithDiffQty = [
      {
        ...samplePlans[0],
        initialPlannedQty: 45000,
        plannedQty: 50000,
      },
    ];

    render(
      <FMClient
        factoryName="Hawassa Mega Plant"
        lines={sampleLines}
        products={sampleProducts}
        lineProducts={sampleLinks}
        plans={plansWithDiffQty}
      />
    );

    expect(screen.getAllByText("Initial Set Plan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Edited Plan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("45,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50,000").length).toBeGreaterThan(0);
  });

  it("renders read-only view for Factory Manager (fm) without New Plan or Edit buttons", () => {
    render(
      <FMClient
        factoryName="Hawassa Mega Plant"
        lines={sampleLines}
        products={sampleProducts}
        lineProducts={sampleLinks}
        plans={samplePlans}
        userRole="fm"
      />
    );

    expect(screen.queryByRole("button", { name: /new production plan/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.getByText("Read-Only View")).toBeDefined();
    expect(
      screen.getByText(/Production Plans Managed by Operation Management/i)
    ).toBeDefined();
  });
});
