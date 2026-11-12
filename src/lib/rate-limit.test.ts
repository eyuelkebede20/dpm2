import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, clearRateLimitStore } from "./rate-limit";

describe("Security - Token Bucket Rate Limiter", () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it("allows initial requests within max limit", () => {
    const res1 = checkRateLimit("ip_127.0.0.1", { maxRequests: 3, windowSeconds: 60 });
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);
    expect(res1.limit).toBe(3);

    const res2 = checkRateLimit("ip_127.0.0.1", { maxRequests: 3, windowSeconds: 60 });
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkRateLimit("ip_127.0.0.1", { maxRequests: 3, windowSeconds: 60 });
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("blocks requests that exceed maxRequests limit with proper retryAfter", () => {
    // Consume all 2 allowed tokens
    checkRateLimit("user_attack_1", { maxRequests: 2, windowSeconds: 30 });
    checkRateLimit("user_attack_1", { maxRequests: 2, windowSeconds: 30 });

    // 3rd attempt should be blocked
    const blocked = checkRateLimit("user_attack_1", { maxRequests: 2, windowSeconds: 30 });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(30);
  });

  it("isolates rate limit counters across distinct identifiers", () => {
    checkRateLimit("ip_user_a", { maxRequests: 1, windowSeconds: 60 });
    const userABlocked = checkRateLimit("ip_user_a", { maxRequests: 1, windowSeconds: 60 });
    expect(userABlocked.success).toBe(false);

    // user_b has independent limit
    const userBAllowed = checkRateLimit("ip_user_b", { maxRequests: 1, windowSeconds: 60 });
    expect(userBAllowed.success).toBe(true);
  });
});
