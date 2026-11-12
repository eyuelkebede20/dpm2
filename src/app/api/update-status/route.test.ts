import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { auth } from "@/lib/auth";
import fs from "fs";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("fs", () => {
  const actualFs = vi.importActual("fs");
  return {
    ...actualFs,
    default: {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe("GET /api/update-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a sys_admin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "usr_om", role: "om" },
    } as any);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns empty lines if status file does not exist", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "usr_admin", role: "sys_admin" },
    } as any);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ lines: [], done: false, failed: false });
  });

  it("returns parsed lines and done=false while update is running", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "usr_admin", role: "sys_admin" },
    } as any);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      "=== DPM2 Update started ===\n[1/4] Pulling latest code...\n"
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lines).toHaveLength(2);
    expect(body.done).toBe(false);
    expect(body.failed).toBe(false);
  });

  it("returns done=true when update completed successfully", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "usr_admin", role: "sys_admin" },
    } as any);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      "=== DPM2 Update started ===\n[4/4] Verifying health...\n✓ Update complete and application is healthy.\n"
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.done).toBe(true);
    expect(body.failed).toBe(false);
  });

  it("returns done=true and failed=true when rollback or failure occurs", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "usr_admin", role: "sys_admin" },
    } as any);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      "=== DPM2 Update started ===\n[!] git pull failed (conflict detected)\nRollback complete to previous stable commit\n"
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.done).toBe(true);
    expect(body.failed).toBe(true);
  });
});
