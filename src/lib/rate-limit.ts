/**
 * In-Memory Sliding Window Rate Limiter
 * Implements token bucket / sliding window rate limiting for API routes,
 * authentication endpoints, and sensitive server actions.
 *
 * OWASP A04: Insecure Design & Anti-Brute Force Protection
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup of expired entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Do not keep Node.js process alive solely for cleanup timer in tests
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

export interface RateLimitOptions {
  /** Maximum number of allowed requests in the window */
  maxRequests: number;
  /** Sliding window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds when the window resets
  retryAfter: number; // Seconds until user can retry
}

/**
 * Check if a given identifier (IP, user ID, or composite key) is rate limited.
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { maxRequests: 60, windowSeconds: 60 }
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const existing = rateLimitStore.get(identifier);

  if (!existing || existing.resetAt <= now) {
    // New or expired window
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt,
    });

    return {
      success: true,
      limit: options.maxRequests,
      remaining: Math.max(0, options.maxRequests - 1),
      reset: Math.ceil(resetAt / 1000),
      retryAfter: 0,
    };
  }

  // Active window
  existing.count += 1;
  const remaining = Math.max(0, options.maxRequests - existing.count);
  const reset = Math.ceil(existing.resetAt / 1000);
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  const success = existing.count <= options.maxRequests;

  return {
    success,
    limit: options.maxRequests,
    remaining,
    reset,
    retryAfter: success ? 0 : retryAfter,
  };
}

/**
 * Reset rate limit store (useful for tests)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
