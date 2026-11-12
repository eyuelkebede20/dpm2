import * as dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";
import {
  users,
  sessions,
  accounts,
  verifications,
  industryProfile,
  factories,
  factoryUsers,
  lines,
  products,
  lineProducts,
  qaAssignments,
  plans,
  reportEntries,
  qaInspections,
  qaApprovals,
  stockLedger,
  dailyReportReviews,
  notifications,
  specialDays,
  downtimeReasons,
  serverEndpoints,
} from "./schema";
import { getEthiopianHolidaysForYear } from "../lib/ethiopian-holidays";
import { hashPassword } from "better-auth/crypto";

export async function ensureSchema() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    try {
      console.log("0. Verifying database schema migrations...");
      await migrate(db as any, { migrationsFolder });
      console.log("   ✓ Database schema verified and up to date.");
    } catch (err: any) {
      console.warn("   ⚠️ Schema migration check note:", err.message);
    }
  }
}

async function safeDelete(table: any, tableName: string) {
  try {
    await db.delete(table);
  } catch (err: any) {
    if (err.message && (err.message.includes("does not exist") || err.code === "42P01")) {
      console.log(`   - Table ${tableName} does not exist yet (skipping wipe).`);
      return;
    }
    throw err;
  }
}

export async function seedDatabase(options: { reset?: boolean } = { reset: true }) {
  console.log("======================================================");
  console.log("🌱 RESETTING & SEEDING DPM2 WITH HOMICHO DEFENSE DATA");
  console.log("======================================================");

  // 0. Ensure all schema tables exist before executing operations
  await ensureSchema();

  // 1. Clean all existing operational and catalog data if reset requested
  if (options.reset !== false) {
    console.log("1. Clearing existing operational, reporting, and catalog data...");
    await safeDelete(notifications, "notifications");
    await safeDelete(dailyReportReviews, "daily_report_reviews");
    await safeDelete(qaApprovals, "qa_approvals");
    await safeDelete(stockLedger, "stock_ledger");
    await safeDelete(qaInspections, "qa_inspections");
    await safeDelete(reportEntries, "report_entries");
    await safeDelete(plans, "plans");
    await safeDelete(qaAssignments, "qa_assignments");
    await safeDelete(lineProducts, "line_products");
    await safeDelete(products, "products");
    await safeDelete(lines, "lines");
    await safeDelete(factoryUsers, "factory_users");
    await safeDelete(factories, "factories");
    await safeDelete(sessions, "sessions");
    await safeDelete(accounts, "accounts");
    await safeDelete(users, "users");
    await safeDelete(verifications, "verifications");
    await safeDelete(specialDays, "special_days");
    await safeDelete(downtimeReasons, "downtime_reasons");
    await safeDelete(industryProfile, "industry_profile");
    await safeDelete(serverEndpoints, "server_endpoints");
    console.log("   ✓ All existing and added database records wiped cleanly.");
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@dpm.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "AdminPassword123!";
  const demoPassword = "AdminPassword123!";

  const hashedAdminPassword = await hashPassword(adminPassword);
  const hashedDemoPassword = await hashPassword(demoPassword);

  // 1. Industry Profile - Homicho Ammunition Engineering Industry (HAEI)
  console.log("2. Setting up Industry Profile (HAEI Munitions Complex)...");
  await db.insert(industryProfile).values({
    id: "default",
    companyName: "Homicho Ammunition Engineering Industry",
    workingDays: [1, 2, 3, 4, 5, 6], // Monday through Saturday, Sunday off
    units: "pcs",
    calendarSystem: "ethiopian",
  });

  // 1b. Backend Server Endpoints & Network Presets (Factory LAN vs Cloud)
  console.log("2b. Seeding Standard Server Endpoints (LAN / Internet / Localhost)...");
  const defaultServerEndpoints = [
    {
      id: "srv_lan_factory",
      name: "Main Plant Factory LAN",
      url: "http://192.168.1.100:3000",
      description: "On-premises high-speed factory local area network server",
      environment: "lan",
      isDefault: true,
      isActive: true,
      createdBy: "usr_admin",
    },
    {
      id: "srv_hq_cloud",
      name: "Homicho HQ Internet Cloud",
      url: "https://dpm.homicho.et",
      description: "Central cloud server accessible over public internet and mobile data",
      environment: "cloud",
      isDefault: false,
      isActive: true,
      createdBy: "usr_admin",
    },
    {
      id: "srv_localhost",
      name: "Localhost Edge / Developer",
      url: "http://localhost:3000",
      description: "Local development gateway running on localhost",
      environment: "local",
      isDefault: false,
      isActive: true,
      createdBy: "usr_admin",
    },
  ];
  for (const srv of defaultServerEndpoints) {
    await db.insert(serverEndpoints).values(srv);
  }

  // 2. Standard Defense Munition Downtime Reasons (DOW-01 through DOW-09)
  console.log("3. Seeding Standard Defense Downtime Reasons (DOW-01 .. DOW-09)...");
  const standardDowntimeReasons = [
    {
      id: "dow_01",
      code: "DOW-01",
      nameEn: "Punch / Die Tool Wear or Breakage",
      nameAm: "የፐንች ወይም ዳይ መሰበር / መሸርሸር",
      category: "tooling",
      isActive: true,
      sortOrder: 1,
    },
    {
      id: "dow_02",
      code: "DOW-02",
      nameEn: "CNC Control / Scale & Sensor Fault",
      nameAm: "የሲኤንሲ ኮንትሮል ወይም ሴንሰር ብልሽት",
      category: "machine",
      isActive: true,
      sortOrder: 2,
    },
    {
      id: "dow_03",
      code: "DOW-03",
      nameEn: "Tooling & Caliber Changeover",
      nameAm: "የካሊበር እና የመሳሪያ ቅያሬ",
      category: "tooling",
      isActive: true,
      sortOrder: 3,
    },
    {
      id: "dow_04",
      code: "DOW-04",
      nameEn: "Brass Strip / Steel / Powder Shortage",
      nameAm: "የናስ/የብረት ቆርቆሮ ወይም የባሩድ እጥረት",
      category: "material",
      isActive: true,
      sortOrder: 4,
    },
    {
      id: "dow_05",
      code: "DOW-05",
      nameEn: "Ballistic Test & Chamber Verification",
      nameAm: "የባለስቲክስ ተኩስ ፍተሻ እና ልኬት ማረጋገጫ",
      category: "quality",
      isActive: true,
      sortOrder: 5,
    },
    {
      id: "dow_06",
      code: "DOW-06",
      nameEn: "Chemical & Pyrotechnic Safety Clearance",
      nameAm: "የኬሚካልና ፓይሮቴክኒክ ደህንነት ፍተሻ",
      category: "safety",
      isActive: true,
      sortOrder: 6,
    },
    {
      id: "dow_07",
      code: "DOW-07",
      nameEn: "Preventive Press Maintenance & Lubrication",
      nameAm: "የታቀደ የፕሬስ ጥገና እና ቅባት መቀባት",
      category: "machine",
      isActive: true,
      sortOrder: 7,
    },
    {
      id: "dow_08",
      code: "DOW-08",
      nameEn: "Power Cut / Generator Transition",
      nameAm: "የኃይል መቆራረጥ",
      category: "power",
      isActive: true,
      sortOrder: 8,
    },
    {
      id: "dow_09",
      code: "DOW-09",
      nameEn: "Machine Breakdown",
      nameAm: "የማሽን ብልሽት",
      category: "machine",
      isActive: true,
      sortOrder: 9,
    },
  ];

  for (const reason of standardDowntimeReasons) {
    await db.insert(downtimeReasons).values(reason);
  }

  // 3. Special Days & Ethiopian Holidays (2026 and 2027)
  console.log("4. Seeding Ethiopian Holidays for 2026 and 2027...");
  const holidays2026 = getEthiopianHolidaysForYear(2026);
  const holidays2027 = getEthiopianHolidaysForYear(2027);
  const allHolidays = [...holidays2026, ...holidays2027];

  for (const holiday of allHolidays) {
    await db.insert(specialDays).values({
      id: `hol_${holiday.date}`,
      date: holiday.date,
      nameEn: holiday.nameEn,
      nameAm: holiday.nameAm,
      type: holiday.type,
      isWorkingDay: holiday.isWorkingDay,
      year: holiday.year,
    });
  }

  // 4. Users & Better Auth Accounts
  // Roles in DPM2: sys_admin, om, fm, qa.
  // Legacy 'stock' role from DPM is mapped away as per instructions.
  console.log("5. Creating Core Leadership & Plant Managers...");
  const seedUsers = [
    {
      id: "usr_admin",
      name: "Col. Kebede Worku (Sys Admin)",
      email: adminEmail,
      role: "sys_admin" as const,
      password: hashedAdminPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_om",
      name: "Mr. Mihretab Guramela (Operations Directorate Manager)",
      email: "om@dpm.local",
      role: "om" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_fm_sac",
      name: "Sisay Milkessa (Small Arm Factory Manager)",
      email: "fm@dpm.local", // Primary FM demo login
      role: "fm" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_fm_mac",
      name: "Eliyas Bekele (Medium Arm Factory Manager)",
      email: "fm_mac@dpm.local",
      role: "fm" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_fm_hwc",
      name: "Maru Tessema (Heavy Weapon Factory Manager)",
      email: "fm_hwc@dpm.local",
      role: "fm" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_fm_chem",
      name: "Getenet Sahelu (Chemical Charging Shop Manager)",
      email: "fm_chem@dpm.local",
      role: "fm" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_fm_tool",
      name: "Solomon Geleta (Tool & Auxiliary Shop Manager)",
      email: "fm_tool@dpm.local",
      role: "fm" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
    {
      id: "usr_qa_01",
      name: "Capt. Tigist Haile (QA Directorate Inspector)",
      email: "qa@dpm.local",
      role: "qa" as const,
      password: hashedDemoPassword,
      mustChangePassword: false,
    },
  ];

  for (const u of seedUsers) {
    console.log(`   - [${u.role.toUpperCase()}] ${u.name} <${u.email}>`);
    await db.insert(users).values({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: true,
      role: u.role,
      active: true,
      mustChangePassword: u.mustChangePassword,
    });

    await db.insert(accounts).values({
      id: `acc_${u.id}`,
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: u.password,
    });
  }

  // 5. 5 Munitions Factories (From DPM HAEI Complex)
  console.log("6. Creating 5 Munitions Plants...");
  const factoryRecords = [
    {
      id: "fac_sac",
      name: "Small Arm Factory (SAF)",
      omId: "usr_om",
      active: true,
    },
    {
      id: "fac_mac",
      name: "Medium Arm Factory (MAF)",
      omId: "usr_om",
      active: true,
    },
    {
      id: "fac_hwc",
      name: "Heavy Weapon Factory (HWF)",
      omId: "usr_om",
      active: true,
    },
    {
      id: "fac_chem",
      name: "Chemical Charging Shop (CCS)",
      omId: "usr_om",
      active: true,
    },
    {
      id: "fac_tool",
      name: "Tool and Auxiliary Shop (TAS)",
      omId: "usr_om",
      active: true,
    },
  ];

  for (const fac of factoryRecords) {
    console.log(`   - Plant: ${fac.name} (${fac.id})`);
    await db.insert(factories).values(fac);
  }

  // 6. Factory Users Mapping
  console.log("7. Mapping Factory Managers and QA Inspector to Plants...");
  const factoryUserMappings = [
    { factoryId: "fac_sac", userId: "usr_fm_sac" },
    { factoryId: "fac_mac", userId: "usr_fm_mac" },
    { factoryId: "fac_hwc", userId: "usr_fm_hwc" },
    { factoryId: "fac_chem", userId: "usr_fm_chem" },
    { factoryId: "fac_tool", userId: "usr_fm_tool" },
    // QA Inspector inspects all 5 factories
    { factoryId: "fac_sac", userId: "usr_qa_01" },
    { factoryId: "fac_mac", userId: "usr_qa_01" },
    { factoryId: "fac_hwc", userId: "usr_qa_01" },
    { factoryId: "fac_chem", userId: "usr_qa_01" },
    { factoryId: "fac_tool", userId: "usr_qa_01" },
  ];

  await db.insert(factoryUsers).values(factoryUserMappings);

  // 7. Production Lines
  console.log("8. Creating Production Lines for Each Munitions Workshop...");
  const linesRecords = [
    // SAF (fac_sac)
    { id: "line_saf_39_01", factoryId: "fac_sac", name: "SAF-39-L01: 39mm Cartridge Line", active: true },
    { id: "line_saf_39_02", factoryId: "fac_sac", name: "SAF-39-L02: 39mm Bullet Line", active: true },
    { id: "line_saf_39_03", factoryId: "fac_sac", name: "SAF-39-L03: 39mm Final Assembly", active: true },
    { id: "line_saf_54_01", factoryId: "fac_sac", name: "SAF-54-L01: 54mm Cartridge Line", active: true },
    { id: "line_saf_54_02", factoryId: "fac_sac", name: "SAF-54-L02: 54mm Bullet Line", active: true },
    { id: "line_saf_54_03", factoryId: "fac_sac", name: "SAF-54-L03: 54mm Final Assembly", active: true },
    // MAF (fac_mac)
    { id: "line_maf_127_01", factoryId: "fac_mac", name: "MAF-127-L01: 12.7mm Cartridge Line", active: true },
    { id: "line_maf_127_02", factoryId: "fac_mac", name: "MAF-127-L02: 12.7mm Steel Core Line", active: true },
    { id: "line_maf_127_03", factoryId: "fac_mac", name: "MAF-127-L03: 12.7mm Final Assembly", active: true },
    // HWF (fac_hwc)
    { id: "line_hwf_01", factoryId: "fac_hwc", name: "HWF-L01: 100mm/122mm Machining Line", active: true },
    { id: "line_hwf_02", factoryId: "fac_hwc", name: "HWF-L02: 82mm/60mm Mortar Line", active: true },
    // CCS (fac_chem)
    { id: "line_ccs_01", factoryId: "fac_chem", name: "CCS-L01: Warhead Melt-Cast Filling Bay", active: true },
    { id: "line_ccs_02", factoryId: "fac_chem", name: "CCS-L02: Propellant Charging & Sealing", active: true },
    // TAS (fac_tool)
    { id: "line_tas_01", factoryId: "fac_tool", name: "TAS-L01: CNC Punch & Die Toolmaking", active: true },
    { id: "line_tas_02", factoryId: "fac_tool", name: "TAS-L02: Die Heat Treatment & Calibration", active: true },
  ];

  for (const line of linesRecords) {
    await db.insert(lines).values(line);
  }

  // 8. Munitions Products Catalog
  console.log("9. Creating Munitions Products Catalog...");
  const productsRecords = [
    // SAF Products
    { id: "prod_sap_39_cr", factoryId: "fac_sac", name: "39mm Cartridge Case (7.62x39)", sku: "SAP-39-CR", active: true },
    { id: "prod_sap_39_bl", factoryId: "fac_sac", name: "39mm Bullet Core & Jacket", sku: "SAP-39-BL", active: true },
    { id: "prod_sap_39_asm", factoryId: "fac_sac", name: "7.62x39mm Final Round", sku: "SAP-39-ASM", active: true },
    { id: "prod_sap_54_cr", factoryId: "fac_sac", name: "54mm Rimmed Case (7.62x54R)", sku: "SAP-54-CR", active: true },
    { id: "prod_sap_54_asm", factoryId: "fac_sac", name: "7.62x54mmR PKM Final Round", sku: "SAP-54-ASM", active: true },
    // MAF Products
    { id: "prod_map_127_cr", factoryId: "fac_mac", name: "12.7mm Cartridge Case", sku: "MAP-127-CR", active: true },
    { id: "prod_map_127_sc", factoryId: "fac_mac", name: "12.7mm Armor-Piercing Core", sku: "MAP-127-SC", active: true },
    { id: "prod_map_127_asm", factoryId: "fac_mac", name: "12.7x108mm DShK Heavy Round", sku: "MAP-127-ASM", active: true },
    // HWF Products
    { id: "prod_hwp_122_wh", factoryId: "fac_hwc", name: "122mm Howitzer Shell Body", sku: "HWP-122-WH", active: true },
    { id: "prod_hwp_82_mb", factoryId: "fac_hwc", name: "82mm Mortar Bomb Machined", sku: "HWP-82-MB", active: true },
    // CCS Products
    { id: "prod_ccs_122_whc", factoryId: "fac_chem", name: "122mm Warhead TNT Melt Charge", sku: "CCS-122-WHC", active: true },
    // TAS Products
    { id: "prod_tas_dd_punch", factoryId: "fac_tool", name: "Tungsten Carbide Drawing Punch", sku: "TAS-DD-PUNCH", active: true },
  ];

  for (const prod of productsRecords) {
    await db.insert(products).values(prod);
  }

  // 9. Line Products Mapping
  console.log("10. Linking Lines to Products...");
  const lineProductsRecords = [
    { lineId: "line_saf_39_01", productId: "prod_sap_39_cr" },
    { lineId: "line_saf_39_02", productId: "prod_sap_39_bl" },
    { lineId: "line_saf_39_03", productId: "prod_sap_39_asm" },
    { lineId: "line_saf_54_01", productId: "prod_sap_54_cr" },
    { lineId: "line_saf_54_03", productId: "prod_sap_54_asm" },
    { lineId: "line_maf_127_01", productId: "prod_map_127_cr" },
    { lineId: "line_maf_127_02", productId: "prod_map_127_sc" },
    { lineId: "line_maf_127_03", productId: "prod_map_127_asm" },
    { lineId: "line_hwf_01", productId: "prod_hwp_122_wh" },
    { lineId: "line_hwf_02", productId: "prod_hwp_82_mb" },
    { lineId: "line_ccs_01", productId: "prod_ccs_122_whc" },
    { lineId: "line_tas_01", productId: "prod_tas_dd_punch" },
  ];

  await db.insert(lineProducts).values(lineProductsRecords);

  // 10. QA Product Assignment Matrix
  console.log("11. Assigning QA Inspector Matrix Across All Munitions Products...");
  const qaAssignmentRecords = productsRecords.map((p) => ({
    qaUserId: "usr_qa_01",
    productId: p.id,
  }));

  await db.insert(qaAssignments).values(qaAssignmentRecords);

  // 11. Monthly Production Plans (November 2026: 25 Working Days)
  console.log("12. Creating Baseline Production Plans for November 2026...");
  const samplePlans = [
    {
      id: "plan_saf_39_asm_nov26",
      lineId: "line_saf_39_03",
      productId: "prod_sap_39_asm",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 375000, // 15,000 / day target
      initialPlannedQty: 375000,
    },
    {
      id: "plan_saf_39_cr_nov26",
      lineId: "line_saf_39_01",
      productId: "prod_sap_39_cr",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 400000, // 16,000 / day target
      initialPlannedQty: 400000,
    },
    {
      id: "plan_saf_54_asm_nov26",
      lineId: "line_saf_54_03",
      productId: "prod_sap_54_asm",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 125000, // 5,000 / day target
      initialPlannedQty: 125000,
    },
    {
      id: "plan_maf_127_asm_nov26",
      lineId: "line_maf_127_03",
      productId: "prod_map_127_asm",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 100000, // 4,000 / day target
      initialPlannedQty: 100000,
    },
    {
      id: "plan_maf_127_cr_nov26",
      lineId: "line_maf_127_01",
      productId: "prod_map_127_cr",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 125000, // 5,000 / day target
      initialPlannedQty: 125000,
    },
    {
      id: "plan_hwf_122_wh_nov26",
      lineId: "line_hwf_01",
      productId: "prod_hwp_122_wh",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 25000, // 1,000 / day target
      initialPlannedQty: 25000,
    },
    {
      id: "plan_hwf_82_mb_nov26",
      lineId: "line_hwf_02",
      productId: "prod_hwp_82_mb",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 37500, // 1,500 / day target
      initialPlannedQty: 37500,
    },
    {
      id: "plan_ccs_122_whc_nov26",
      lineId: "line_ccs_01",
      productId: "prod_ccs_122_whc",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 20000,
      initialPlannedQty: 20000,
    },
    {
      id: "plan_tas_dd_punch_nov26",
      lineId: "line_tas_01",
      productId: "prod_tas_dd_punch",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 5000,
      initialPlannedQty: 5000,
    },
  ];

  for (const pl of samplePlans) {
    await db.insert(plans).values(pl);
  }

  // 12. Sample Daily Production Reports & Stock Output
  console.log("13. Seeding Realistic Daily Production Report Entries & Stock Output...");
  const sampleEntries = [
    {
      date: "2026-11-02",
      factoryId: "fac_sac",
      lineId: "line_saf_39_03",
      productId: "prod_sap_39_asm",
      finishedGood: 15200,
      rework: 80,
      reject: 35,
      scrap: 12,
      wip: 450,
      downtimeMinutes: 90,
      downtimeReasonId: "dow_01",
      issueNote: "Replaced tungsten cupping punch on Line 03. Shift 1 & 2 operated at optimal hydraulic press pressure. Batch cleared ballistic testing.",
      updatedBy: "usr_fm_sac",
    },
    {
      date: "2026-11-02",
      factoryId: "fac_mac",
      lineId: "line_maf_127_03",
      productId: "prod_map_127_asm",
      finishedGood: 4100,
      rework: 15,
      reject: 8,
      scrap: 3,
      wip: 120,
      downtimeMinutes: 48,
      downtimeReasonId: "dow_05",
      issueNote: "Ballistic chronograph tolerance calibration. 12.7mm steel cores hardened successfully.",
      updatedBy: "usr_fm_mac",
    },
    {
      date: "2026-11-03",
      factoryId: "fac_sac",
      lineId: "line_saf_39_03",
      productId: "prod_sap_39_asm",
      finishedGood: 14900,
      rework: 110,
      reject: 40,
      scrap: 18,
      wip: 520,
      downtimeMinutes: 45,
      downtimeReasonId: "dow_03",
      issueNote: "Tooling caliber changeover inspection passed QA spot-checks.",
      updatedBy: "usr_fm_sac",
    },
    {
      date: "2026-11-03",
      factoryId: "fac_mac",
      lineId: "line_maf_127_03",
      productId: "prod_map_127_asm",
      finishedGood: 3950,
      rework: 25,
      reject: 12,
      scrap: 5,
      wip: 180,
      downtimeMinutes: 30,
      downtimeReasonId: "dow_04",
      issueNote: "Slight delay awaiting raw brass strip delivery from central store.",
      updatedBy: "usr_fm_mac",
    },
    {
      date: "2026-11-04",
      factoryId: "fac_sac",
      lineId: "line_saf_39_03",
      productId: "prod_sap_39_asm",
      finishedGood: 15400,
      rework: 60,
      reject: 20,
      scrap: 8,
      wip: 390,
      downtimeMinutes: 0,
      downtimeReasonId: null,
      issueNote: "High efficiency across both day and night shifts. Zero chamber misfires.",
      updatedBy: "usr_fm_sac",
    },
    {
      date: "2026-11-04",
      factoryId: "fac_mac",
      lineId: "line_maf_127_03",
      productId: "prod_map_127_asm",
      finishedGood: 4080,
      rework: 12,
      reject: 6,
      scrap: 2,
      wip: 110,
      downtimeMinutes: 0,
      downtimeReasonId: null,
      issueNote: "Heavy caliber production steady with optimal casing concentricity.",
      updatedBy: "usr_fm_mac",
    },
    {
      date: "2026-11-05",
      factoryId: "fac_sac",
      lineId: "line_saf_39_03",
      productId: "prod_sap_39_asm",
      finishedGood: 15300,
      rework: 70,
      reject: 25,
      scrap: 10,
      wip: 410,
      downtimeMinutes: 20,
      downtimeReasonId: "dow_02",
      issueNote: "Electronic load-cell sensor recalibrated on assembly primer feed.",
      updatedBy: "usr_fm_sac",
    },
    {
      date: "2026-11-05",
      factoryId: "fac_mac",
      lineId: "line_maf_127_03",
      productId: "prod_map_127_asm",
      finishedGood: 4120,
      rework: 10,
      reject: 5,
      scrap: 2,
      wip: 95,
      downtimeMinutes: 0,
      downtimeReasonId: null,
      issueNote: "Excellent assembly tolerances under ballistic speed gates.",
      updatedBy: "usr_fm_mac",
    },
  ];

  for (const entry of sampleEntries) {
    const entryId = `rep_${entry.date}_${entry.lineId}_${entry.productId}`;
    await db.insert(reportEntries).values({
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
      downtimeReasonId: entry.downtimeReasonId,
      issueNote: entry.issueNote,
      updatedBy: entry.updatedBy,
    });

    // QA Approval
    await db.insert(qaApprovals).values({
      id: `appr_${entryId}`,
      reportEntryId: entryId,
      status: "approved",
      note: "Ballistic test and visual dimensional inspection verified by QA.",
      qaUserId: "usr_qa_01",
    });

    // Stock Ledger
    await db.insert(stockLedger).values({
      id: `stk_${entryId}`,
      factoryId: entry.factoryId,
      productId: entry.productId,
      delta: entry.finishedGood,
      reportEntryId: entryId,
    });
  }

  console.log("======================================================");
  console.log("✅ DPM2 SEED COMPLETE (HOMICHO DEFENSE DATASET)");
  console.log("======================================================");
  console.log("Authoritative User Accounts & Passwords:");
  console.log(`• Sys Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`• OM       : om@dpm.local / ${demoPassword}`);
  console.log(`• FM (SAF) : fm@dpm.local / ${demoPassword}`);
  console.log(`• FM (MAF) : fm_mac@dpm.local / ${demoPassword}`);
  console.log(`• FM (HWF) : fm_hwc@dpm.local / ${demoPassword}`);
  console.log(`• FM (CCS) : fm_chem@dpm.local / ${demoPassword}`);
  console.log(`• FM (TAS) : fm_tool@dpm.local / ${demoPassword}`);
  console.log(`• QA       : qa@dpm.local / ${demoPassword}`);
  console.log("======================================================");

  return {
    success: true,
    message: "DPM2 Seed complete (Homicho Munitions Complex dataset)",
    users: [
      { role: "sys_admin", name: "Col. Kebede Worku (Sys Admin)", email: adminEmail, password: adminPassword },
      { role: "om", name: "Mr. Mihretab Guramela (Operations Directorate Manager)", email: "om@dpm.local", password: demoPassword },
      { role: "fm", name: "Sisay Milkessa (Small Arm Factory Manager)", email: "fm@dpm.local", password: demoPassword },
      { role: "fm", name: "Eliyas Bekele (Medium Arm Factory Manager)", email: "fm_mac@dpm.local", password: demoPassword },
      { role: "fm", name: "Maru Tessema (Heavy Weapon Factory Manager)", email: "fm_hwc@dpm.local", password: demoPassword },
      { role: "fm", name: "Getenet Sahelu (Chemical Charging Shop Manager)", email: "fm_chem@dpm.local", password: demoPassword },
      { role: "fm", name: "Solomon Geleta (Tool & Auxiliary Shop Manager)", email: "fm_tool@dpm.local", password: demoPassword },
      { role: "qa", name: "Capt. Tigist Haile (QA Directorate Inspector)", email: "qa@dpm.local", password: demoPassword },
    ],
    factories: factoryRecords.length,
    lines: linesRecords.length,
    products: productsRecords.length,
    plans: samplePlans.length,
    servers: defaultServerEndpoints.length,
  };
}

if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js") ||
  process.argv[1]?.endsWith("seed.mjs")
) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    });
}
