"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  markDailyReportReviewedAction,
} from "@/actions/review-actions";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  factoryId: string | null;
  factoryName?: string | null;
  reportDate: string | null;
  isRead: boolean;
  createdAt: string | Date;
  value?: string;
  isPositive?: boolean;
}

interface NotificationsDropdownProps {
  userRole: string;
}

export function NotificationsDropdown({ userRole }: NotificationsDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewedReports, setReviewedReports] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await getNotificationsAction();
      if (res.success && res.notifications) {
        setNotifications(res.notifications as NotificationItem[]);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Non-fatal (e.g. offline or test environment without request headers)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll periodically every 45s for new report submissions
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await markNotificationReadAction(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn("Error marking read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadAction();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Error marking all read:", err);
    }
  };

  const handleReviewFromNotification = async (
    item: NotificationItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!item.factoryId || !item.reportDate) return;

    setReviewingId(item.id);
    try {
      const res = await markDailyReportReviewedAction({
        factoryId: item.factoryId,
        date: item.reportDate,
      });

      if (res.success) {
        setReviewedReports((prev) =>
          new Set(prev).add(`${item.factoryId}_${item.reportDate}`)
        );
        // Mark as read in list
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        router.refresh();
      } else {
        alert(res.error || "Failed to mark report as reviewed");
      }
    } catch (err: any) {
      alert(err.message || "Failed to review report");
    } finally {
      setReviewingId(null);
    }
  };

  const isOM = userRole === "om" || userRole === "sys_admin";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchNotifications();
          }
        }}
        className={`relative p-2 rounded-xl transition-all focus:outline-hidden touch-target flex items-center justify-center ${
          isOpen
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-extrabold font-mono text-white ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-[420px] bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="badge badge-sm badge-neutral font-mono font-bold text-[10px]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="loading loading-spinner loading-sm mb-2" />
                <p className="text-xs">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  No notifications
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  New production reports and inspection updates will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isReportSub = n.type === "report_submitted";
                const isReviewed =
                  reviewedReports.has(`${n.factoryId}_${n.reportDate}`) ||
                  n.message.includes("marked as reviewed");
                const isItemReviewing = reviewingId === n.id;

                let timeAgo = "";
                try {
                  timeAgo = formatDistanceToNow(new Date(n.createdAt), {
                    addSuffix: true,
                  });
                } catch {
                  timeAgo = "";
                }

                // Clean name: "Name..."
                const displayName =
                  n.factoryName ||
                  n.title.replace(/^New Production Report:\s*/i, "").trim() ||
                  "Daily Report";

                // Clean value: "Value - + or -"
                let displayValue = n.value || "";
                let isPositive = n.isPositive ?? true;

                if (!displayValue) {
                  if (n.message && (n.message.startsWith("+") || n.message.startsWith("-"))) {
                    displayValue = n.message;
                    isPositive = !n.message.startsWith("-");
                  } else {
                    displayValue = "+0 pcs";
                    isPositive = true;
                  }
                }

                if (!displayValue.startsWith("+") && !displayValue.startsWith("-")) {
                  displayValue = `+${displayValue}`;
                }

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 transition-colors relative border-b border-slate-100 last:border-b-0 ${
                      n.isRead
                        ? "bg-white hover:bg-slate-50/80"
                        : "bg-indigo-50/30 hover:bg-indigo-50/60"
                    }`}
                  >
                    {/* Header Row: [new] badge, Name..., Value (+ or -) */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* "new" Badge */}
                        {!n.isRead ? (
                          <span className="badge badge-sm font-black text-[10px] bg-emerald-600 text-white border-none uppercase tracking-wider px-2 py-0.5 rounded-md shadow-2xs shrink-0">
                            new
                          </span>
                        ) : (
                          <span className="badge badge-sm font-bold text-[10px] bg-slate-100 text-slate-400 border-none px-2 py-0.5 rounded-md shrink-0">
                            read
                          </span>
                        )}

                        {/* "Name..." */}
                        <span
                          className="font-black text-slate-900 text-sm truncate"
                          title={displayName}
                        >
                          {displayName}
                        </span>
                      </div>

                      {/* "Value - + or -" */}
                      <div className="shrink-0 font-mono">
                        <span
                          className={`inline-flex items-center gap-1 font-black text-xs sm:text-sm px-2.5 py-1 rounded-xl border ${
                            isPositive
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-rose-700 bg-rose-50 border-rose-200"
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span>{displayValue}</span>
                        </span>
                      </div>
                    </div>

                    {/* Sub-line: Report Date & Time ago */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-0.5">
                      <span className="font-mono text-slate-600 font-semibold">
                        {n.reportDate}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{timeAgo}</span>
                      </span>
                    </div>

                    {/* Action Buttons: View Report and Mark as Reviewed */}
                    <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100">
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (!n.isRead) handleMarkAsRead(n.id);
                            setIsOpen(false);
                          }}
                          className="btn btn-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border-none font-bold rounded-lg gap-1 min-h-[28px] px-3 touch-manipulation transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                          <span>View Report</span>
                        </Link>
                      )}

                      {isOM && n.factoryId && n.reportDate && (
                        <>
                          {isReviewed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Reviewed</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) =>
                                handleReviewFromNotification(n, e)
                              }
                              disabled={isItemReviewing}
                              className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white border-none font-bold rounded-lg gap-1 min-h-[28px] px-3 shadow-xs touch-manipulation transition-transform active:scale-95"
                            >
                              {isItemReviewing ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>Mark as Reviewed</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
