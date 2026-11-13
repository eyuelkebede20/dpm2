import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import * as pushRoute from "../push-db/route";

vi.mock("../push-db/route", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
}));

describe("Migrate Database Route - /api/migrate-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates GET requests to push-db route handler", async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    vi.mocked(pushRoute.GET).mockResolvedValue(mockResponse as any);

    const req = new NextRequest("http://localhost:3000/api/migrate-db");
    const res = await GET(req);

    expect(pushRoute.GET).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });

  it("delegates POST requests to push-db route handler", async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    vi.mocked(pushRoute.POST).mockResolvedValue(mockResponse as any);

    const req = new NextRequest("http://localhost:3000/api/migrate-db", { method: "POST" });
    const res = await POST(req);

    expect(pushRoute.POST).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });
});
