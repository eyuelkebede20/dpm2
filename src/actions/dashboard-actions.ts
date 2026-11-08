"use server";

import { requireUser } from "@/lib/authz";
import { db } from "@/db";
import {
  factories,
  users,
  factoryUsers,
  lines,
  products,
  plans,
  reportEntries,
  qaInspections,
  industryProfile,
} from "@/db/schema";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";
import { calculateDailyTarget, countWorkingDays } from "@/lib/target";

// -------------------------------------------------------------
// Sys Admin Dashboard Data
// -------------------------------------------------------------
export async function getSysAdminDashboardData() {
  const [profile] = await db.select().from(industryProfile).limit(1);

  const allFactories = await db.select().from(factories).orderBy(desc(factories.createdAt));
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

  const stats = {
    totalFactories: allFactories.length,
    activeFactories: allFactories.filter((f) => f.active).length,
    totalOMs: allUsers.filter((u) => u.role === "om").length,
    totalFMs: allUsers.filter((u) => u.role === "fm").length,
    totalQAs: allUsers.filter((u) => u.role === "qa").length,
    totalUsers: allUsers.length,
  };

  return {
    profile: profile || {
      companyName: "Daily Production Manager",
      units: "pcs",
      workingDays: [1, 2, 3, 4, 5, 6],
    },
    stats,
    recentFactories: allFactories.slice(0, 5),
    recentUsers: allUsers.slice(0, 5),
  };
}

// -------------------------------------------------------------
// OM Dashboard Data
// -------------------------------------------------------------
export async function getOMDashboardData(omUserId: string) {
  const [profile] = await db.select().from(industryProfile).limit(1);
  const workingDays = (profile?.workingDays as number[]) || [1, 2, 3, 4, 5, 6];

  // Current month boundaries
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  // Factories belonging to this OM
  const omFactories = await db
    .select()
    .from(factories)
    .where(eq(factories.omId, omUserId));

  const factoryCards = [];
  let totalOMOutput = 0;
  let totalOMTarget = 0;

  for (const fac of omFactories) {
    // Get lines for this factory
    const facLines = await db
      .select({ id: lines.id })
      .from(lines)
      .where(eq(lines.factoryId, fac.id));
    const lineIds = facLines.map((l) => l.id);

    let mtdOutput = 0;
    let mtdRework = 0;
    let mtdReject = 0;
    let mtdScrap = 0;

    if (lineIds.length > 0) {
      const [sumRes] = await db
        .select({
          totalOutput: sql<number>`COALESCE(SUM(${reportEntries.finishedGood}), 0)::int`,
          totalRework: sql<number>`COALESCE(SUM(${reportEntries.rework}), 0)::int`,
          totalReject: sql<number>`COALESCE(SUM(${reportEntries.reject}), 0)::int`,
          totalScrap: sql<number>`COALESCE(SUM(${reportEntries.scrap}), 0)::int`,
        })
        .from(reportEntries)
        .where(
          and(
            inArray(reportEntries.lineId, lineIds),
            gte(reportEntries.date, startOfMonth),
            lte(reportEntries.date, endOfMonth)
          )
        );

      if (sumRes) {
        mtdOutput = sumRes.totalOutput;
        mtdRework = sumRes.totalRework;
        mtdReject = sumRes.totalReject;
        mtdScrap = sumRes.totalScrap;
      }
    }

    // Plans for this factory in this month
    let mtdTarget = 0;
    if (lineIds.length > 0) {
      const activePlans = await db
        .select()
        .from(plans)
        .where(
          and(
            inArray(plans.lineId, lineIds),
            lte(plans.startDate, endOfMonth),
            gte(plans.endDate, startOfMonth)
          )
        );

      for (const p of activePlans) {
        // Calculate target for this month
        mtdTarget += p.plannedQty;
      }
    }

    totalOMOutput += mtdOutput;
    totalOMTarget += mtdTarget;

    const perf = mtdTarget > 0 ? Math.round((mtdOutput / mtdTarget) * 1000) / 10 : null;

    factoryCards.push({
      factoryId: fac.id,
      factoryName: fac.name,
      active: fac.active,
      mtdOutput,
      mtdTarget,
      performance: perf,
      mtdRework,
      mtdReject,
      mtdScrap,
    });
  }

  const overallPerf =
    totalOMTarget > 0 ? Math.round((totalOMOutput / totalOMTarget) * 1000) / 10 : null;

  return {
    startOfMonth,
    endOfMonth,
    totalOMOutput,
    totalOMTarget,
    overallPerformance: overallPerf,
    factories: factoryCards,
  };
}

// -------------------------------------------------------------
// FM Dashboard Data
// -------------------------------------------------------------
export async function getFMDashboardData(factoryId: string) {
  const [profile] = await db.select().from(industryProfile).limit(1);
  const workingDays = (profile?.workingDays as number[]) || [1, 2, 3, 4, 5, 6];

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  // Factory lines
  const facLines = await db
    .select()
    .from(lines)
    .where(eq(lines.factoryId, factoryId));
  const lineIds = facLines.map((l) => l.id);

  if (lineIds.length === 0) {
    return {
      todayStr,
      todayActual: 0,
      todayTarget: 0,
      todayVariance: 0,
      todayRework: 0,
      todayReject: 0,
      todayScrap: 0,
      todayWip: 0,
      mtdActual: 0,
      mtdTarget: 0,
      mtdRework: 0,
      mtdReject: 0,
      mtdScrap: 0,
      mtdWip: 0,
      lineBreakdowns: [],
    };
  }

  // Today's report entries
  const todayEntries = await db
    .select({
      id: reportEntries.id,
      lineId: reportEntries.lineId,
      lineName: lines.name,
      productId: reportEntries.productId,
      productName: products.name,
      productSku: products.sku,
      finishedGood: reportEntries.finishedGood,
      rework: reportEntries.rework,
      reject: reportEntries.reject,
      scrap: reportEntries.scrap,
      wip: reportEntries.wip,
      downtimeMinutes: reportEntries.downtimeMinutes,
    })
    .from(reportEntries)
    .innerJoin(lines, eq(reportEntries.lineId, lines.id))
    .innerJoin(products, eq(reportEntries.productId, products.id))
    .where(and(inArray(reportEntries.lineId, lineIds), eq(reportEntries.date, todayStr)));

  let todayActual = 0;
  let todayRework = 0;
  let todayReject = 0;
  let todayScrap = 0;
  let todayWip = 0;

  for (const e of todayEntries) {
    todayActual += e.finishedGood;
    todayRework += e.rework;
    todayReject += e.reject;
    todayScrap += e.scrap;
    todayWip += e.wip;
  }

  // Active plans for today to calculate todayTarget
  const activePlansToday = await db
    .select()
    .from(plans)
    .where(
      and(
        inArray(plans.lineId, lineIds),
        lte(plans.startDate, todayStr),
        gte(plans.endDate, todayStr)
      )
    );

  let todayTarget = 0;
  for (const p of activePlansToday) {
    const calc = calculateDailyTarget(
      {
        startDate: p.startDate,
        endDate: p.endDate,
        plannedQty: p.plannedQty,
      },
      todayStr,
      workingDays
    );
    if (calc.hasTarget) {
      todayTarget += calc.displayTarget;
    }
  }

  // MTD sums
  const [mtdSum] = await db
    .select({
      totalOutput: sql<number>`COALESCE(SUM(${reportEntries.finishedGood}), 0)::int`,
      totalRework: sql<number>`COALESCE(SUM(${reportEntries.rework}), 0)::int`,
      totalReject: sql<number>`COALESCE(SUM(${reportEntries.reject}), 0)::int`,
      totalScrap: sql<number>`COALESCE(SUM(${reportEntries.scrap}), 0)::int`,
      totalWip: sql<number>`COALESCE(SUM(${reportEntries.wip}), 0)::int`,
    })
    .from(reportEntries)
    .where(
      and(
        inArray(reportEntries.lineId, lineIds),
        gte(reportEntries.date, startOfMonth),
        lte(reportEntries.date, endOfMonth)
      )
    );

  const mtdActual = mtdSum?.totalOutput || 0;
  const mtdRework = mtdSum?.totalRework || 0;
  const mtdReject = mtdSum?.totalReject || 0;
  const mtdScrap = mtdSum?.totalScrap || 0;
  const mtdWip = mtdSum?.totalWip || 0;

  // MTD Planned Target
  const monthPlans = await db
    .select()
    .from(plans)
    .where(
      and(
        inArray(plans.lineId, lineIds),
        lte(plans.startDate, endOfMonth),
        gte(plans.endDate, startOfMonth)
      )
    );

  let mtdTarget = 0;
  for (const p of monthPlans) {
    mtdTarget += p.plannedQty;
  }

  return {
    todayStr,
    todayActual,
    todayTarget,
    todayVariance: todayActual - todayTarget,
    todayRework,
    todayReject,
    todayScrap,
    todayWip,
    mtdActual,
    mtdTarget,
    mtdRework,
    mtdReject,
    mtdScrap,
    mtdWip,
    lineBreakdowns: todayEntries,
  };
}

// -------------------------------------------------------------
// QA Dashboard Data
// -------------------------------------------------------------
export async function getQADashboardData(userId: string) {
  const todayStr = new Date().toISOString().split("T")[0];

  const todayInspections = await db
    .select({
      id: qaInspections.id,
      checked: qaInspections.checked,
      defects: qaInspections.defects,
      date: qaInspections.date,
      note: qaInspections.note,
      createdAt: qaInspections.createdAt,
      productName: products.name,
      productSku: products.sku,
      lineName: lines.name,
    })
    .from(qaInspections)
    .innerJoin(products, eq(qaInspections.productId, products.id))
    .innerJoin(lines, eq(qaInspections.lineId, lines.id))
    .where(and(eq(qaInspections.createdBy, userId), eq(qaInspections.date, todayStr)))
    .orderBy(desc(qaInspections.createdAt));

  let totalChecked = 0;
  let totalDefects = 0;

  for (const insp of todayInspections) {
    totalChecked += insp.checked;
    totalDefects += insp.defects;
  }

  const defectRate =
    totalChecked > 0 ? Math.round((totalDefects / totalChecked) * 1000) / 10 : 0;

  return {
    todayStr,
    inspectionCount: todayInspections.length,
    totalChecked,
    totalDefects,
    defectRate,
    recentInspections: todayInspections,
  };
}
