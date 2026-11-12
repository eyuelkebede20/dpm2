import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => {
  return {
    pool: {
      connect: vi.fn(),
    },
  };
});

import { pool } from "@/db";
import { GET } from "./route";

describe("Health Check API Route - GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with healthy status when database is reachable", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(mockClient as any);

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.database).toBe("connected");
    expect(data.timestamp).toBeDefined();
    expect(mockClient.query).toHaveBeenCalledWith("SELECT 1");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("returns 503 with unhealthy status when database connection throws", async () => {
    vi.mocked(pool.connect).mockRejectedValue(new Error("Connection refused"));

    const res = await GET();
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.status).toBe("unhealthy");
    expect(data.database).toBe("disconnected");
    expect(data.error).toBe("Connection refused");
  });
});
