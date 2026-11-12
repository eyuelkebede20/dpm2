import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { OMClient } from "./om-client";
import * as omActions from "@/actions/om-actions";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/actions/om-actions", () => ({
  createFactoryAction: vi.fn().mockResolvedValue({ success: true }),
  provisionFactoryUserAction: vi.fn().mockResolvedValue({ success: true }),
  toggleFactoryUserStatusAction: vi.fn().mockResolvedValue({ success: true }),
  updateFactoryUserRoleAction: vi.fn().mockResolvedValue({ success: true }),
  toggleQAProductAssignmentAction: vi.fn().mockResolvedValue({ success: true }),
  bulkAssignQAProductsAction: vi.fn().mockResolvedValue({ success: true }),
  getOMFactoryCalendarDataAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      workingDays: [1, 2, 3, 4, 5, 6],
      entries: [],
      plans: [],
      specialDays: [],
    },
  }),
}));

describe("Button Interaction Tests - OMClient", () => {
  const sampleFactories = [
    {
      id: "fac_1",
      name: "Hawassa Plant",
      omId: "usr_om_1",
      active: true,
      createdAt: new Date(),
    },
  ];

  const sampleUsers = [
    {
      id: "usr_fm_1",
      name: "Tadesse FM",
      email: "tadesse@dpm.local",
      role: "fm",
      active: true,
      mustChangePassword: true,
      createdAt: new Date(),
      factoryId: "fac_1",
      factoryName: "Hawassa Plant",
    },
  ];

  const sampleMatrix = {
    qaUsers: [
      {
        id: "usr_qa_1",
        name: "Bethlehem QA",
        email: "bethlehem@dpm.local",
        active: true,
        factoryId: "fac_1",
        factoryName: "Hawassa Plant",
      },
    ],
    productsList: [
      {
        id: "prod_1",
        name: "Standard Bottle",
        sku: "BOT-STD",
        factoryId: "fac_1",
        factoryName: "Hawassa Plant",
      },
    ],
    assignments: [
      {
        qaUserId: "usr_qa_1",
        productId: "prod_1",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderOM = () => {
    return render(
      <OMClient
        factories={sampleFactories}
        factoryUsers={sampleUsers}
        matrixData={sampleMatrix}
      />
    );
  };

  it("switches tabs between Factories, Factory Teams, and QA Matrix via tab buttons", () => {
    renderOM();

    // Initial tab shows Operating Plants
    expect(screen.getByText("Operating Plants")).toBeDefined();

    // Click Factory Teams tab
    const teamsTab = screen.getByRole("button", { name: /factory teams/i });
    fireEvent.click(teamsTab);
    expect(screen.getByText("Factory Personnel & Role Assignment")).toBeDefined();

    // Click QA Assignment Matrix tab
    const matrixTab = screen.getByRole("button", { name: /qa assignment matrix/i });
    fireEvent.click(matrixTab);
    expect(screen.getByRole("heading", { name: /qa product assignment matrix/i })).toBeDefined();

    // Switch back to Factories
    const facTab = screen.getByRole("button", { name: /operating plants/i });
    fireEvent.click(facTab);
    expect(screen.getByText("Operating Plants")).toBeDefined();
  });

  it("opens and closes 'New Factory' modal via buttons", () => {
    renderOM();

    const newFacBtn = screen.getByRole("button", { name: /new factory/i });
    fireEvent.click(newFacBtn);

    expect(screen.getByRole("heading", { name: /create new factory plant/i })).toBeDefined();

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: /create new factory plant/i })).toBeNull();
  });

  it("submits factory creation modal when 'Create Factory' button is clicked", async () => {
    renderOM();

    const newFacBtn = screen.getByRole("button", { name: /new factory/i });
    fireEvent.click(newFacBtn);

    const nameInput = screen.getByPlaceholderText(/e\.g\. Hawassa Agro-Processing Plant/i);
    fireEvent.change(nameInput, { target: { value: "Dire Dawa Plant" } });

    const submitBtn = screen.getByRole("button", { name: /create factory/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(omActions.createFactoryAction).toHaveBeenCalledWith({
        name: "Dire Dawa Plant",
      });
    });
  });

  it("opens, fills and submits 'Provision Team Member' modal via buttons", async () => {
    renderOM();

    // Switch to teams tab
    const teamsTab = screen.getByRole("button", { name: /factory teams/i });
    fireEvent.click(teamsTab);

    // Click open
    const openBtn = screen.getByRole("button", { name: /provision team member/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole("heading", { name: /provision team member & set qa/i })).toBeDefined();

    // Fill inputs
    const nameInput = screen.getByPlaceholderText(/e\.g\. Abebe Kebede/i);
    const emailInput = screen.getByPlaceholderText(/name@company\.com/i);

    fireEvent.change(nameInput, { target: { value: "New FM User" } });
    fireEvent.change(emailInput, { target: { value: "newfm@dpm.local" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /provision member/i });
    fireEvent.submit(submitBtn.closest("form")!);

    await waitFor(() => {
      expect(omActions.provisionFactoryUserAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New FM User",
          email: "newfm@dpm.local",
          factoryId: "fac_1",
        })
      );
    });
  });

  it("triggers user status toggle when Deactivate/Activate button is clicked", async () => {
    renderOM();

    // Switch to teams tab
    const teamsTab = screen.getByRole("button", { name: /factory teams/i });
    fireEvent.click(teamsTab);

    const deactBtn = screen.getByRole("button", { name: /deactivate/i });
    fireEvent.click(deactBtn);

    await waitFor(() => {
      expect(omActions.toggleFactoryUserStatusAction).toHaveBeenCalledWith("usr_fm_1", false);
    });
  });

  it("toggles QA matrix assignment checkbox calling toggleQAProductAssignmentAction", async () => {
    renderOM();

    // Switch to matrix tab
    const matrixTab = screen.getByRole("button", { name: /qa assignment matrix/i });
    fireEvent.click(matrixTab);

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(omActions.toggleQAProductAssignmentAction).toHaveBeenCalledWith({
        qaUserId: "usr_qa_1",
        productId: "prod_1",
        assigned: false,
      });
    });
  });

  it("clicks on Operating Plant card to drill into Plant Operations Hub and navigates sub-tabs", async () => {
    renderOM();

    // Click on Hawassa Plant card button
    const plantCard = screen.getByRole("button", { name: /hawassa plant/i });
    fireEvent.click(plantCard);

    // Verify Plant Hub header is visible
    await waitFor(() => {
      expect(screen.getByText("Plant Operations Hub")).toBeDefined();
    });
    expect(screen.getByText(/Plant Hub ID: fac_1/i)).toBeDefined();

    // Verify sub-tabs exist
    expect(screen.getByRole("button", { name: /calendar & production/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /plant team/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /qa matrix/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /lines & products/i })).toBeDefined();

    // Switch to Plant Team sub-tab
    const plantTeamTab = screen.getByRole("button", { name: /plant team/i });
    fireEvent.click(plantTeamTab);
    expect(screen.getByText("Tadesse FM")).toBeDefined();

    // Switch to QA Matrix sub-tab
    const qaMatrixTab = screen.getByRole("button", { name: /qa matrix/i });
    fireEvent.click(qaMatrixTab);
    expect(screen.getByText(/Bethlehem QA/i)).toBeDefined();

    // Switch to Lines & Products sub-tab
    const linesTab = screen.getByRole("button", { name: /lines & products/i });
    fireEvent.click(linesTab);
    expect(screen.getByText("Standard Bottle")).toBeDefined();

    // Click Back to Plants button
    const backBtn = screen.getByRole("button", { name: /back to plants/i });
    fireEvent.click(backBtn);
    await waitFor(() => {
      expect(screen.getByText("Operating Plants")).toBeDefined();
    });
  });

  it("provisions a new QA inspector with assigned QA products from inside the Plant Hub", async () => {
    renderOM();

    // Drill into factory
    const plantCard = screen.getByRole("button", { name: /hawassa plant/i });
    fireEvent.click(plantCard);

    await waitFor(() => {
      expect(screen.getByText("Plant Operations Hub")).toBeDefined();
    });

    // Click "+ Add Personnel to Plant"
    const addBtn = screen.getByRole("button", { name: /\+ add personnel to plant/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole("heading", { name: /provision team member & set qa/i })).toBeDefined();

    // Fill form
    const nameInput = screen.getByPlaceholderText(/e\.g\. Abebe Kebede/i);
    const emailInput = screen.getByPlaceholderText(/name@company\.com/i);
    fireEvent.change(nameInput, { target: { value: "Almaz QA" } });
    fireEvent.change(emailInput, { target: { value: "almaz@dpm.local" } });

    // Change role to QA Inspector
    const roleSelect = screen.getByLabelText(/^role$/i);
    fireEvent.change(roleSelect, { target: { value: "qa" } });

    // Expect QA product assignment section to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Set QA Product Inspections/i)).toBeDefined();
    });
    expect(screen.getByText("Standard Bottle")).toBeDefined();

    // Check the product checkbox
    const prodCheckbox = screen.getByLabelText(/Standard Bottle/i);
    fireEvent.click(prodCheckbox);

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /provision member/i });
    fireEvent.submit(submitBtn.closest("form")!);

    await waitFor(() => {
      expect(omActions.provisionFactoryUserAction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Almaz QA",
          email: "almaz@dpm.local",
          role: "qa",
          factoryId: "fac_1",
          assignedProductIds: ["prod_1"],
        })
      );
    });
  });

  it("filters users via search input and role filter in Factory Teams (Users) tab", () => {
    const multiUsers = [
      {
        id: "usr_fm_1",
        name: "Tadesse FM",
        email: "tadesse@dpm.local",
        role: "fm",
        active: true,
        mustChangePassword: true,
        createdAt: new Date(),
        factoryId: "fac_1",
        factoryName: "Hawassa Plant",
      },
      {
        id: "usr_qa_1",
        name: "Bethlehem QA",
        email: "bethlehem@dpm.local",
        role: "qa",
        active: true,
        mustChangePassword: false,
        createdAt: new Date(),
        factoryId: "fac_1",
        factoryName: "Hawassa Plant",
      },
    ];

    render(
      <OMClient
        factories={sampleFactories}
        factoryUsers={multiUsers}
        matrixData={sampleMatrix}
      />
    );

    // Switch to Factory Teams (Users) tab
    const teamsTab = screen.getByRole("button", { name: /factory teams/i });
    fireEvent.click(teamsTab);

    // Search input should be rendered
    const searchInput = screen.getByPlaceholderText(/Search personnel by name, email, role, or plant/i) as HTMLInputElement;
    expect(searchInput).toBeDefined();

    // Type "Bethlehem" in search input
    fireEvent.change(searchInput, { target: { value: "Bethlehem" } });

    // Bethlehem QA should be visible, Tadesse FM should be filtered out
    expect(screen.getByText("Bethlehem QA")).toBeDefined();
    expect(screen.queryByText("Tadesse FM")).toBeNull();

    // Clear search using clear button
    const clearBtn = screen.getByTitle("Clear search");
    fireEvent.click(clearBtn);

    expect(screen.getByText("Tadesse FM")).toBeDefined();
    expect(screen.getByText("Bethlehem QA")).toBeDefined();

    // Filter by Role
    const roleSelect = screen.getByLabelText("Filter by Role") as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: "fm" } });

    expect(screen.getByText("Tadesse FM")).toBeDefined();
    expect(screen.queryByText("Bethlehem QA")).toBeNull();
  });

  it("renders separate QA product assignment matrix tables for each plant with plant-specific products", async () => {
    const multiFactories = [
      { id: "fac_1", name: "Hawassa Plant", omId: "usr_om_1", active: true, createdAt: new Date() },
      { id: "fac_2", name: "Addis Ababa Plant", omId: "usr_om_1", active: true, createdAt: new Date() },
    ];

    const multiMatrix = {
      qaUsers: [
        {
          id: "usr_qa_1",
          name: "Bethlehem QA",
          email: "bethlehem@dpm.local",
          active: true,
          factoryId: "fac_1",
          factoryName: "Hawassa Plant",
        },
        {
          id: "usr_qa_2",
          name: "Yonas QA",
          email: "yonas@dpm.local",
          active: true,
          factoryId: "fac_2",
          factoryName: "Addis Ababa Plant",
        },
      ],
      productsList: [
        {
          id: "prod_1",
          name: "Standard Bottle",
          sku: "BOT-STD",
          factoryId: "fac_1",
          factoryName: "Hawassa Plant",
        },
        {
          id: "prod_2",
          name: "Polo Shirt",
          sku: "POLO-01",
          factoryId: "fac_2",
          factoryName: "Addis Ababa Plant",
        },
      ],
      assignments: [
        { qaUserId: "usr_qa_1", productId: "prod_1" },
      ],
    };

    render(
      <OMClient
        factories={multiFactories}
        factoryUsers={[]}
        matrixData={multiMatrix}
      />
    );

    // Switch to QA Assignment Matrix tab
    const matrixTab = screen.getByRole("button", { name: /qa assignment matrix/i });
    fireEvent.click(matrixTab);

    // Both plant section cards should be visible
    expect(screen.getByRole("heading", { name: "Hawassa Plant" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Addis Ababa Plant" })).toBeDefined();

    // Hawassa Plant matrix table should show Standard Bottle and Bethlehem QA
    expect(screen.getByText("Standard Bottle")).toBeDefined();
    expect(screen.getByText("Bethlehem QA")).toBeDefined();

    // Addis Ababa Plant matrix table should show Polo Shirt and Yonas QA
    expect(screen.getByText("Polo Shirt")).toBeDefined();
    expect(screen.getByText("Yonas QA")).toBeDefined();

    // Test Bulk Clear All for Bethlehem QA in Hawassa Plant (since prod_1 is already assigned)
    const clearAllBtns = screen.getAllByRole("button", { name: /clear all/i });
    expect(clearAllBtns.length).toBeGreaterThan(0);
    fireEvent.click(clearAllBtns[0]);

    await waitFor(() => {
      expect(omActions.bulkAssignQAProductsAction).toHaveBeenCalledWith({
        qaUserId: "usr_qa_1",
        productIds: ["prod_1"],
        assignAll: false,
      });
    });

    // Test Bulk Assign All for Yonas QA in Addis Ababa Plant (since prod_2 is unassigned)
    const assignAllBtns = screen.getAllByRole("button", { name: /assign all/i });
    expect(assignAllBtns.length).toBeGreaterThan(0);
    fireEvent.click(assignAllBtns[1]);

    await waitFor(() => {
      expect(omActions.bulkAssignQAProductsAction).toHaveBeenCalledWith({
        qaUserId: "usr_qa_2",
        productIds: ["prod_2"],
        assignAll: true,
      });
    });

    // Test Plant Switcher Pill: Click "Addis Ababa Plant" filter pill
    const addisFilterPill = screen.getByRole("button", { name: /^addis ababa plant/i });
    fireEvent.click(addisFilterPill);

    // Now only Addis Ababa Plant matrix table should be visible
    expect(screen.getByRole("heading", { name: "Addis Ababa Plant" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Hawassa Plant" })).toBeNull();
    expect(screen.getByText("Polo Shirt")).toBeDefined();
    expect(screen.getByText("Yonas QA")).toBeDefined();
  });
});
