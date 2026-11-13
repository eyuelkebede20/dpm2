import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { PlanningClient } from "./planning-client";
import * as planActions from "@/actions/plan-actions";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/actions/plan-actions", () => ({
  createPlanAction: vi.fn().mockResolvedValue({ success: true }),
  updatePlanAction: vi.fn().mockResolvedValue({ success: true }),
  deletePlanAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("PlanningClient Unit & Interaction Tests", () => {
  const sampleFactories = [
    { id: "fac_1", name: "Addis Ababa Plant" },
    { id: "fac_2", name: "Hawassa Mega Plant" },
  ];

  const sampleLines = [
    { id: "line_1", name: "Sewing Line 1", factoryId: "fac_1" },
    { id: "line_2", name: "Finishing Line 2", factoryId: "fac_1" },
    { id: "line_3", name: "Hawassa Bottling 1", factoryId: "fac_2" },
  ];

  const sampleProducts = [
    { id: "prod_1", name: "Polo T-Shirt", sku: "POLO-01", factoryId: "fac_1" },
    { id: "prod_2", name: "Denim Jeans", sku: "JEAN-02", factoryId: "fac_1" },
    { id: "prod_3", name: "Water Bottle 500ml", sku: "BOT-500", factoryId: "fac_2" },
  ];

  const sampleLineProducts = [
    { lineId: "line_1", productId: "prod_1" },
    { lineId: "line_2", productId: "prod_2" },
    { lineId: "line_3", productId: "prod_3" },
  ];

  const samplePlans: planActions.PlanItemWithPlant[] = [
    {
      id: "plan_1",
      factoryId: "fac_1",
      factoryName: "Addis Ababa Plant",
      lineId: "line_1",
      lineName: "Sewing Line 1",
      productId: "prod_1",
      productName: "Polo T-Shirt",
      productSku: "POLO-01",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 25000,
      initialPlannedQty: 20000,
      weeklyPlanned: 25000,
      totalProduced: 12500,
      leftFromWeeklyPlanned: 12500,
      createdAt: new Date(),
    },
    {
      id: "plan_2",
      factoryId: "fac_2",
      factoryName: "Hawassa Mega Plant",
      lineId: "line_3",
      lineName: "Hawassa Bottling 1",
      productId: "prod_3",
      productName: "Water Bottle 500ml",
      productSku: "BOT-500",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 50000,
      initialPlannedQty: 50000,
      weeklyPlanned: 50000,
      totalProduced: 30000,
      leftFromWeeklyPlanned: 20000,
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderPlanning = (props: Partial<React.ComponentProps<typeof PlanningClient>> = {}) => {
    return render(
      <PlanningClient
        factories={sampleFactories}
        lines={sampleLines}
        products={sampleProducts}
        lineProducts={sampleLineProducts}
        plans={samplePlans}
        calendarSystem="ethiopian"
        userRole="om"
        canManagePlans={true}
        {...props}
      />
    );
  };

  it("renders PlanningClient with KPI summary and plan items", () => {
    renderPlanning();

    expect(screen.getByRole("heading", { name: /production planning/i })).toBeDefined();
    expect(screen.getAllByText("Addis Ababa Plant").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hawassa Mega Plant").length).toBeGreaterThan(0);
    expect(screen.getByText("Polo T-Shirt")).toBeDefined();
    expect(screen.getByText("Water Bottle 500ml")).toBeDefined();
    expect(screen.getAllByText("25,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50,000").length).toBeGreaterThan(0);
  });

  it("renders 'New Production Plan' button and 'Edit' buttons when user is OM (canManagePlans = true)", () => {
    renderPlanning({ canManagePlans: true, userRole: "om" });

    const newBtn = screen.getByRole("button", { name: /new production plan/i });
    expect(newBtn).toBeDefined();

    const editBtns = screen.getAllByRole("button", { name: /edit/i });
    expect(editBtns.length).toBe(2);
    expect(screen.queryByText(/Factory Manager Read-Only View/i)).toBeNull();
  });

  it("does NOT render 'New Production Plan' or 'Edit' buttons when user is FM (canManagePlans = false), and displays Read-Only notice", () => {
    renderPlanning({ canManagePlans: false, userRole: "fm" });

    expect(screen.queryByRole("button", { name: /new production plan/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.getByText(/Factory Manager Read-Only View/i)).toBeDefined();
    expect(
      screen.getByText(/Read-Only \(Managed by Operation Manager\)/i)
    ).toBeDefined();
  });

  it("formats dates in Ethiopian calendar when calendarSystem === 'ethiopian'", () => {
    renderPlanning({ calendarSystem: "ethiopian" });

    // Ethiopian indicator in header
    expect(screen.getByText(/Sys Admin Setting: 🇪🇹 Ethiopian Calendar/i)).toBeDefined();
    // 2026-11-01 corresponds to Tikimt 22, 2019 ዓ.ም
    expect(screen.getAllByText(/ጥቅምት/i).length).toBeGreaterThan(0);
  });

  it("formats dates in Gregorian calendar when calendarSystem === 'gregorian'", () => {
    renderPlanning({ calendarSystem: "gregorian" });

    // Gregorian indicator in header
    expect(screen.getByText(/Sys Admin Setting: 🌐 Gregorian Calendar/i)).toBeDefined();
    expect(screen.getAllByText(/Nov 1, 2026/i).length).toBeGreaterThan(0);
  });

  it("opens, fills, and submits 'New Production Plan' modal via buttons", async () => {
    renderPlanning({ canManagePlans: true, userRole: "om" });

    const newBtn = screen.getByRole("button", { name: /new production plan/i });
    fireEvent.click(newBtn);

    expect(screen.getByRole("heading", { name: /create production plan/i })).toBeDefined();

    // Fill line and product (prod_2: Denim Jeans, which does not have an existing plan)
    const lineSelect = screen.getByRole("combobox", { name: "Production Line" });
    fireEvent.change(lineSelect, { target: { value: "line_2" } });

    const prodSelect = screen.getByRole("combobox", { name: "Product" });
    fireEvent.change(prodSelect, { target: { value: "prod_2" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /save production plan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(planActions.createPlanAction).toHaveBeenCalledWith(
        expect.objectContaining({
          lineId: "line_2",
          productId: "prod_2",
          plannedQty: 10000,
        })
      );
    });
  });

  it("enforces rule: disables products that already have a plan and blocks creating duplicate plan for same product", async () => {
    renderPlanning({ canManagePlans: true, userRole: "om" });

    const newBtn = screen.getByRole("button", { name: /new production plan/i });
    fireEvent.click(newBtn);

    const lineSelect = screen.getByRole("combobox", { name: "Production Line" });
    const prodSelect = screen.getByRole("combobox", { name: "Product" }) as HTMLSelectElement;

    // For line_1, prod_1 (Polo T-Shirt) already has plan_1 -> must be marked and disabled
    const poloOption = Array.from(prodSelect.options).find((o) => o.value === "prod_1");
    expect(poloOption?.disabled).toBe(true);
    expect(poloOption?.textContent).toContain("Plan Already Exists");

    // Switch to line_2: prod_2 (Denim Jeans) does not have a plan -> enabled
    fireEvent.change(lineSelect, { target: { value: "line_2" } });
    const denimOption = Array.from(prodSelect.options).find((o) => o.value === "prod_2");
    expect(denimOption?.disabled).toBe(false);
    expect(denimOption?.textContent).not.toContain("Plan Already Exists");

    // Switch back to line_1: if somehow prod_1 is submitted, client validation blocks it
    fireEvent.change(lineSelect, { target: { value: "line_1" } });
    fireEvent.change(prodSelect, { target: { value: "prod_1" } });
    const submitBtn = screen.getByRole("button", { name: /save production plan/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/A production plan already exists for this product. Only one plan per product is allowed./i)).toBeDefined();
    expect(planActions.createPlanAction).not.toHaveBeenCalled();
  });

  it("opens, edits, and submits 'Edit Production Plan' modal via Edit button", async () => {
    renderPlanning({ canManagePlans: true, userRole: "om" });

    const editBtns = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editBtns[0]);

    expect(screen.getByRole("heading", { name: /edit production plan/i })).toBeDefined();

    // Modify quantity
    const qtyInput = screen.getByLabelText(/Revised Target Planned Quantity/i);
    fireEvent.change(qtyInput, { target: { value: "28000" } });

    // Submit update
    const updateBtn = screen.getByRole("button", { name: /update production plan/i });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(planActions.updatePlanAction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "plan_1",
          plannedQty: 28000,
        })
      );
    });
  });

  it("filters plans by search query", () => {
    renderPlanning();

    const searchInput = screen.getByPlaceholderText(/search by product name, sku, line, or plant/i);
    fireEvent.change(searchInput, { target: { value: "Denim" } });

    // Neither plan is Denim Jeans in samplePlans
    expect(screen.getByText(/No Production Plans Found/i)).toBeDefined();

    // Search for Polo
    fireEvent.change(searchInput, { target: { value: "Polo" } });
    expect(screen.getByText("Polo T-Shirt")).toBeDefined();
    expect(screen.queryByText("Water Bottle 500ml")).toBeNull();
  });

  it("filters plans by plant selector dropdown", () => {
    renderPlanning();

    const plantSelect = screen.getByRole("combobox", { name: /filter by plant/i });
    fireEvent.change(plantSelect, { target: { value: "fac_2" } });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Hawassa Mega Plant")).toBeDefined();
    expect(within(table).queryByText("Addis Ababa Plant")).toBeNull();
  });
});
