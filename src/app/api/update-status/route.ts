import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import fs from "fs";
import path from "path";

/**
 * GET /api/update-status
 *
 * Returns live status lines written by update.sh, start.sh, or UPDATE.bat.
 * Protected: sys_admin role only.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const role = session.user.role ?? "operator";
  if (role !== "sys_admin") {
    return new NextResponse("Forbidden: System Administrator access required", { status: 403 });
  }

  const inContainer = fs.existsSync("/run/updater");
  const fileToRead = inContainer
    ? "/run/updater/update.status"
    : path.join(process.cwd(), "run", "update.status");

  if (!fs.existsSync(fileToRead)) {
    return NextResponse.json({ lines: [], done: false, failed: false });
  }

  try {
    const raw = fs.readFileSync(fileToRead, "utf-8");
    const lines = raw.split("\n").filter(Boolean);

    const failed =
      lines.some(
        (l) =>
          l.includes("Rollback complete") ||
          l.includes("FAILED:") ||
          l.includes("Update failed") ||
          l.includes("[!] Backup failed") ||
          l.includes("[!] git pull failed") ||
          l.includes("aborting") ||
          (l.includes("Process exited with code") && !l.includes("code 0"))
      );

    const done =
      lines.some(
        (l) =>
          l.toLowerCase().includes("update complete") ||
          l.includes("UPDATE COMPLETE SUCCESSFULLY!") ||
          l.includes("application is healthy")
      ) || failed;

    return NextResponse.json({ lines, done, failed });
  } catch {
    return NextResponse.json({ lines: [], done: false, failed: false });
  }
}
