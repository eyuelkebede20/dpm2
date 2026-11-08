import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./index";
import {
  users,
  accounts,
  industryProfile,
  factories,
  factoryUsers,
  lines,
  products,
  lineProducts,
  qaAssignments,
  plans,
  reportEntries,
  stockLedger,
} from "./schema";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting DPM database seed...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@dpm.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "AdminPassword123!";
  const demoPassword = "AdminPassword123!";

  const hashedAdminPassword = await hashPassword(adminPassword);
  const hashedDemoPassword = await hashPassword(demoPassword);

  // 1. Industry Profile
  console.log("Setting up Industry Profile...");
  await db
    .insert(industryProfile)
    .values({
      id: "default",
      companyName: "Ethiopian Beverage & Food Industries",
      workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat, Sunday off
      units: "pcs",
    })
    .onConflictDoUpdate({
      target: industryProfile.id,
      set: {
        companyName: "Ethiopian Beverage & Food Industries",
        workingDays: [1, 2, 3, 4, 5, 6],
        units: "pcs",
      },
    });

  // 2. Users & Accounts
  const seedUsers = [
    {
      id: "usr_admin_01",
      name: "System Administrator",
      email: adminEmail,
      role: "sys_admin" as const,
      password: hashedAdminPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_om_01",
      name: "Solomon Tadesse (OM)",
      email: "om@dpm.local",
      role: "om" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_fm_01",
      name: "Abebe Kebede (FM)",
      email: "fm@dpm.local",
      role: "fm" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_qa_01",
      name: "Hanna Worku (QA)",
      email: "qa@dpm.local",
      role: "qa" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
  ];

  for (const u of seedUsers) {
    console.log(`Creating user: ${u.email} (${u.role})`);
    await db
      .insert(users)
      .values({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        active: true,
        mustChangePassword: u.mustChangePassword,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: u.name,
          role: u.role,
          active: true,
        },
      });

    await db
      .insert(accounts)
      .values({
        id: `acc_${u.id}`,
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: u.password,
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          password: u.password,
        },
      });
  }

  // 3. Factory
  const factoryId = "fac_bole_01";
  console.log("Creating Factory...");
  await db
    .insert(factories)
    .values({
      id: factoryId,
      name: "Bole Bottling & Packaging Plant",
      omId: "usr_om_01",
      active: true,
    })
    .onConflictDoNothing();

  // 4. Factory Users (FM and QA belong to Bole plant)
  console.log("Associating Factory Users...");
  await db
    .insert(factoryUsers)
    .values([
      { factoryId, userId: "usr_fm_01" },
      { factoryId, userId: "usr_qa_01" },
    ])
    .onConflictDoNothing();

  // 5. Lines
  console.log("Creating Production Lines...");
  const line1Id = "line_bole_01";
  const line2Id = "line_bole_02";
  await db
    .insert(lines)
    .values([
      { id: line1Id, factoryId, name: "Line 1 - High-Speed Bottling", active: true },
      { id: line2Id, factoryId, name: "Line 2 - Packaging & Sealing", active: true },
    ])
    .onConflictDoNothing();

  // 6. Products
  console.log("Creating Products...");
  const prod1Id = "prod_water_500";
  const prod2Id = "prod_juice_250";
  await db
    .insert(products)
    .values([
      {
        id: prod1Id,
        factoryId,
        name: "Highland Pure Spring Water 500ml",
        sku: "WAT-500",
        active: true,
      },
      {
        id: prod2Id,
        factoryId,
        name: "Abyssinia Mango Nectar 250ml",
        sku: "JUC-250",
        active: true,
      },
    ])
    .onConflictDoNothing();

  // 7. Line Products
  await db
    .insert(lineProducts)
    .values([
      { lineId: line1Id, productId: prod1Id },
      { lineId: line2Id, productId: prod2Id },
    ])
    .onConflictDoNothing();

  // 8. QA Assignments (Hanna assigned to both products)
  await db
    .insert(qaAssignments)
    .values([
      { qaUserId: "usr_qa_01", productId: prod1Id },
      { qaUserId: "usr_qa_01", productId: prod2Id },
    ])
    .onConflictDoNothing();

  // 9. Monthly Production Plans (November 2026: 25 working days)
  console.log("Creating Production Plans...");
  const plan1Id = "plan_nov_water_01";
  const plan2Id = "plan_nov_juice_01";
  await db
    .insert(plans)
    .values([
      {
        id: plan1Id,
        lineId: line1Id,
        productId: prod1Id,
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 25000, // 1000 pcs / day target
      },
      {
        id: plan2Id,
        lineId: line2Id,
        productId: prod2Id,
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 12500, // 500 pcs / day target
      },
    ])
    .onConflictDoNothing();

  // 10. Sample Daily Report Entries & Stock Ledger Entries
  console.log("Creating Historical Daily Entries & Stock Ledger...");
  const sampleEntries = [
    {
      date: "2026-11-02",
      lineId: line1Id,
      productId: prod1Id,
      finishedGood: 1020, // +20 vs 1000
      rework: 15,
      reject: 5,
      scrap: 2,
      wip: 60,
      downtimeMinutes: 10,
      issueNote: "Minor conveyor calibration in the morning",
    },
    {
      date: "2026-11-02",
      lineId: line2Id,
      productId: prod2Id,
      finishedGood: 510, // +10 vs 500
      rework: 8,
      reject: 3,
      scrap: 1,
      wip: 30,
      downtimeMinutes: 0,
      issueNote: null,
    },
    {
      date: "2026-11-03",
      lineId: line1Id,
      productId: prod1Id,
      finishedGood: 980, // -20 vs 1000
      rework: 25,
      reject: 12,
      scrap: 4,
      wip: 85,
      downtimeMinutes: 45,
      issueNote: "Capper head jammed during shift 1",
    },
    {
      date: "2026-11-03",
      lineId: line2Id,
      productId: prod2Id,
      finishedGood: 490, // -10 vs 500
      rework: 10,
      reject: 4,
      scrap: 2,
      wip: 25,
      downtimeMinutes: 20,
      issueNote: "Label roll replacement delay",
    },
    {
      date: "2026-11-04",
      lineId: line1Id,
      productId: prod1Id,
      finishedGood: 1015, // +15 vs 1000
      rework: 10,
      reject: 3,
      scrap: 1,
      wip: 50,
      downtimeMinutes: 0,
      issueNote: "Smooth run across all shifts",
    },
    {
      date: "2026-11-04",
      lineId: line2Id,
      productId: prod2Id,
      finishedGood: 505, // +5 vs 500
      rework: 5,
      reject: 2,
      scrap: 0,
      wip: 20,
      downtimeMinutes: 0,
      issueNote: null,
    },
    {
      date: "2026-11-05",
      lineId: line1Id,
      productId: prod1Id,
      finishedGood: 1050, // +50 vs 1000
      rework: 8,
      reject: 2,
      scrap: 1,
      wip: 55,
      downtimeMinutes: 0,
      issueNote: "Great efficiency by shift 2",
    },
    {
      date: "2026-11-05",
      lineId: line2Id,
      productId: prod2Id,
      finishedGood: 520, // +20 vs 500
      rework: 4,
      reject: 1,
      scrap: 0,
      wip: 22,
      downtimeMinutes: 0,
      issueNote: null,
    },
    {
      date: "2026-11-06",
      lineId: line1Id,
      productId: prod1Id,
      finishedGood: 990, // -10 vs 1000
      rework: 18,
      reject: 8,
      scrap: 3,
      wip: 70,
      downtimeMinutes: 30,
      issueNote: "Steam pressure drop in preform molding",
    },
    {
      date: "2026-11-06",
      lineId: line2Id,
      productId: prod2Id,
      finishedGood: 495, // -5 vs 500
      rework: 7,
      reject: 3,
      scrap: 1,
      wip: 18,
      downtimeMinutes: 15,
      issueNote: "Carton printer ink reset",
    },
    {
      date: "2026-11-07",
      lineId: line1Id,
      productId: prod1Id,
      finishedGood: 1030, // +30 vs 1000
      rework: 12,
      reject: 4,
      scrap: 2,
      wip: 45,
      downtimeMinutes: 0,
      issueNote: "Weekend shift reached target early",
    },
    {
      date: "2026-11-07",
      lineId: line2Id,
      productId: prod2Id,
      finishedGood: 512, // +12 vs 500
      rework: 6,
      reject: 2,
      scrap: 1,
      wip: 25,
      downtimeMinutes: 0,
      issueNote: null,
    },
  ];

  for (const entry of sampleEntries) {
    const entryId = `rep_${entry.date}_${entry.lineId}_${entry.productId}`;
    await db
      .insert(reportEntries)
      .values({
        id: entryId,
        date: entry.date,
        lineId: entry.lineId,
        productId: entry.productId,
        finishedGood: entry.finishedGood,
        rework: entry.rework,
        reject: entry.reject,
        scrap: entry.scrap,
        wip: entry.wip,
        downtimeMinutes: entry.downtimeMinutes,
        issueNote: entry.issueNote,
        updatedBy: "usr_fm_01",
      })
      .onConflictDoNothing();

    // Check if stock ledger entry exists
    const [existingLedger] = await db
      .select()
      .from(stockLedger)
      .where(eq(stockLedger.reportEntryId, entryId))
      .limit(1);

    if (!existingLedger) {
      await db.insert(stockLedger).values({
        id: `stk_${entryId}`,
        factoryId,
        productId: entry.productId,
        delta: entry.finishedGood,
        reportEntryId: entryId,
      });
    }
  }

  console.log("✅ DPM database seed complete!");
  console.log("\nCredentials to log in:");
  console.log(`- Sys Admin : ${adminEmail} / ${adminPassword}`);
  console.log(`- OM        : om@dpm.local / ${demoPassword}`);
  console.log(`- FM        : fm@dpm.local / ${demoPassword}`);
  console.log(`- QA        : qa@dpm.local / ${demoPassword}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
