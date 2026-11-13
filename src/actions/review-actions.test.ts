import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  markDailyReportReviewedAction,
  unmarkDailyReportReviewedAction,
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  reviewItemAction,
  updateDailyPlanAction,
  sendReportReminderAction,
} from "./review-actions";
import * as authz from "@/lib/authz";
import { db } from "@/db";
import {
  factories,
  factoryUsers,
  users,
  plans,
  dailyReportReviews,
  industryProfile,
  specialDays,
  notifications,
} from "@/db/schema";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireUser: vi.fn(),
}));

let mockFactory: any = null;
let mockNotificationsList: any[] = [];
let mockUpsertedReview: any = null;
let mockDeletedReview: any = null;
let mockUpdatedNotifications: any[] = [];
let mockPlanInDb: any = null;
let mockUpdatedPlan: any = null;
let mockExistingReviewRecord: any = null;
let mockFmsList: any[] = [];
let mockInsertedNotifications: any[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => {
          const resolveForTable = () => {
            if (table === factories) return mockFactory ? [mockFactory] : [];
            if (table === plans) return mockPlanInDb ? [mockPlanInDb] : [];
            if (table === dailyReportReviews) return mockExistingReviewRecord ? [mockExistingReviewRecord] : [];
            if (table === industryProfile) return [{ workingDays: [1, 2, 3, 4, 5, 6] }];
            if (table === specialDays) return [];
            if (table === factoryUsers) return mockFmsList;
            if (table === notifications) return mockNotificationsList;
            return mockFactory ? [mockFactory] : [];
          };

          const queryObj: any = {
            innerJoin: vi.fn(() => queryObj),
            where: vi.fn(() => queryObj),
            limit: vi.fn(() => Promise.resolve(resolveForTable())),
            orderBy: vi.fn(() => queryObj),
            then: (resolve: any) => Promise.resolve(resolveForTable()).then(resolve),
          };

          return queryObj;
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => {
          mockInsertedNotifications.push(vals);
          return {
            onConflictDoUpdate: vi.fn((opts: any) => {
              mockUpsertedReview = vals;
              return Promise.resolve([{ id: vals.id }]);
            }),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn((cond: any) => {
            if (vals.isRead !== undefined) {
              mockUpdatedNotifications.push(vals);
            }
            if (vals.plannedQty !== undefined) {
              mockUpdatedPlan = vals;
            }
            if (vals.status !== undefined || vals.itemReviews !== undefined) {
              mockUpsertedReview = vals;
            }
            return Promise.resolve();
          }),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn((cond: any) => {
          mockDeletedReview = cond;
          return Promise.resolve();
        }),
      })),
    },
  };
});

describe("Review Actions - Operation Manager & Notifications", () => {
  const omUser: authz.SessionUser = {
    id: "usr_om_1",
    name: "Dawit OM",
    email: "om@dpm.local",
    role: "om",
    active: true,
    mustChangePassword: false,
  };

  const fmUser: authz.SessionUser = {
    id: "usr_fm_1",
    name: "Abebe FM",
    email: "fm@dpm.local",
    role: "fm",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFactory = { id: "fac_1", omId: "usr_om_1", name: "Plant A" };
    mockNotificationsList = [];
    mockUpsertedReview = null;
    mockDeletedReview = null;
    mockUpdatedNotifications = [];
    mockExistingReviewRecord = null;
  });

  describe("markDailyReportReviewedAction", () => {
    it("rejects review if user is FM (not OM or sys_admin)", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await markDailyReportReviewedAction({
        factoryId: "fac_1",
        date: "2026-11-08",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Forbidden/i);
    });

    it("rejects review if OM is not assigned to the factory", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);
      mockFactory = { id: "fac_1", omId: "other_om", name: "Plant A" };

      const res = await markDailyReportReviewedAction({
        factoryId: "fac_1",
        date: "2026-11-08",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Forbidden: You are not assigned/i);
    });

    it("allows assigned OM to mark report as reviewed", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await markDailyReportReviewedAction({
        factoryId: "fac_1",
        date: "2026-11-08",
        note: "Reviewed and approved",
      });

      expect(res.success).toBe(true);
      expect(res.review).toBeDefined();
      expect(res.review?.status).toBe("reviewed");
      expect(res.review?.reviewedBy).toBe("usr_om_1");
      expect(mockUpsertedReview).toBeDefined();
      expect(mockUpsertedReview.status).toBe("reviewed");
    });
  });

  describe("unmarkDailyReportReviewedAction", () => {
    it("rejects unmark if user is FM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await unmarkDailyReportReviewedAction({
        factoryId: "fac_1",
        date: "2026-11-08",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Forbidden/i);
    });

    it("allows OM to revoke review", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await unmarkDailyReportReviewedAction({
        factoryId: "fac_1",
        date: "2026-11-08",
      });

      expect(res.success).toBe(true);
      expect(mockDeletedReview).toBeDefined();
    });
  });

  describe("Notifications actions", () => {
    it("fetches notifications and computes unread count", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);
      mockNotificationsList = [
        {
          id: "n_1",
          title: "New Report",
          message: "Report submitted",
          type: "report_submitted",
          link: "/entry?date=2026-11-08",
          factoryId: "fac_1",
          reportDate: "2026-11-08",
          isRead: false,
          createdAt: new Date(),
        },
        {
          id: "n_2",
          title: "Old Report",
          message: "Report approved",
          type: "report_submitted",
          link: "/entry?date=2026-11-07",
          factoryId: "fac_1",
          reportDate: "2026-11-07",
          isRead: true,
          createdAt: new Date(),
        },
      ];

      const res = await getNotificationsAction();
      expect(res.success).toBe(true);
      expect(res.notifications.length).toBe(2);
      expect(res.unreadCount).toBe(1);
    });

    it("marks single notification as read", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await markNotificationReadAction("n_1");
      expect(res.success).toBe(true);
      expect(mockUpdatedNotifications.length).toBe(1);
      expect(mockUpdatedNotifications[0].isRead).toBe(true);
    });

    it("marks all notifications as read", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await markAllNotificationsReadAction();
      expect(res.success).toBe(true);
      expect(mockUpdatedNotifications.length).toBe(1);
      expect(mockUpdatedNotifications[0].isRead).toBe(true);
    });
  });

  describe("reviewItemAction", () => {
    it("rejects item review if user is FM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await reviewItemAction({
        factoryId: "fac_1",
        date: "2026-11-08",
        lineId: "line_1",
        productId: "prod_1",
        status: "approved",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Forbidden/i);
    });

    it("allows OM to approve an item and records item review", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);
      mockExistingReviewRecord = {
        id: "rev_fac_1_2026-11-08",
        factoryId: "fac_1",
        date: "2026-11-08",
        itemReviews: {},
      };

      const res = await reviewItemAction({
        factoryId: "fac_1",
        date: "2026-11-08",
        lineId: "line_1",
        productId: "prod_1",
        status: "approved",
        note: "Line output matches spec",
      });

      expect(res.success).toBe(true);
      expect(res.itemReview).toBeDefined();
      expect(res.itemReview?.status).toBe("approved");
      expect(mockUpsertedReview).toBeDefined();
      expect(mockUpsertedReview.itemReviews["line_1_prod_1"].status).toBe("approved");
    });

    it("allows OM to deny an item and records denial", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);

      const res = await reviewItemAction({
        factoryId: "fac_1",
        date: "2026-11-08",
        lineId: "line_1",
        productId: "prod_1",
        status: "denied",
        note: "High defect rate rejected by QA",
      });

      expect(res.success).toBe(true);
      expect(res.itemReview?.status).toBe("denied");
      expect(mockUpsertedReview.itemReviews["line_1_prod_1"].status).toBe("denied");
    });
  });

  describe("updateDailyPlanAction", () => {
    it("rejects daily plan update if user is FM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await updateDailyPlanAction({
        factoryId: "fac_1",
        lineId: "line_1",
        productId: "prod_1",
        date: "2026-11-08",
        newDailyTarget: 150,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Forbidden/i);
    });

    it("allows OM to adjust daily target, recalculates annual plan and preserves initialPlannedQty", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);
      mockPlanInDb = {
        id: "plan_1",
        lineId: "line_1",
        productId: "prod_1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        plannedQty: 26000,
        initialPlannedQty: 26000,
      };

      const res = await updateDailyPlanAction({
        factoryId: "fac_1",
        lineId: "line_1",
        productId: "prod_1",
        date: "2026-11-08",
        planId: "plan_1",
        newDailyTarget: 120,
      });

      expect(res.success).toBe(true);
      expect(res.plan).toBeDefined();
      expect(res.plan?.initialPlannedQty).toBe(26000); // Preserved initial baseline
      expect(res.plan?.dailyTarget).toBe(120);
      expect(mockUpdatedPlan).toBeDefined();
      expect(mockUpdatedPlan.initialPlannedQty).toBe(26000);
      expect(mockUpdatedPlan.plannedQty).toBeGreaterThan(0);
    });
  });

  describe("sendReportReminderAction", () => {
    it("rejects when called by FM", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(fmUser);

      const res = await sendReportReminderAction({
        factoryId: "fac_1",
        date: "2026-11-13",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("rejects when factory is not found or OM is not assigned to factory", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);
      mockFactory = { id: "fac_1", name: "Plant 1", omId: "usr_other_om" };

      const res = await sendReportReminderAction({
        factoryId: "fac_1",
        date: "2026-11-13",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden: You are not assigned");
    });

    it("rejects when no active FMs are assigned to factory", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);
      mockFactory = { id: "fac_1", name: "Plant 1", omId: "usr_om_1" };
      mockFmsList = [];

      const res = await sendReportReminderAction({
        factoryId: "fac_1",
        date: "2026-11-13",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("No active Factory Managers are assigned");
    });

    it("dispatches notification reminders to all active Factory Managers for the factory", async () => {
      vi.mocked(authz.requireUser).mockResolvedValue(omUser);
      mockFactory = { id: "fac_1", name: "Hawassa Plant", omId: "usr_om_1" };
      mockFmsList = [
        { userId: "usr_fm_1", userName: "Abebe FM", userEmail: "abebe@dpm.local" },
        { userId: "usr_fm_2", userName: "Chala FM", userEmail: "chala@dpm.local" },
      ];
      mockInsertedNotifications = [];

      const res = await sendReportReminderAction({
        factoryId: "fac_1",
        date: "2026-11-13",
        message: "Please upload today's production report immediately.",
      });

      expect(res.success).toBe(true);
      expect(res.notifiedCount).toBe(2);
      expect(res.recipients).toEqual(["Abebe FM", "Chala FM"]);
      expect(mockInsertedNotifications.length).toBe(2);
      expect(mockInsertedNotifications[0].userId).toBe("usr_fm_1");
      expect(mockInsertedNotifications[0].type).toBe("report_reminder");
      expect(mockInsertedNotifications[0].title).toContain("Hawassa Plant");
      expect(mockInsertedNotifications[0].message).toContain("Please upload today's production report");
      expect(mockInsertedNotifications[0].link).toBe("/entry?date=2026-11-13");
    });
  });
});
