"use server";

import { db } from "@/db";
import {
  users,
  factories,
  factoryUsers,
  lines,
  products,
  lineProducts,
  plans,
  reportEntries,
  stockLedger,
  industryProfile,
  qaAssignments,
  qaInspections,
  qaApprovals,
  specialDays,
  downtimeReasons,
  dailyReportReviews,
} from "@/db/schema";
import { requireUser, can } from "@/lib/authz";
import { eq, and, sql, gte, lte, desc, asc, inArray } from "drizzle-orm";
import { calculateDailyTarget } from "@/lib/target";

export async function getCurrentUserContext() {
  const user = await requireUser();

  // Find factory if user is FM or QA
  let userFactoryId: string | null = null;
  let userFactoryName: string | null = null;

  if (user.role === "fm" || user.role === "qa") {
    const [fu] = await db
      .select({
        factoryId: factoryUsers.factoryId,
        factoryName: factories.name,
      })
      .from(factoryUsers)
      .innerJoin(factories, eq(factories.id, factoryUsers.factoryId))
      .where(eq(factoryUsers.userId, user.id))
      .limit(1);

    if (fu) {
      userFactoryId = fu.factoryId;
      userFactoryName = fu.factoryName;
    }
  } else if (user.role === "om") {
    const [fac] = await db
      .select({ id: factories.id, name: factories.name })
      .from(factories)
      .where(eq(factories.omId, user.id))
      .limit(1);

    if (fac) {
      userFactoryId = fac.id;
      userFactoryName = fac.name;
    }
  }

  const [profile] = await db
    .select()
    .from(industryProfile)
    .where(eq(industryProfile.id, "default"))
    .limit(1);

  return {
    user,
    factoryId: userFactoryId,
    factoryName: userFactoryName,
    industryProfile: profile || {
      companyName: "Daily Production Manager",
      workingDays: [1, 2, 3, 4, 5, 6],
      units: "pcs",
      calendarSystem: "ethiopian",
    },
  };
}

export async function getFactoryLinesAndProducts(factoryId: string) {
  const user = await requireUser();
  const allowed = await can(user, "read", { type: "factory", factoryId });
  if (!allowed) throw new Error("Unauthorized to access this factory's lines/products");

  const linesList = await db
    .select()
    .from(lines)
    .where(and(eq(lines.factoryId, factoryId), eq(lines.active, true)));

  const productsList = await db
    .select()
    .from(products)
    .where(and(eq(products.factoryId, factoryId), eq(products.active, true)));

  const links = await db.select().from(lineProducts);

  return {
    lines: linesList,
    products: productsList,
    lineProducts: links,
  };
}

export async function getDailyGridData(factoryId: string, date: string) {
  const user = await requireUser();
  const allowed = await can(user, "read", { type: "factory", factoryId });
  if (!allowed) throw new Error("Unauthorized to access factory data");

  const [profile] = await db.select().from(industryProfile).limit(1);
  const workingDays = profile?.workingDays || [1, 2, 3, 4, 5, 6];

  // Fetch active lines and products for this factory
  const factoryLines = await db
    .select()
    .from(lines)
    .where(and(eq(lines.factoryId, factoryId), eq(lines.active, true)));

  const factoryProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.factoryId, factoryId), eq(products.active, true)));

  const lineProductLinks = await db.select().from(lineProducts);

  // Fetch plans covering this date
  const activePlans = await db
    .select()
    .from(plans)
    .where(and(lte(plans.startDate, date), gte(plans.endDate, date)));

  // Fetch report entries for this factory/date and plan periods up to date
  const minStartDate = activePlans.reduce(
    (min, p) => (p.startDate < min ? p.startDate : min),
    date
  );

  const reportEntriesList = await db
    .select()
    .from(reportEntries)
    .where(and(gte(reportEntries.date, minStartDate), lte(reportEntries.date, date)));

  // Fetch special day for date
  const [specialDayRecord] = await db
    .select()
    .from(specialDays)
    .where(eq(specialDays.date, date))
    .limit(1);

  // Fetch active downtime reasons ordered by sortOrder asc
  let activeDowntimeReasons: any[] = [];
  try {
    activeDowntimeReasons = await db
      .select()
      .from(downtimeReasons)
      .where(eq(downtimeReasons.isActive, true))
      .orderBy(asc(downtimeReasons.sortOrder));
  } catch {
    activeDowntimeReasons = [];
  }

  // Fetch QA inspections for this date with inspector names
  let dateInspections: any[] = [];
  try {
    dateInspections = await db
      .select({
        id: qaInspections.id,
        lineId: qaInspections.lineId,
        productId: qaInspections.productId,
        checked: qaInspections.checked,
        defects: qaInspections.defects,
        note: qaInspections.note,
        createdBy: qaInspections.createdBy,
        createdAt: qaInspections.createdAt,
        inspectorName: users.name,
      })
      .from(qaInspections)
      .innerJoin(users, eq(qaInspections.createdBy, users.id))
      .where(eq(qaInspections.date, date));
  } catch {
    dateInspections = [];
  }

  // Fetch QA approvals (decisions made on /qa) for this date's report entries
  let dateApprovals: any[] = [];
  try {
    const dayEntryIds = reportEntriesList
      .filter((e) => e.date === date)
      .map((e) => e.id);

    if (dayEntryIds.length > 0) {
      dateApprovals = await db
        .select({
          id: qaApprovals.id,
          reportEntryId: qaApprovals.reportEntryId,
          status: qaApprovals.status,
          note: qaApprovals.note,
          qaUserId: qaApprovals.qaUserId,
          qaUserName: users.name,
          updatedAt: qaApprovals.updatedAt,
        })
        .from(qaApprovals)
        .innerJoin(users, eq(qaApprovals.qaUserId, users.id))
        .where(inArray(qaApprovals.reportEntryId, dayEntryIds));
    }
  } catch {
    dateApprovals = [];
  }

  // Fetch OM review sign-off for this factory and date
  let reportReviewRecord: any = null;
  try {
    const reviews = await db
      .select({
        id: dailyReportReviews.id,
        factoryId: dailyReportReviews.factoryId,
        date: dailyReportReviews.date,
        status: dailyReportReviews.status,
        reviewedBy: dailyReportReviews.reviewedBy,
        reviewedAt: dailyReportReviews.reviewedAt,
        note: dailyReportReviews.note,
        itemReviews: dailyReportReviews.itemReviews,
        reviewerName: users.name,
      })
      .from(dailyReportReviews)
      .innerJoin(users, eq(dailyReportReviews.reviewedBy, users.id))
      .where(
        and(
          eq(dailyReportReviews.factoryId, factoryId),
          eq(dailyReportReviews.date, date)
        )
      )
      .limit(1);
    reportReviewRecord = reviews[0] || null;
  } catch {
    reportReviewRecord = null;
  }

  // Build grid items
  const gridRows = [];

  const specialDaysList = specialDayRecord
    ? [
        {
          date: specialDayRecord.date,
          isWorkingDay: specialDayRecord.isWorkingDay,
          nameEn: specialDayRecord.nameEn,
          nameAm: specialDayRecord.nameAm,
        },
      ]
    : undefined;

  for (const line of factoryLines) {
    const linkedProductIds = lineProductLinks
      .filter((lp) => lp.lineId === line.id)
      .map((lp) => lp.productId);

    const prodsForLine = factoryProducts.filter((p) =>
      linkedProductIds.includes(p.id)
    );

    for (const prod of prodsForLine) {
      const plan = activePlans.find(
        (p) => p.lineId === line.id && p.productId === prod.id
      );

      const entry = reportEntriesList.find(
        (e) => e.lineId === line.id && e.productId === prod.id && (!e.date || e.date === date)
      );

      // Prior finished good produced during the plan period strictly before `date`
      const priorFinishedGood = plan
        ? reportEntriesList
            .filter(
              (e) =>
                e.lineId === line.id &&
                e.productId === prod.id &&
                Boolean(e.date) &&
                e.date >= plan.startDate &&
                e.date < date
            )
            .reduce((sum, e) => sum + (e.finishedGood || 0), 0)
        : 0;

      const currentFG = entry ? entry.finishedGood || 0 : 0;
      const cumulativeProduced = priorFinishedGood + currentFG;
      const leftFromWeeklyPlanned = plan
        ? Math.max(0, plan.plannedQty - cumulativeProduced)
        : 0;

      // Pass special day to calculateDailyTarget so non-working holidays evaluate to 0
      const targetCalc = plan
        ? calculateDailyTarget(
            {
              startDate: plan.startDate,
              endDate: plan.endDate,
              plannedQty: plan.plannedQty,
            },
            date,
            workingDays,
            specialDaysList
          )
        : null;

      const qaApproval = entry
        ? (dateApprovals as any[]).find((a) => a.reportEntryId === entry.id)
        : null;

      const qaInspection = (dateInspections as any[]).find(
        (qa) => qa.lineId === line.id && qa.productId === prod.id
      );

      let qaReview: any;

      if (qaApproval) {
        // QA decision recorded via /qa (1-Click Approve / Reject)
        const isApproved = qaApproval.status === "approved";
        qaReview = {
          isReviewed: true,
          status: isApproved ? ("approved" as const) : ("denied" as const),
          verdict: isApproved ? "QA Approved" : "QA Denied",
          inspectorId: qaApproval.qaUserId,
          inspectorName: qaApproval.qaUserName || "QA Inspector",
          checked: qaInspection?.checked ?? (entry ? entry.finishedGood + entry.rework + entry.reject : 0),
          defects: qaInspection?.defects ?? (entry ? entry.reject + entry.scrap : 0),
          defectRate: qaInspection
            ? qaInspection.checked > 0
              ? Number(((qaInspection.defects / qaInspection.checked) * 100).toFixed(1))
              : 0
            : entry && entry.finishedGood + entry.rework + entry.reject > 0
            ? Number(
                (
                  ((entry.reject + entry.scrap) /
                    (entry.finishedGood + entry.rework + entry.reject)) *
                  100
                ).toFixed(1)
              )
            : 0,
          note: qaApproval.note || qaInspection?.note || null,
          createdAt: qaApproval.updatedAt
            ? new Date(qaApproval.updatedAt).toISOString()
            : null,
        };
      } else if (qaInspection) {
        qaReview = {
          isReviewed: true,
          status: qaInspection.defects === 0 ? ("approved" as const) : ("denied" as const),
          verdict: qaInspection.defects === 0 ? "QA Approved" : "QA Denied",
          inspectorId: qaInspection.createdBy,
          inspectorName: qaInspection.inspectorName,
          checked: qaInspection.checked,
          defects: qaInspection.defects,
          defectRate:
            qaInspection.checked > 0
              ? Number(
                  ((qaInspection.defects / qaInspection.checked) * 100).toFixed(
                    1
                  )
                )
              : 0,
          note: qaInspection.note || null,
          createdAt: qaInspection.createdAt
            ? new Date(qaInspection.createdAt).toISOString()
            : null,
        };
      } else {
        qaReview = {
          isReviewed: false,
          status: "pending" as const,
          verdict: "Pending QA Inspection",
          inspectorId: null,
          inspectorName: null,
          checked: 0,
          defects: 0,
          defectRate: 0,
          note: null,
          createdAt: null,
        };
      }

      const itemKey = `${line.id}_${prod.id}`;
      const itemReview = (reportReviewRecord?.itemReviews as any)?.[itemKey] || null;

      gridRows.push({
        lineId: line.id,
        lineName: line.name,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        plan: plan
          ? {
              id: plan.id,
              startDate: plan.startDate,
              endDate: plan.endDate,
              plannedQty: plan.plannedQty,
              initialPlannedQty: plan.initialPlannedQty ?? plan.plannedQty,
              weeklyPlanned: plan.plannedQty,
              priorFinishedGood,
              cumulativeProduced,
              leftFromWeeklyPlanned,
              dailyTarget: targetCalc?.hasTarget ? targetCalc.displayTarget : 0,
            }
          : null,
        entry: entry || {
          finishedGood: 0,
          rework: 0,
          reject: 0,
          scrap: 0,
          wip: 0,
          downtimeMinutes: 0,
          issueNote: "",
          downtimeReasonId: null,
        },
        qaReview,
        itemReview,
      });
    }
  }

  const factoryLineIds = factoryLines.map((l) => l.id);
  const existingDayEntries = reportEntriesList.filter(
    (e) => e.date === date && factoryLineIds.includes(e.lineId)
  );
  const isDaySubmitted = existingDayEntries.length > 0;
  const submittedAt = existingDayEntries[0]?.updatedAt
    ? new Date(existingDayEntries[0].updatedAt).toISOString()
    : null;
  const submittedBy = existingDayEntries[0]?.updatedBy || null;

  return {
    date,
    factoryId,
    workingDays,
    gridRows,
    isDaySubmitted,
    submittedAt,
    submittedBy,
    specialDay: specialDayRecord
      ? {
          nameEn: specialDayRecord.nameEn,
          nameAm: specialDayRecord.nameAm,
          type: specialDayRecord.type,
          isWorkingDay: specialDayRecord.isWorkingDay,
        }
      : null,
    downtimeReasons: (Array.isArray(activeDowntimeReasons)
      ? activeDowntimeReasons
      : []
    ).map((r) => ({
      id: r.id,
      code: r.code,
      nameEn: r.nameEn,
      nameAm: r.nameAm,
      category: r.category,
    })),
    reportReview: reportReviewRecord
      ? {
          isReviewed: reportReviewRecord.status === "reviewed",
          reviewedBy: reportReviewRecord.reviewedBy,
          reviewerName: reportReviewRecord.reviewerName,
          reviewedAt: reportReviewRecord.reviewedAt
            ? new Date(reportReviewRecord.reviewedAt).toISOString()
            : null,
          note: reportReviewRecord.note || null,
          itemReviews: (reportReviewRecord.itemReviews as any) || {},
        }
      : {
          isReviewed: false,
          reviewedBy: null,
          reviewerName: null,
          reviewedAt: null,
          note: null,
          itemReviews: {},
        },
  };
}

export async function getMonthCalendarSummary(
  factoryId: string,
  startDateStr: string,
  endDateStr: string
) {
  const user = await requireUser();
  const allowed = await can(user, "read", { type: "factory", factoryId });
  if (!allowed) throw new Error("Unauthorized to access calendar data");

  const [profile] = await db.select().from(industryProfile).limit(1);
  const workingDays = profile?.workingDays || [1, 2, 3, 4, 5, 6];

  // Daily entries in month
  const entries = await db
    .select({
      id: reportEntries.id,
      date: reportEntries.date,
      lineId: reportEntries.lineId,
      lineName: lines.name,
      productId: reportEntries.productId,
      productName: products.name,
      finishedGood: reportEntries.finishedGood,
      rework: reportEntries.rework,
      reject: reportEntries.reject,
      scrap: reportEntries.scrap,
      wip: reportEntries.wip,
      downtimeMinutes: reportEntries.downtimeMinutes,
      issueNote: reportEntries.issueNote,
    })
    .from(reportEntries)
    .innerJoin(lines, eq(lines.id, reportEntries.lineId))
    .innerJoin(products, eq(products.id, reportEntries.productId))
    .where(
      and(
        eq(lines.factoryId, factoryId),
        gte(reportEntries.date, startDateStr),
        lte(reportEntries.date, endDateStr)
      )
    );

  // Active products in factory
  const factoryProducts = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
    })
    .from(products)
    .where(and(eq(products.factoryId, factoryId), eq(products.active, true)));

  // Plans covering the period
  const factoryPlans = await db
    .select({
      lineId: plans.lineId,
      productId: plans.productId,
      productName: products.name,
      startDate: plans.startDate,
      endDate: plans.endDate,
      plannedQty: plans.plannedQty,
    })
    .from(plans)
    .innerJoin(lines, eq(lines.id, plans.lineId))
    .innerJoin(products, eq(products.id, plans.productId))
    .where(eq(lines.factoryId, factoryId));

  return {
    workingDays,
    entries,
    plans: factoryPlans,
    products: factoryProducts,
  };
}

export async function getStoreStockLedger(factoryId: string) {
  const user = await requireUser();
  const allowed = await can(user, "read", { type: "stock_ledger", factoryId });
  if (!allowed) throw new Error("Unauthorized to access store ledger");

  // Aggregate current stock: sum(delta) group by product
  const balances = await db
    .select({
      productId: stockLedger.productId,
      productName: products.name,
      sku: products.sku,
      currentStock: sql<number>`COALESCE(SUM(${stockLedger.delta}), 0)::int`,
    })
    .from(stockLedger)
    .innerJoin(products, eq(products.id, stockLedger.productId))
    .where(eq(stockLedger.factoryId, factoryId))
    .groupBy(stockLedger.productId, products.name, products.sku);

  // Recent transactions
  const transactions = await db
    .select({
      id: stockLedger.id,
      productId: stockLedger.productId,
      productName: products.name,
      delta: stockLedger.delta,
      createdAt: stockLedger.createdAt,
      reportEntryId: stockLedger.reportEntryId,
    })
    .from(stockLedger)
    .innerJoin(products, eq(products.id, stockLedger.productId))
    .where(eq(stockLedger.factoryId, factoryId))
    .orderBy(desc(stockLedger.createdAt))
    .limit(50);

  return {
    balances,
    transactions,
  };
}
