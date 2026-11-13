import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const { Pool } = pg;

export async function runSeed(clientOrPool, options = { reset: false }) {
  console.log("======================================================");
  console.log("🌱 SEEDING DPM2 DATABASE (HOMICO DEFENSE DATASET)");
  console.log("======================================================");

  let client = clientOrPool;
  let shouldRelease = false;

  if (clientOrPool instanceof Pool) {
    client = await clientOrPool.connect();
    shouldRelease = true;
  }

  try {
    if (options.reset) {
      console.log("1. Wiping existing operational and user data...");
      const tables = [
        "notifications",
        "daily_report_reviews",
        "qa_approvals",
        "stock_ledger",
        "qa_inspections",
        "report_entries",
        "plans",
        "qa_assignments",
        "line_products",
        "products",
        "lines",
        "factory_users",
        "factories",
        "server_endpoints",
        "sessions",
        "accounts",
        "users",
        "verifications",
        "special_days",
        "downtime_reasons",
        "industry_profile",
      ];
      for (const t of tables) {
        try {
          await client.query(`DELETE FROM "${t}";`);
        } catch (e) {
          // Ignore if table does not exist yet
        }
      }
      console.log("   ✓ Tables wiped.");
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@dpm.local";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "AdminPassword123!";
    const demoPassword = "AdminPassword123!";

    const hashedAdminPassword = await hashPassword(adminPassword);
    const hashedDemoPassword = await hashPassword(demoPassword);

    // 1. Industry Profile
    console.log("2. Setting up Industry Profile (HAEI Munitions Complex)...");
    await client.query(`
      INSERT INTO "industry_profile" ("id", "company_name", "working_days", "units", "calendar_system")
      VALUES ('default', 'Homicho Ammunition Engineering Industry', '[1,2,3,4,5,6]', 'pcs', 'ethiopian')
      ON CONFLICT ("id") DO UPDATE SET
        "company_name" = EXCLUDED."company_name",
        "working_days" = EXCLUDED."working_days",
        "units" = EXCLUDED."units",
        "calendar_system" = EXCLUDED."calendar_system";
    `);

    // 2. Standard Downtime Reasons (DOW-01 through DOW-09)
    console.log("3. Seeding Standard Defense Downtime Reasons (DOW-01 .. DOW-09)...");
    const reasons = [
      { id: "dow_01", code: "DOW-01", nameEn: "Punch / Die Tool Wear or Breakage", nameAm: "የፐንች ወይም ዳይ መሰበር / መሸርሸር", category: "tooling", sortOrder: 1 },
      { id: "dow_02", code: "DOW-02", nameEn: "CNC Control / Scale & Sensor Fault", nameAm: "የሲኤንሲ ኮንትሮል ወይም ሴንሰር ብልሽት", category: "machine", sortOrder: 2 },
      { id: "dow_03", code: "DOW-03", nameEn: "Tooling & Caliber Changeover", nameAm: "የካሊበር እና የመሳሪያ ቅያሬ", category: "tooling", sortOrder: 3 },
      { id: "dow_04", code: "DOW-04", nameEn: "Brass Strip / Steel / Powder Shortage", nameAm: "የናስ/የብረት ቆርቆሮ ወይም የባሩድ እጥረት", category: "material", sortOrder: 4 },
      { id: "dow_05", code: "DOW-05", nameEn: "Ballistic Test & Chamber Verification", nameAm: "የባለስቲክስ ተኩስ ፍተሻ እና ልኬት ማረጋገጫ", category: "quality", sortOrder: 5 },
      { id: "dow_06", code: "DOW-06", nameEn: "Chemical & Pyrotechnic Safety Clearance", nameAm: "የኬሚካልና ፓይሮቴክኒክ ደህንነት ፍተሻ", category: "safety", sortOrder: 6 },
      { id: "dow_07", code: "DOW-07", nameEn: "Preventive Press Maintenance & Lubrication", nameAm: "የታቀደ የፕሬስ ጥገና እና ቅባት መቀባት", category: "machine", sortOrder: 7 },
      { id: "dow_08", code: "DOW-08", nameEn: "Power Cut / Generator Transition", nameAm: "የኃይል መቆራረጥ", category: "power", sortOrder: 8 },
      { id: "dow_09", code: "DOW-09", nameEn: "Machine Breakdown", nameAm: "የማሽን ብልሽት", category: "machine", sortOrder: 9 },
    ];
    for (const r of reasons) {
      await client.query(`
        INSERT INTO "downtime_reasons" ("id", "code", "name_en", "name_am", "category", "is_active", "sort_order")
        VALUES ($1, $2, $3, $4, $5, true, $6)
        ON CONFLICT ("id") DO NOTHING;
      `, [r.id, r.code, r.nameEn, r.nameAm, r.category, r.sortOrder]);
    }

    // 3. Ethiopian Holidays (2026 & 2027)
    console.log("4. Seeding Ethiopian Holidays for 2026 and 2027...");
    const holidays = [
      // 2026
      { id: "hol_2026-01-07", date: "2026-01-07", nameEn: "Ethiopian Christmas (Genna)", nameAm: "ገና", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-01-19", date: "2026-01-19", nameEn: "Ethiopian Epiphany (Timket)", nameAm: "ጥምቀት", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-03-02", date: "2026-03-02", nameEn: "Victory of Adwa Day", nameAm: "የዐድዋ ድል በዓል", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-03-20", date: "2026-03-20", nameEn: "Eid al-Fitr (End of Ramadan)", nameAm: "ዒድ አልፈጥር", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-04-10", date: "2026-04-10", nameEn: "Orthodox Good Friday (Siklet)", nameAm: "ስቅለት", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-04-12", date: "2026-04-12", nameEn: "Orthodox Easter (Fasika)", nameAm: "ፋሲካ", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-05-01", date: "2026-05-01", nameEn: "International Labour Day", nameAm: "የሰራተኞች ቀን", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-05-05", date: "2026-05-05", nameEn: "Patriots' Victory Day", nameAm: "የአርበኞች ቀን", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-05-27", date: "2026-05-27", nameEn: "Eid al-Adha (Arefa)", nameAm: "አረፋ", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-05-28", date: "2026-05-28", nameEn: "Downfall of the Derg", nameAm: "ደርግ የወደቀበት ቀን", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-08-25", date: "2026-08-25", nameEn: "Mawlid (Birth of Prophet Muhammad)", nameAm: "መውሊድ", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-09-11", date: "2026-09-11", nameEn: "Ethiopian New Year (Enkutatash)", nameAm: "እንቁጣጣሽ", type: "holiday", isWorkingDay: false, year: 2026 },
      { id: "hol_2026-09-27", date: "2026-09-27", nameEn: "Finding of the True Cross (Meskel)", nameAm: "መስቀል", type: "holiday", isWorkingDay: false, year: 2026 },
      // 2027
      { id: "hol_2027-01-07", date: "2027-01-07", nameEn: "Ethiopian Christmas (Genna)", nameAm: "ገና", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-01-19", date: "2027-01-19", nameEn: "Ethiopian Epiphany (Timket)", nameAm: "ጥምቀት", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-03-02", date: "2027-03-02", nameEn: "Victory of Adwa Day", nameAm: "የዐድዋ ድል በዓል", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-03-10", date: "2027-03-10", nameEn: "Eid al-Fitr (End of Ramadan)", nameAm: "ዒድ አልፈጥር", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-04-30", date: "2027-04-30", nameEn: "Orthodox Good Friday (Siklet)", nameAm: "ስቅለት", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-05-02", date: "2027-05-02", nameEn: "Orthodox Easter (Fasika)", nameAm: "ፋሲካ", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-05-01", date: "2027-05-01", nameEn: "International Labour Day", nameAm: "የሰራተኞች ቀን", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-05-05", date: "2027-05-05", nameEn: "Patriots' Victory Day", nameAm: "የአርበኞች ቀን", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-05-17", date: "2027-05-17", nameEn: "Eid al-Adha (Arefa)", nameAm: "አረፋ", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-05-28", date: "2027-05-28", nameEn: "Downfall of the Derg", nameAm: "ደርግ የወደቀበት ቀን", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-08-15", date: "2027-08-15", nameEn: "Mawlid (Birth of Prophet Muhammad)", nameAm: "መውሊድ", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-09-12", date: "2027-09-12", nameEn: "Ethiopian New Year (Enkutatash)", nameAm: "እንቁጣጣሽ", type: "holiday", isWorkingDay: false, year: 2027 },
      { id: "hol_2027-09-27", date: "2027-09-27", nameEn: "Finding of the True Cross (Meskel)", nameAm: "መስቀል", type: "holiday", isWorkingDay: false, year: 2027 },
    ];
    for (const h of holidays) {
      await client.query(`
        INSERT INTO "special_days" ("id", "date", "name_en", "name_am", "type", "is_working_day", "year")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("id") DO NOTHING;
      `, [h.id, h.date, h.nameEn, h.nameAm, h.type, h.isWorkingDay, h.year]);
    }

    // 4. Core Leadership & Users
    console.log("5. Creating Core Leadership & Plant Managers...");
    const seedUsers = [
      { id: "usr_admin", name: "Col. Kebede Worku (Sys Admin)", email: adminEmail, role: "sys_admin", password: hashedAdminPassword },
      { id: "usr_om", name: "Mr. Mihretab Guramela (Operations Directorate Manager)", email: "om@dpm.local", role: "om", password: hashedDemoPassword },
      { id: "usr_fm_sac", name: "Sisay Milkessa (Small Arm Factory Manager)", email: "fm@dpm.local", role: "fm", password: hashedDemoPassword },
      { id: "usr_fm_mac", name: "Eliyas Bekele (Medium Arm Factory Manager)", email: "fm_mac@dpm.local", role: "fm", password: hashedDemoPassword },
      { id: "usr_fm_hwc", name: "Maru Tessema (Heavy Weapon Factory Manager)", email: "fm_hwc@dpm.local", role: "fm", password: hashedDemoPassword },
      { id: "usr_fm_chem", name: "Getenet Sahelu (Chemical Charging Shop Manager)", email: "fm_chem@dpm.local", role: "fm", password: hashedDemoPassword },
      { id: "usr_fm_tool", name: "Solomon Geleta (Tool & Auxiliary Shop Manager)", email: "fm_tool@dpm.local", role: "fm", password: hashedDemoPassword },
      { id: "usr_qa_01", name: "Capt. Tigist Haile (QA Directorate Inspector)", email: "qa@dpm.local", role: "qa", password: hashedDemoPassword },
    ];

    for (const u of seedUsers) {
      console.log(`   - [${u.role.toUpperCase()}] ${u.name} <${u.email}>`);
      await client.query(`
        INSERT INTO "users" ("id", "name", "email", "email_verified", "role", "active", "must_change_password")
        VALUES ($1, $2, $3, true, $4, true, false)
        ON CONFLICT ("id") DO NOTHING;
      `, [u.id, u.name, u.email, u.role]);

      await client.query(`
        INSERT INTO "accounts" ("id", "account_id", "provider_id", "user_id", "password")
        VALUES ($1, $2, 'credential', $3, $4)
        ON CONFLICT ("id") DO NOTHING;
      `, [`acc_${u.id}`, u.id, u.id, u.password]);
    }

    // 5. Server Endpoints
    console.log("6. Seeding Standard Server Endpoints (LAN / Cloud / Localhost)...");
    const endpoints = [
      { id: "srv_lan_factory", name: "Main Plant Factory LAN", url: "http://192.168.1.100:3000", description: "On-premises high-speed factory local area network server", environment: "lan", isDefault: true, createdBy: "usr_admin" },
      { id: "srv_hq_cloud", name: "Homicho HQ Internet Cloud", url: "https://dpm.homicho.et", description: "Central cloud server accessible over public internet and mobile data", environment: "cloud", isDefault: false, createdBy: "usr_admin" },
      { id: "srv_localhost", name: "Localhost Edge / Developer", url: "http://localhost:3000", description: "Local development gateway running on localhost", environment: "local", isDefault: false, createdBy: "usr_admin" },
    ];
    for (const ep of endpoints) {
      await client.query(`
        INSERT INTO "server_endpoints" ("id", "name", "url", "description", "environment", "is_default", "is_active", "created_by")
        VALUES ($1, $2, $3, $4, $5, $6, true, $7)
        ON CONFLICT ("id") DO NOTHING;
      `, [ep.id, ep.name, ep.url, ep.description, ep.environment, ep.isDefault, ep.createdBy]);
    }

    // 6. 5 Munitions Factories
    console.log("7. Creating 5 Munitions Plants...");
    const factories = [
      { id: "fac_sac", name: "Small Arm Factory (SAF)", omId: "usr_om" },
      { id: "fac_mac", name: "Medium Arm Factory (MAF)", omId: "usr_om" },
      { id: "fac_hwc", name: "Heavy Weapon Factory (HWF)", omId: "usr_om" },
      { id: "fac_chem", name: "Chemical Charging Shop (CCS)", omId: "usr_om" },
      { id: "fac_tool", name: "Tool and Auxiliary Shop (TAS)", omId: "usr_om" },
    ];
    for (const f of factories) {
      await client.query(`
        INSERT INTO "factories" ("id", "name", "om_id", "active")
        VALUES ($1, $2, $3, true)
        ON CONFLICT ("id") DO NOTHING;
      `, [f.id, f.name, f.omId]);
    }

    // 7. Factory Users Mapping
    console.log("8. Mapping Factory Managers and QA Inspector to Plants...");
    const factoryUserMappings = [
      { factoryId: "fac_sac", userId: "usr_fm_sac" },
      { factoryId: "fac_mac", userId: "usr_fm_mac" },
      { factoryId: "fac_hwc", userId: "usr_fm_hwc" },
      { factoryId: "fac_chem", userId: "usr_fm_chem" },
      { factoryId: "fac_tool", userId: "usr_fm_tool" },
      { factoryId: "fac_sac", userId: "usr_qa_01" },
      { factoryId: "fac_mac", userId: "usr_qa_01" },
      { factoryId: "fac_hwc", userId: "usr_qa_01" },
      { factoryId: "fac_chem", userId: "usr_qa_01" },
      { factoryId: "fac_tool", userId: "usr_qa_01" },
    ];
    for (const fu of factoryUserMappings) {
      await client.query(`
        INSERT INTO "factory_users" ("factory_id", "user_id")
        VALUES ($1, $2)
        ON CONFLICT ("factory_id", "user_id") DO NOTHING;
      `, [fu.factoryId, fu.userId]);
    }

    // 8. Production Lines
    console.log("9. Creating Production Lines...");
    const lines = [
      { id: "line_saf_39_01", factoryId: "fac_sac", name: "SAF-39-L01: 39mm Cartridge Line" },
      { id: "line_saf_39_02", factoryId: "fac_sac", name: "SAF-39-L02: 39mm Bullet Line" },
      { id: "line_saf_39_03", factoryId: "fac_sac", name: "SAF-39-L03: 39mm Final Assembly" },
      { id: "line_saf_54_01", factoryId: "fac_sac", name: "SAF-54-L01: 54mm Cartridge Line" },
      { id: "line_saf_54_02", factoryId: "fac_sac", name: "SAF-54-L02: 54mm Bullet Line" },
      { id: "line_saf_54_03", factoryId: "fac_sac", name: "SAF-54-L03: 54mm Final Assembly" },
      { id: "line_maf_127_01", factoryId: "fac_mac", name: "MAF-127-L01: 12.7mm Cartridge Line" },
      { id: "line_maf_127_02", factoryId: "fac_mac", name: "MAF-127-L02: 12.7mm Steel Core Line" },
      { id: "line_maf_127_03", factoryId: "fac_mac", name: "MAF-127-L03: 12.7mm Final Assembly" },
      { id: "line_hwf_01", factoryId: "fac_hwc", name: "HWF-L01: 100mm/122mm Machining Line" },
      { id: "line_hwf_02", factoryId: "fac_hwc", name: "HWF-L02: 82mm/60mm Mortar Line" },
      { id: "line_ccs_01", factoryId: "fac_chem", name: "CCS-L01: Warhead Melt-Cast Filling Bay" },
      { id: "line_ccs_02", factoryId: "fac_chem", name: "CCS-L02: Propellant Charging & Sealing" },
      { id: "line_tas_01", factoryId: "fac_tool", name: "TAS-L01: CNC Punch & Die Toolmaking" },
      { id: "line_tas_02", factoryId: "fac_tool", name: "TAS-L02: Die Heat Treatment & Calibration" },
    ];
    for (const l of lines) {
      await client.query(`
        INSERT INTO "lines" ("id", "factory_id", "name", "active")
        VALUES ($1, $2, $3, true)
        ON CONFLICT ("id") DO NOTHING;
      `, [l.id, l.factoryId, l.name]);
    }

    // 9. Products Catalog
    console.log("10. Creating Munitions Products Catalog...");
    const products = [
      { id: "prod_sap_39_cr", factoryId: "fac_sac", name: "39mm Cartridge Case (7.62x39)", sku: "SAP-39-CR" },
      { id: "prod_sap_39_bl", factoryId: "fac_sac", name: "39mm Bullet Core & Jacket", sku: "SAP-39-BL" },
      { id: "prod_sap_39_asm", factoryId: "fac_sac", name: "7.62x39mm Final Round", sku: "SAP-39-ASM" },
      { id: "prod_sap_54_cr", factoryId: "fac_sac", name: "54mm Rimmed Case (7.62x54R)", sku: "SAP-54-CR" },
      { id: "prod_sap_54_asm", factoryId: "fac_sac", name: "7.62x54mmR PKM Final Round", sku: "SAP-54-ASM" },
      { id: "prod_map_127_cr", factoryId: "fac_mac", name: "12.7mm Cartridge Case", sku: "MAP-127-CR" },
      { id: "prod_map_127_sc", factoryId: "fac_mac", name: "12.7mm Armor-Piercing Core", sku: "MAP-127-SC" },
      { id: "prod_map_127_asm", factoryId: "fac_mac", name: "12.7x108mm DShK Heavy Round", sku: "MAP-127-ASM" },
      { id: "prod_hwp_122_wh", factoryId: "fac_hwc", name: "122mm Howitzer Shell Body", sku: "HWP-122-WH" },
      { id: "prod_hwp_82_mb", factoryId: "fac_hwc", name: "82mm Mortar Bomb Machined", sku: "HWP-82-MB" },
      { id: "prod_ccs_122_whc", factoryId: "fac_chem", name: "122mm Warhead TNT Melt Charge", sku: "CCS-122-WHC" },
      { id: "prod_tas_dd_punch", factoryId: "fac_tool", name: "Tungsten Carbide Drawing Punch", sku: "TAS-DD-PUNCH" },
    ];
    for (const p of products) {
      await client.query(`
        INSERT INTO "products" ("id", "factory_id", "name", "sku", "active")
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT ("id") DO NOTHING;
      `, [p.id, p.factoryId, p.name, p.sku]);
    }

    // 10. Line Products
    console.log("11. Linking Lines to Products...");
    const lineProducts = [
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
    for (const lp of lineProducts) {
      await client.query(`
        INSERT INTO "line_products" ("line_id", "product_id")
        VALUES ($1, $2)
        ON CONFLICT ("line_id", "product_id") DO NOTHING;
      `, [lp.lineId, lp.productId]);
    }

    // 11. QA Assignment Matrix
    console.log("12. Assigning QA Matrix...");
    for (const p of products) {
      await client.query(`
        INSERT INTO "qa_assignments" ("qa_user_id", "product_id")
        VALUES ($1, $2)
        ON CONFLICT ("qa_user_id", "product_id") DO NOTHING;
      `, ["usr_qa_01", p.id]);
    }

    // 12. Monthly Production Plans (November 2026)
    console.log("13. Creating Baseline Production Plans for November 2026...");
    const samplePlans = [
      { id: "plan_saf_39_asm_nov26", lineId: "line_saf_39_03", productId: "prod_sap_39_asm", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 375000 },
      { id: "plan_saf_39_cr_nov26", lineId: "line_saf_39_01", productId: "prod_sap_39_cr", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 400000 },
      { id: "plan_saf_54_asm_nov26", lineId: "line_saf_54_03", productId: "prod_sap_54_asm", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 125000 },
      { id: "plan_maf_127_asm_nov26", lineId: "line_maf_127_03", productId: "prod_map_127_asm", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 100000 },
      { id: "plan_maf_127_cr_nov26", lineId: "line_maf_127_01", productId: "prod_map_127_cr", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 125000 },
      { id: "plan_hwf_122_wh_nov26", lineId: "line_hwf_01", productId: "prod_hwp_122_wh", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 25000 },
      { id: "plan_hwf_82_mb_nov26", lineId: "line_hwf_02", productId: "prod_hwp_82_mb", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 37500 },
      { id: "plan_ccs_122_whc_nov26", lineId: "line_ccs_01", productId: "prod_ccs_122_whc", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 20000 },
      { id: "plan_tas_dd_punch_nov26", lineId: "line_tas_01", productId: "prod_tas_dd_punch", startDate: "2026-11-01", endDate: "2026-11-30", plannedQty: 5000 },
    ];
    for (const pl of samplePlans) {
      await client.query(`
        INSERT INTO "plans" ("id", "line_id", "product_id", "start_date", "end_date", "planned_qty", "initial_planned_qty")
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        ON CONFLICT ("id") DO NOTHING;
      `, [pl.id, pl.lineId, pl.productId, pl.startDate, pl.endDate, pl.plannedQty]);
    }

    // 13. Sample Operational Figures (November 2–5, 2026)
    console.log("14. Seeding Initial Production Figures & Quality Records...");
    const sampleEntries = [
      { date: "2026-11-02", factoryId: "fac_sac", lineId: "line_saf_39_03", productId: "prod_sap_39_asm", fg: 15200, rew: 80, rej: 35, scr: 12, wip: 450, down: 90, dId: "dow_01", note: "Replaced tungsten cupping punch on Line 03. Shift 1 & 2 operated at optimal hydraulic press pressure. Batch cleared ballistic testing.", by: "usr_fm_sac" },
      { date: "2026-11-02", factoryId: "fac_mac", lineId: "line_maf_127_03", productId: "prod_map_127_asm", fg: 4100, rew: 15, rej: 8, scr: 3, wip: 120, down: 48, dId: "dow_05", note: "Ballistic chronograph tolerance calibration. 12.7mm steel cores hardened successfully.", by: "usr_fm_mac" },
      { date: "2026-11-03", factoryId: "fac_sac", lineId: "line_saf_39_03", productId: "prod_sap_39_asm", fg: 14900, rew: 110, rej: 40, scr: 18, wip: 520, down: 45, dId: "dow_03", note: "Tooling caliber changeover inspection passed QA spot-checks.", by: "usr_fm_sac" },
      { date: "2026-11-03", factoryId: "fac_mac", lineId: "line_maf_127_03", productId: "prod_map_127_asm", fg: 3950, rew: 25, rej: 12, scr: 5, wip: 180, down: 30, dId: "dow_04", note: "Slight delay awaiting raw brass strip delivery from central store.", by: "usr_fm_mac" },
      { date: "2026-11-04", factoryId: "fac_sac", lineId: "line_saf_39_03", productId: "prod_sap_39_asm", fg: 15400, rew: 60, rej: 20, scr: 8, wip: 390, down: 0, dId: null, note: "High efficiency across both day and night shifts. Zero chamber misfires.", by: "usr_fm_sac" },
      { date: "2026-11-04", factoryId: "fac_mac", lineId: "line_maf_127_03", productId: "prod_map_127_asm", fg: 4080, rew: 12, rej: 6, scr: 2, wip: 110, down: 0, dId: null, note: "Heavy caliber production steady with optimal casing concentricity.", by: "usr_fm_mac" },
      { date: "2026-11-05", factoryId: "fac_sac", lineId: "line_saf_39_03", productId: "prod_sap_39_asm", fg: 15300, rew: 70, rej: 25, scr: 10, wip: 410, down: 20, dId: "dow_02", note: "Electronic load-cell sensor recalibrated on assembly primer feed.", by: "usr_fm_sac" },
      { date: "2026-11-05", factoryId: "fac_mac", lineId: "line_maf_127_03", productId: "prod_map_127_asm", fg: 4120, rew: 10, rej: 5, scr: 2, wip: 95, down: 0, dId: null, note: "Excellent assembly tolerances under ballistic speed gates.", by: "usr_fm_mac" },
    ];

    for (const e of sampleEntries) {
      const entryId = `rep_${e.date}_${e.lineId}_${e.productId}`;
      await client.query(`
        INSERT INTO "report_entries" ("id", "date", "line_id", "product_id", "finished_good", "rework", "reject", "scrap", "wip", "downtime_minutes", "downtime_reason_id", "issue_note", "updated_by")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT ("id") DO NOTHING;
      `, [entryId, e.date, e.lineId, e.productId, e.fg, e.rew, e.rej, e.scr, e.wip, e.down, e.dId, e.note, e.by]);

      await client.query(`
        INSERT INTO "qa_approvals" ("id", "report_entry_id", "status", "note", "qa_user_id")
        VALUES ($1, $2, 'approved', 'Ballistic test and visual dimensional inspection verified by QA.', 'usr_qa_01')
        ON CONFLICT ("id") DO NOTHING;
      `, [`appr_${entryId}`, entryId]);

      await client.query(`
        INSERT INTO "stock_ledger" ("id", "factory_id", "product_id", "delta", "report_entry_id")
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ("id") DO NOTHING;
      `, [`stk_${entryId}`, e.factoryId, e.productId, e.fg, entryId]);
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

    return { success: true };
  } finally {
    if (shouldRelease && client) {
      client.release();
    }
  }
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/dpm";

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    const isReset = process.argv.includes("--reset");
    await runSeed(pool, { reset: isReset });
  } catch (err) {
    console.error("❌ Seed execution failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("seed.mjs")) {
  main();
}
