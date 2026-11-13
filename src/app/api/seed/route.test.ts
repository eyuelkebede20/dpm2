import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import * as seedDbRoute from "../seed-db/route";

vi.mock("../seed-db/route", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
}));

describe("Seed Route Alias - /api/seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates GET requests to seed-db route handler", async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    vi.mocked(seedDbRoute.GET).mockResolvedValue(mockResponse as any);

    const req = new NextRequest("http://localhost:3000/api/seed");
    const res = await GET(req);

    expect(seedDbRoute.GET).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });

  it("delegates POST requests to seed-db route handler", async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    vi.mocked(seedDbRoute.POST).mockResolvedValue(mockResponse as any);

    const req = new NextRequest("http://localhost:3000/api/seed", { method: "POST" });
    const res = await POST(req);

    expect(seedDbRoute.POST).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });
});
