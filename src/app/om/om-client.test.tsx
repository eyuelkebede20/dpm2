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
    fireEvent.click(submitBtn);

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
});
