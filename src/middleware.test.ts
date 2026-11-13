import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { clearRateLimitStore } from "@/lib/rate-limit";

describe("Security Middleware - Rate Limiting, Headers & Request Filtering", () => {
  beforeEach(() => {
    clearRateLimitStore();
    vi.restoreAllMocks();
  });

  it("injects mandatory OWASP security headers on allowed requests", () => {
    const req = new NextRequest("http://localhost:3000/dashboard");
    const res = middleware(req);

    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  it("blocks path traversal and proto pollution attacks with 400 Bad Request", () => {
    const req1 = new NextRequest("http://localhost:3000/api/data?file=../../etc/passwd");
    const res1 = middleware(req1);
    expect(res1.status).toBe(400);

    const req2 = new NextRequest("http://localhost:3000/api/data?__proto__[polluted]=true");
    const res2 = middleware(req2);
    expect(res2.status).toBe(400);
  });

  it("rate limits brute force authentication attacks on /api/auth", () => {
    // 15 requests allowed
    for (let i = 0; i < 15; i++) {
      const req = new NextRequest("http://localhost:3000/api/auth/sign-in", {
        headers: { "x-forwarded-for": "10.0.0.99" },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    }

    // 16th request must be blocked with 429 Too Many Requests
    const reqBlocked = new NextRequest("http://localhost:3000/api/auth/sign-in", {
      headers: { "x-forwarded-for": "10.0.0.99" },
    });
    const resBlocked = middleware(reqBlocked);
    expect(resBlocked.status).toBe(429);
    expect(resBlocked.headers.get("Retry-After")).toBeDefined();
  });

  it("prioritizes cf-connecting-ip header from Cloudflare for rate limiting", () => {
    // 15 requests under Cloudflare CF-Connecting-IP
    for (let i = 0; i < 15; i++) {
      const req = new NextRequest("http://localhost:3000/api/auth/sign-in", {
        headers: {
          "cf-connecting-ip": "203.0.113.195",
          "x-forwarded-for": `1.2.3.${i}`, // Attacker rotating XFF should have no effect
        },
      });
      const res = middleware(req);
      expect(res.status).toBe(200);
    }

    // 16th request from same CF IP must be blocked even if XFF changes
    const reqBlocked = new NextRequest("http://localhost:3000/api/auth/sign-in", {
      headers: {
        "cf-connecting-ip": "203.0.113.195",
        "x-forwarded-for": "9.9.9.9",
      },
    });
    const resBlocked = middleware(reqBlocked);
    expect(resBlocked.status).toBe(429);
  });

  it("locks out unauthorized dev and seeding routes with 404 in production, while permitting switch-role", () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = "production";

      const devReq = new NextRequest("http://localhost:3000/api/dev/internal-test");
      expect(middleware(devReq).status).toBe(404);

      const switchRoleReq = new NextRequest("http://localhost:3000/api/dev/switch-role");
      expect(middleware(switchRoleReq).status).toBe(200);

      const seedReq = new NextRequest("http://localhost:3000/api/seed-db");
      expect(middleware(seedReq).status).toBe(404);

      const seedReq2 = new NextRequest("http://localhost:3000/api/seed");
      expect(middleware(seedReq2).status).toBe(404);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });
});
