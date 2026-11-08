import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { OMClient } from "./om-client";
import { OMSettingsClient, SpecialDayItem, DowntimeReasonItem } from "./settings-client";
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
  seedYearlySpecialDaysAction: vi.fn().mockResolvedValue({ success: true, count: 13, year: 2026 }),
  createSpecialDayAction: vi.fn().mockResolvedValue({ success: true }),
  saveSpecialDayAction: vi.fn().mockResolvedValue({ success: true }),
  deleteSpecialDayAction: vi.fn().mockResolvedValue({ success: true }),
  createDowntimeReasonAction: vi.fn().mockResolvedValue({ success: true }),
  toggleDowntimeReasonActiveAction: vi.fn().mockResolvedValue({ success: true, isActive: false }),
  updateDowntimeReasonAction: vi.fn().mockResolvedValue({ success: true }),
  getOMSpecialDays: vi.fn().mockResolvedValue([]),
  getOMDowntimeReasons: vi.fn().mockResolvedValue([]),
}));

describe("Operation Manager Settings Component Interaction Tests - OMSettingsClient & OMClient", () => {
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
    qaUsers: [],
    productsList: [],
    assignments: [],
  };

  const sampleSpecialDays: SpecialDayItem[] = [
    {
      id: "sp_1",
      date: "2026-01-07",
      nameEn: "Ethiopian Christmas (Genna)",
      nameAm: "የገና በዓል",
      type: "holiday",
      isWorkingDay: false,
      year: 2026,
    },
    {
      id: "sp_2",
      date: "2026-03-02",
      nameEn: "Victory of Adwa",
      nameAm: "የዓድዋ ድል በዓል",
      type: "holiday",
      isWorkingDay: false,
      year: 2026,
    },
    {
      id: "sp_3",
      date: "2026-05-15",
      nameEn: "Annual Deep Maintenance",
      nameAm: "ዓመታዊ ጥልቅ ጥገና",
      type: "shutdown",
      isWorkingDay: false,
      year: 2026,
    },
    {
      id: "sp_4",
      date: "2026-06-20",
      nameEn: "Special Overtime Production",
      nameAm: "ልዩ የትርፍ ሰዓት ሥራ",
      type: "working_day",
      isWorkingDay: true,
      year: 2026,
    },
  ];

  const sampleDowntimeReasons: DowntimeReasonItem[] = [
    {
      id: "dtr_1",
      code: "DOW-01",
      nameEn: "Main Extruder Motor Failure",
      nameAm: "የዋና ኤክስትሩደር ሞተር ብልሽት",
      category: "machine",
      active: true,
    },
    {
      id: "dtr_2",
      code: "DOW-02",
      nameEn: "National Grid Power Dip",
      nameAm: "የብሔራዊ መረብ ኃይል መቋረጥ",
      category: "power",
      active: true,
    },
    {
      id: "dtr_3",
      code: "DOW-03",
      nameEn: "PET Preform Out of Stock",
      nameAm: "የፕሪፎርም ጥሬ ዕቃ እጥረት",
      category: "material",
      active: true,
    },
    {
      id: "dtr_4",
      code: "DOW-04",
      nameEn: "Mould 500ml Changeover Alignment",
      nameAm: "የሻጋታ ለውጥ ማስተካከያ",
      category: "tooling",
      active: true,
    },
    {
      id: "dtr_5",
      code: "DOW-05",
      nameEn: "Leakage QA Batch Inspection Hold",
      nameAm: "የፍሳሽ ጥራት ምርመራ ማቆሚያ",
      category: "quality",
      active: false,
    },
    {
      id: "dtr_6",
      code: "DOW-06",
      nameEn: "Factory Fire Alarm Drill",
      nameAm: "የእሳት አደጋ ልምምድ",
      category: "safety",
      active: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("navigates to 'Settings & Calendars (ቅንብሮች)' tab in OMClient and renders settings sections", () => {
    render(
      <OMClient
        factories={sampleFactories}
        factoryUsers={sampleUsers}
        matrixData={sampleMatrix}
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    // Click the 4th tab
    const settingsTab = screen.getByRole("button", {
      name: /settings & calendars|ቅንብሮች/i,
    });
    expect(settingsTab).toBeDefined();
    fireEvent.click(settingsTab);

    // Section 1 header should be visible
    expect(
      screen.getByText("Special Date Setter & Yearly Calendar Seeding")
    ).toBeDefined();

    // Section 2 header should be visible
    expect(
      screen.getByText("Non-Completion & Downtime Reason Templates")
    ).toBeDefined();
  });

  it("renders configured special days table with names, types, and working status badges", () => {
    render(
      <OMSettingsClient
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    // Verify special days listed
    expect(screen.getByText("Ethiopian Christmas (Genna)")).toBeDefined();
    expect(screen.getByText("የገና በዓል")).toBeDefined();
    expect(screen.getByText("Victory of Adwa")).toBeDefined();
    expect(screen.getByText("Annual Deep Maintenance")).toBeDefined();
    expect(screen.getByText("Special Overtime Production")).toBeDefined();

    // Verify status badges
    const factoryOffBadges = screen.getAllByText("Factory Off");
    expect(factoryOffBadges.length).toBeGreaterThanOrEqual(3);

    const workingBadges = screen.getAllByText("Working");
    expect(workingBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("clicks the prominent green button 'Seed Yearly Ethiopian Holidays' and calls seedYearlySpecialDaysAction", async () => {
    render(
      <OMSettingsClient
        initialSpecialDays={[]}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    const seedBtn = screen.getByRole("button", {
      name: /Seed Yearly Ethiopian Holidays/i,
    });
    expect(seedBtn).toBeDefined();
    expect(seedBtn.className).toContain("bg-emerald-600");

    fireEvent.click(seedBtn);

    await waitFor(() => {
      expect(omActions.seedYearlySpecialDaysAction).toHaveBeenCalledWith(2026);
    });

    // Should display success toast and populate list optimistically
    await waitFor(() => {
      expect(screen.getByText(/Successfully seeded yearly Ethiopian holidays for 2026/i)).toBeDefined();
    });
  });

  it("changes selected year and triggers seeding for the selected year", async () => {
    render(
      <OMSettingsClient
        initialSpecialDays={[]}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    const yearSelect = screen.getByLabelText("Select Year");
    fireEvent.change(yearSelect, { target: { value: "2027" } });

    const seedBtn = screen.getByRole("button", {
      name: /Seed Yearly Ethiopian Holidays/i,
    });
    fireEvent.click(seedBtn);

    await waitFor(() => {
      expect(omActions.seedYearlySpecialDaysAction).toHaveBeenCalledWith(2027);
    });
  });

  it("opens '+ Add Special Date' modal, fills fields, and submits calling createSpecialDayAction", async () => {
    render(
      <OMSettingsClient
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    const addBtn = screen.getByRole("button", { name: /\+ Add Special Date/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Add Special Date or Holiday")).toBeDefined();

    const dateInput = screen.getByLabelText("Special Date");
    const nameEnInput = screen.getByLabelText("English Name");
    const nameAmInput = screen.getByLabelText("Amharic Name");
    const typeSelect = screen.getByLabelText("Date Type");
    const isWorkingCheckbox = screen.getByLabelText("Is Working Day");

    fireEvent.change(dateInput, { target: { value: "2026-11-20" } });
    fireEvent.change(nameEnInput, { target: { value: "Plant Sanitation Day" } });
    fireEvent.change(nameAmInput, { target: { value: "የፋብሪካ ጽዳት ቀን" } });
    fireEvent.change(typeSelect, { target: { value: "shutdown" } });
    fireEvent.click(isWorkingCheckbox);

    const submitBtn = screen.getByRole("button", { name: "Add Special Date" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(omActions.createSpecialDayAction).toHaveBeenCalledWith({
        date: "2026-11-20",
        nameEn: "Plant Sanitation Day",
        nameAm: "የፋብሪካ ጽዳት ቀን",
        type: "shutdown",
        isWorkingDay: true,
      });
    });

    // New item appears in the table
    await waitFor(() => {
      expect(screen.getByText("Plant Sanitation Day")).toBeDefined();
    });
  });

  it("deletes a special day calling deleteSpecialDayAction", async () => {
    render(
      <OMSettingsClient
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    const deleteBtn = screen.getByLabelText("Delete Ethiopian Christmas (Genna)");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(omActions.deleteSpecialDayAction).toHaveBeenCalledWith("sp_1");
    });
  });

  it("renders downtime reason templates with color-coded categories and codes", () => {
    render(
      <OMSettingsClient
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    // Check codes
    expect(screen.getByText("DOW-01")).toBeDefined();
    expect(screen.getByText("DOW-02")).toBeDefined();
    expect(screen.getByText("DOW-03")).toBeDefined();
    expect(screen.getByText("DOW-04")).toBeDefined();
    expect(screen.getByText("DOW-05")).toBeDefined();
    expect(screen.getByText("DOW-06")).toBeDefined();

    // Check names
    expect(screen.getByText("Main Extruder Motor Failure")).toBeDefined();
    expect(screen.getByText("የዋና ኤክስትሩደር ሞተር ብልሽት")).toBeDefined();

    // Check category badges
    expect(screen.getByText("machine")).toBeDefined();
    expect(screen.getByText("power")).toBeDefined();
    expect(screen.getByText("material")).toBeDefined();
    expect(screen.getByText("tooling")).toBeDefined();
    expect(screen.getByText("quality")).toBeDefined();
    expect(screen.getByText("safety")).toBeDefined();
  });

  it("toggles downtime reason active status via toggle switch", async () => {
    render(
      <OMSettingsClient
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    const toggleSwitch = screen.getByLabelText("Toggle active status for DOW-01");
    expect((toggleSwitch as HTMLInputElement).checked).toBe(true);

    fireEvent.click(toggleSwitch);

    await waitFor(() => {
      expect(omActions.toggleDowntimeReasonActiveAction).toHaveBeenCalledWith("dtr_1", false);
    });
  });

  it("toggles downtime reason active status via toggle button", async () => {
    render(
      <OMSettingsClient
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    const toggleBtn = screen.getByLabelText("Toggle DOW-01");
    expect(toggleBtn.textContent).toBe("Deactivate");

    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(omActions.toggleDowntimeReasonActiveAction).toHaveBeenCalledWith("dtr_1", false);
    });
  });

  it("opens '+ Add Reason Template' modal, fills fields, and submits calling createDowntimeReasonAction", async () => {
    render(
      <OMSettingsClient
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    const addReasonBtn = screen.getByRole("button", {
      name: /\+ Add Reason Template/i,
    });
    fireEvent.click(addReasonBtn);

    expect(screen.getByRole("heading", { name: /Add Reason Template/i })).toBeDefined();

    const codeInput = screen.getByLabelText("Reason Code");
    const nameEnInput = screen.getByLabelText("Reason English Name");
    const nameAmInput = screen.getByLabelText("Reason Amharic Name");
    const categorySelect = screen.getByLabelText("Reason Category");

    fireEvent.change(codeInput, { target: { value: "DOW-10" } });
    fireEvent.change(nameEnInput, { target: { value: "Compressor Pressure Drop" } });
    fireEvent.change(nameAmInput, { target: { value: "የኮምፕረሰር ግፊት መቀነስ" } });
    fireEvent.change(categorySelect, { target: { value: "machine" } });

    const submitBtn = screen.getByRole("button", { name: "Add Reason Template" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(omActions.createDowntimeReasonAction).toHaveBeenCalledWith({
        code: "DOW-10",
        nameEn: "Compressor Pressure Drop",
        nameAm: "የኮምፕረሰር ግፊት መቀነስ",
        category: "machine",
        active: true,
      });
    });

    // Check that DOW-10 is rendered
    await waitFor(() => {
      expect(screen.getByText("DOW-10")).toBeDefined();
      expect(screen.getByText("Compressor Pressure Drop")).toBeDefined();
    });
  });

  it("opens Edit modal for a downtime reason, modifies details, and saves calling updateDowntimeReasonAction", async () => {
    render(
      <OMSettingsClient
        initialSpecialDays={sampleSpecialDays}
        initialDowntimeReasons={sampleDowntimeReasons}
      />
    );

    const editBtn = screen.getByLabelText("Edit DOW-01");
    fireEvent.click(editBtn);

    expect(screen.getByText("Edit Reason Template: DOW-01")).toBeDefined();

    const editNameEn = screen.getByLabelText("Edit English Name");
    fireEvent.change(editNameEn, { target: { value: "Extruder Motor Major Breakdown" } });

    const saveChangesBtn = screen.getByRole("button", { name: "Save Changes" });
    fireEvent.click(saveChangesBtn);

    await waitFor(() => {
      expect(omActions.updateDowntimeReasonAction).toHaveBeenCalledWith(
        "dtr_1",
        expect.objectContaining({
          nameEn: "Extruder Motor Major Breakdown",
        })
      );
    });
  });
});
