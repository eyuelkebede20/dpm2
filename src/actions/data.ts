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
  specialDays,
  downtimeReasons,
} from "@/db/schema";
import { requireUser, can } from "@/lib/authz";
import { eq, and, sql, gte, lte, desc, asc } from "drizzle-orm";
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

  // Fetch report entries for this date
  const entries = await db
    .select()
    .from(reportEntries)
    .where(eq(reportEntries.date, date));

  // Fetch special day for date
  const [specialDayRecord] = await db
    .select()
    .from(specialDays)
    .where(eq(specialDays.date, date))
    .limit(1);

  // Fetch active downtime reasons ordered by sortOrder asc
  const activeDowntimeReasons = await db
    .select()
    .from(downtimeReasons)
    .where(eq(downtimeReasons.isActive, true))
    .orderBy(asc(downtimeReasons.sortOrder));

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

      const entry = entries.find(
        (e) => e.lineId === line.id && e.productId === prod.id
      );

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

      gridRows.push({
        lineId: line.id,
        lineName: line.name,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        plan: plan
          ? {
              startDate: plan.startDate,
              endDate: plan.endDate,
              plannedQty: plan.plannedQty,
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
      });
    }
  }

  return {
    date,
    factoryId,
    workingDays,
    gridRows,
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
