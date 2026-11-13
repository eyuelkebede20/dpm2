import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import fs from "fs";
import path from "path";
import { runSeed } from "./seed.mjs";

const { Pool } = pg;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrations() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(migrationsFolder)) {
    console.log("No migrations folder found at", migrationsFolder);
    return;
  }

  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/dpm";

  console.log("Preparing to apply database migrations from", migrationsFolder);
  
  let pool;
  let client;
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
      client = await pool.connect();
      await client.query("SELECT 1");
      console.log("Connected to PostgreSQL database.");
      break;
    } catch (err) {
      if (client) {
        client.release();
        client = null;
      }
      if (pool) {
        await pool.end().catch(() => {});
      }
      console.warn(`Database connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt === maxRetries) {
        console.error("Could not connect to database after maximum retries. Exiting.");
        process.exit(1);
      }
      await sleep(2000);
    }
  }

  try {
    const db = drizzle(pool);
    console.log("Applying Drizzle migrations...");
    await migrate(db, { migrationsFolder });
    console.log("Database migrations applied successfully.");

    // Check if initial database seeding is required
    try {
      const userCheck = await pool.query('SELECT COUNT(*) AS count FROM "users";');
      const userCount = parseInt(userCheck.rows[0]?.count || "0", 10);
      if (userCount === 0 || process.env.AUTO_SEED === "true") {
        console.log(`Database has ${userCount} users. Initiating automatic seed...`);
        await runSeed(pool);
      } else {
        console.log(`Database already initialized with ${userCount} existing users. Skipping automatic seed.`);
      }
    } catch (seedErr) {
      console.warn("Notice: Post-migration auto-seed check encountered an issue:", seedErr.message);
    }
  } catch (error) {
    console.error("Migration execution failed:", error);
    process.exit(1);
  } finally {
    if (client) client.release();
    if (pool) await pool.end();
  }
}

runMigrations();
