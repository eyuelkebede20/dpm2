import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security";

/**
 * Next.js Edge / Node Middleware
 * Enforces OWASP Top 10 Protections:
 * - Anti-Brute Force Rate Limiting on Authentication & Sensitive APIs (A04)
 * - Strict HTTP Security Headers & Anti-Clickjacking (A05)
 * - Path Traversal & Prototype Pollution Filtering (A03)
 * - Environment Isolation & Dev Route Hard-Lockout in Production (A05)
 */

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Prioritize Cloudflare edge connecting IP (tamper-proof when behind Cloudflare proxy)
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const ip = cfIp || forwardedFor || realIp || "127.0.0.1";

  // 1. Hard lockout of developer test & database seeding routes in production
  const isDevOrSeedRoute =
    pathname.startsWith("/api/dev") ||
    pathname.startsWith("/api/seed") ||
    pathname.startsWith("/api/seed-db");

  if (isDevOrSeedRoute && process.env.NODE_ENV === "production") {
    logSecurityEvent({
      event: "SUSPICIOUS_PAYLOAD_BLOCKED",
      ip,
      endpoint: pathname,
      details: { reason: "Attempted to access dev/seeding routes in production" },
    });
    return new NextResponse("Not Found", { status: 404 });
  }

  // 2. Path Traversal & Malicious Query Parameter Inspection (OWASP A03)
  const fullUrl = decodeURIComponent(req.url).toLowerCase();
  const isMalicious =
    fullUrl.includes("../") ||
    fullUrl.includes("..\\") ||
    fullUrl.includes("__proto__") ||
    fullUrl.includes("constructor.prototype") ||
    fullUrl.includes("<script");

  if (isMalicious) {
    logSecurityEvent({
      event: "SUSPICIOUS_PAYLOAD_BLOCKED",
      ip,
      endpoint: pathname,
      details: { query: req.nextUrl.search },
    });
    return new NextResponse("Bad Request: Malicious characters detected", {
      status: 400,
    });
  }

  // 3. API & Authentication Rate Limiting (OWASP A04)
  if (pathname.startsWith("/api/auth")) {
    const rateLimit = checkRateLimit(`auth_${ip}`, {
      maxRequests: 15,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      logSecurityEvent({
        event: "RATE_LIMIT_TRIGGERED",
        ip,
        endpoint: pathname,
        details: { limit: rateLimit.limit, retryAfter: rateLimit.retryAfter },
      });

      return new NextResponse(
        JSON.stringify({
          error: "Too many authentication requests. Please try again later.",
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.reset),
          },
        }
      );
    }
  } else if (pathname.startsWith("/api/")) {
    const rateLimit = checkRateLimit(`api_${ip}`, {
      maxRequests: 120,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return new NextResponse(
        JSON.stringify({
          error: "API rate limit exceeded. Please throttle requests.",
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter),
          },
        }
      );
    }
  }

  // 4. Continue with Response and inject OWASP Security Headers (A05)
  const response = NextResponse.next();

  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
