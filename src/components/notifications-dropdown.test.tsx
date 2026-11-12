import "@/test/setup-dom";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NotificationsDropdown } from "./notifications-dropdown";
import * as reviewActions from "@/actions/review-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, className }: any) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/actions/review-actions", () => ({
  getNotificationsAction: vi.fn(),
  markNotificationReadAction: vi.fn().mockResolvedValue({ success: true }),
  markAllNotificationsReadAction: vi.fn().mockResolvedValue({ success: true }),
  markDailyReportReviewedAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Button & Notification Interaction Tests - NotificationsDropdown", () => {
  const sampleNotifications = [
    {
      id: "n_1",
      title: "New Production Report: Hawassa Plant",
      message: "+150 pcs",
      type: "report_submitted",
      link: "/entry?date=2026-11-08",
      factoryId: "fac_1",
      factoryName: "Hawassa Plant",
      reportDate: "2026-11-08",
      isRead: false,
      createdAt: new Date().toISOString(),
      value: "+150 pcs",
      isPositive: true,
    },
    {
      id: "n_2",
      title: "New Production Report: Bole Garment Plant",
      message: "-45 pcs",
      type: "report_submitted",
      link: "/entry?date=2026-11-08",
      factoryId: "fac_2",
      factoryName: "Bole Garment Plant",
      reportDate: "2026-11-08",
      isRead: true,
      createdAt: new Date().toISOString(),
      value: "-45 pcs",
      isPositive: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reviewActions.getNotificationsAction).mockResolvedValue({
      success: true,
      notifications: sampleNotifications as any,
      unreadCount: 1,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("toggles the notifications dropdown open and closed via the Bell button", async () => {
    render(<NotificationsDropdown userRole="om" />);

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    expect(bellBtn).toBeDefined();

    // Initially closed
    expect(screen.queryByText("Hawassa Plant")).toBeNull();

    // Click to open
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText("Hawassa Plant")).toBeDefined();
    });

    // Unread count badge on bell button
    expect(screen.getByText("1")).toBeDefined();
  });

  it("renders 'new' badge, clean 'Name...', and 'Value - + or -' prominently", async () => {
    render(<NotificationsDropdown userRole="om" />);

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      // 1. "new" badge for unread notification and "read" badge for read notification
      expect(screen.getByText("new")).toBeDefined();
      expect(screen.getByText("read")).toBeDefined();

      // 2. "Name..." - Clean factory names
      expect(screen.getByText("Hawassa Plant")).toBeDefined();
      expect(screen.getByText("Bole Garment Plant")).toBeDefined();

      // 3. "Value - + or -" - Positive and negative values with signs
      expect(screen.getByText("+150 pcs")).toBeDefined();
      expect(screen.getByText("-45 pcs")).toBeDefined();
    });
  });

  it("retains the 'View Report' link button with correct destination", async () => {
    render(<NotificationsDropdown userRole="om" />);

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      const viewReportLinks = screen.getAllByRole("link", { name: /view report/i });
      expect(viewReportLinks.length).toBe(2);
      expect(viewReportLinks[0].getAttribute("href")).toBe("/entry?date=2026-11-08");
    });
  });

  it("retains the 'Mark as Reviewed' button for OM and calls markDailyReportReviewedAction", async () => {
    render(<NotificationsDropdown userRole="om" />);

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      const reviewBtns = screen.getAllByRole("button", { name: /mark as reviewed/i });
      expect(reviewBtns.length).toBeGreaterThanOrEqual(1);

      fireEvent.click(reviewBtns[0]);
    });

    await waitFor(() => {
      expect(reviewActions.markDailyReportReviewedAction).toHaveBeenCalledWith({
        factoryId: "fac_1",
        date: "2026-11-08",
      });
    });
  });

  it("marks all notifications as read when 'Mark all read' button is clicked", async () => {
    render(<NotificationsDropdown userRole="om" />);

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      const markAllBtn = screen.getByRole("button", { name: /mark all read/i });
      fireEvent.click(markAllBtn);
    });

    await waitFor(() => {
      expect(reviewActions.markAllNotificationsReadAction).toHaveBeenCalled();
    });
  });
});
