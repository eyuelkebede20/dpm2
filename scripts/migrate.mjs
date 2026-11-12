import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

async function runMigrations() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(migrationsFolder)) {
    console.log("No migrations folder found at", migrationsFolder);
    return;
  }

  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/dpm";

  console.log("Running database migrations from", migrationsFolder);
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder });
    console.log("Database migrations applied successfully.");
  } catch (error) {
    console.error("Migration execution failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
