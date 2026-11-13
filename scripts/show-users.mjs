import pg from "pg";

const { Pool } = pg;

async function showUsers() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/dpm";

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    const res = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.active, 
        u.must_change_password,
        STRING_AGG(f.name, ', ') AS factories
      FROM users u
      LEFT JOIN factory_users fu ON fu.user_id = u.id
      LEFT JOIN factories f ON f.id = fu.factory_id
      GROUP BY u.id, u.name, u.email, u.role, u.active, u.must_change_password
      ORDER BY 
        CASE u.role 
          WHEN 'admin' THEN 1 
          WHEN 'operations_manager' THEN 2 
          WHEN 'factory_manager' THEN 3 
          WHEN 'qa' THEN 4 
          ELSE 5 
        END, 
        u.name ASC;
    `);

    console.log("=========================================================================================");
    console.log("👥 DPM2 REGISTERED USERS IN DATABASE");
    console.log("=========================================================================================");

    if (res.rows.length === 0) {
      console.log("⚠️  NO USERS FOUND IN THE DATABASE.");
      console.log("   The database has not been seeded yet.");
      console.log("   To seed initial accounts and operational data, run:");
      console.log("   docker compose exec app node scripts/seed.mjs");
      console.log("=========================================================================================");
      return;
    }

    console.log(`Found ${res.rows.length} registered user(s):\n`);

    console.log(
      "| " +
      "Role".padEnd(20) + " | " +
      "Name".padEnd(24) + " | " +
      "Email".padEnd(24) + " | " +
      "Active".padEnd(8) + " | " +
      "Assigned Factory".padEnd(30) + " |"
    );
    console.log(
      "|-" +
      "-".repeat(20) + "-|-" +
      "-".repeat(24) + "-|-" +
      "-".repeat(24) + "-|-" +
      "-".repeat(8) + "-|-" +
      "-".repeat(30) + "-|"
    );

    for (const row of res.rows) {
      const roleStr = String(row.role || "").padEnd(20);
      const nameStr = String(row.name || "").padEnd(24);
      const emailStr = String(row.email || "").padEnd(24);
      const activeStr = String(row.active ? "Yes" : "No").padEnd(8);
      const facStr = String(row.factories || "All / None").slice(0, 30).padEnd(30);

      console.log(`| ${roleStr} | ${nameStr} | ${emailStr} | ${activeStr} | ${facStr} |`);
    }

    console.log("=========================================================================================");
    console.log("🔑 DEFAULT PASSWORDS FOR SEEDED ACCOUNTS:");
    console.log("• Sys Admin (admin@dpm.local) : AdminPassword123! (or $SEED_ADMIN_PASSWORD)");
    console.log("• All other demo users       : AdminPassword123!");
    console.log("=========================================================================================");
  } catch (err) {
    console.error("❌ Failed to query database users:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

showUsers();
