import { NextResponse } from "next/server";
import {
  CURRENT_APP_VERSION,
  BUILD_TIMESTAMP,
  GITHUB_REPO,
  CURRENT_GIT_COMMIT,
  GITHUB_URL,
  AppVersionInfo,
} from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json<AppVersionInfo>({
    version: CURRENT_APP_VERSION,
    buildTime: BUILD_TIMESTAMP,
    appName: "Homicho Ammunition Engineering Industry - DPM",
    minAppVersion: "1.0.0",
    releaseNotes:
      "Progressive Web App (PWA) with Over-The-Air (OTA) updates, resilient Service Worker caching, and full mobile optimization.",
    gitCommit: CURRENT_GIT_COMMIT,
    githubRepo: GITHUB_REPO,
    githubUrl: GITHUB_URL,
  });
}
