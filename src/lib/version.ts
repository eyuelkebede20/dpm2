export interface AppVersionInfo {
  version: string;
  buildTime: string;
  appName: string;
  minAppVersion: string;
  releaseNotes: string;
  gitCommit?: string;
  githubRepo?: string;
  githubUrl?: string;
}

export const CURRENT_APP_VERSION = "1.0.1";
export const BUILD_TIMESTAMP = "2026-11-12T10:00:00.000Z";
export const GITHUB_REPO = process.env.GITHUB_REPO || "eyuelkebede20/dpm2";
export const CURRENT_GIT_COMMIT = "bc4b2e1";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
