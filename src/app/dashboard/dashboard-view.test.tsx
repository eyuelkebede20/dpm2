import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardView } from "./dashboard-view";

vi.mock("next/link", () => ({
  default: ({ children, href, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

describe("Button & Link Interaction Tests - DashboardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders FM quick-action navigation buttons (Daily Entry, Calendar, Store)", () => {
    render(
      <DashboardView
        user={{
          id: "usr_fm_1",
          name: "Abebe FM",
          email: "abebe@dpm.local",
          role: "fm",
          active: true,
          mustChangePassword: false,
        }}
        factoryName="Hawassa Plant"
        calendarSystem="gregorian"
        fmData={{
          todayDate: "2026-03-24",
          todayActual: 1000,
          todayTarget: 1200,
          todayVariance: -200,
          todayPerformance: 83.3,
          todayRework: 10,
          todayReject: 5,
          todayScrap: 2,
          todayWip: 20,
          mtdActual: 25000,
          mtdTarget: 30000,
          mtdVariance: -5000,
          mtdPerformance: 83.3,
          lineBreakdowns: [],
        }}
      />
    );

    const entryBtn = screen.getByRole("link", { name: /daily entry/i });
    expect(entryBtn.getAttribute("href")).toBe("/entry");

    const calBtn = screen.getByRole("link", { name: /calendar/i });
    expect(calBtn.getAttribute("href")).toBe("/calendar");

    const storeBtn = screen.getByRole("link", { name: /store/i });
    expect(storeBtn.getAttribute("href")).toBe("/fm/store");
  });

  it("renders OM quick-action navigation buttons (Manage Plants, Calendar)", () => {
    render(
      <DashboardView
        user={{
          id: "usr_om_1",
          name: "Solomon OM",
          email: "solomon@dpm.local",
          role: "om",
          active: true,
          mustChangePassword: false,
        }}
        calendarSystem="gregorian"
        omData={{
          totalOMOutput: 125000,
          totalOMTarget: 130000,
          overallPerformance: 96.1,
          factories: [],
        }}
      />
    );

    const plantsBtn = screen.getByRole("link", { name: /manage plants/i });
    expect(plantsBtn.getAttribute("href")).toBe("/om");

    const calBtn = screen.getByRole("link", { name: /calendar/i });
    expect(calBtn.getAttribute("href")).toBe("/calendar");
  });

  it("renders QA quick-action navigation button (New Inspection)", () => {
    render(
      <DashboardView
        user={{
          id: "usr_qa_1",
          name: "Hanna QA",
          email: "hanna@dpm.local",
          role: "qa",
          active: true,
          mustChangePassword: false,
        }}
        calendarSystem="gregorian"
        qaData={{
          inspectionCount: 5,
          totalChecked: 1500,
          totalDefects: 12,
          defectRate: 0.8,
          recentInspections: [],
        }}
      />
    );

    const inspectBtns = screen.getAllByRole("link", { name: /qa approvals/i });
    expect(inspectBtns[0].getAttribute("href")).toBe("/qa");
  });

  it("renders Sys Admin quick-action navigation button (Admin Portal)", () => {
    render(
      <DashboardView
        user={{
          id: "usr_admin_1",
          name: "Admin User",
          email: "admin@dpm.local",
          role: "sys_admin",
          active: true,
          mustChangePassword: false,
        }}
        calendarSystem="gregorian"
        adminData={{
          stats: {
            activeFactories: 3,
            totalFactories: 3,
            totalOMs: 2,
            totalFMs: 4,
            totalQAs: 6,
            totalUsers: 13,
            activeUsers: 12,
            inactiveUsers: 1,
            needsPasswordChange: 2,
          },
          profile: {
            companyName: "Acme Industrial",
            units: "pcs",
            workingDays: [1, 2, 3, 4, 5, 6],
            calendarSystem: "gregorian",
          },
          recentFactories: [],
        }}
      />
    );

    const adminBtns = screen.getAllByRole("link", { name: /admin portal/i });
    expect(adminBtns[0].getAttribute("href")).toBe("/admin");
  });
});
