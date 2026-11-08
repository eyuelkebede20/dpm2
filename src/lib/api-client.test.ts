// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { z } from "zod";
import {
  apiClient,
  useApiQuery,
  calculateBackoffWithJitter,
} from "./api-client";
import { AppError } from "./errors";

describe("apiClient - Resilient API & State Layer", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe("1. Successful Requests & Serialization", () => {
    it("fetches and parses JSON successfully for GET request", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ message: "Success", count: 42 })),
      });

      const data = await apiClient<{ message: string; count: number }>("/api/test");
      expect(data).toEqual({ message: "Success", count: 42 });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    it("serializes body and sets application/json for POST request", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify({ id: "item-101" })),
      });

      const payload = { name: "Assembly Line 01", capacity: 500 };
      const data = await apiClient.post<{ id: string }>("/api/lines", payload);

      expect(data).toEqual({ id: "item-101" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/lines",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
          headers: expect.any(Headers),
        })
      );
    });

    it("handles 204 No Content response gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      });

      const data = await apiClient.delete("/api/items/123");
      expect(data).toBeUndefined();
    });
  });

  describe("2. Schema Validation with Zod", () => {
    const userSchema = z.object({
      id: z.string(),
      email: z.string().email(),
      role: z.enum(["sys_admin", "om", "fm", "qa"]),
    });

    it("passes through valid data conforming to schema", async () => {
      const validPayload = { id: "u-1", email: "manager@plant.local", role: "fm" };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(validPayload)),
      });

      const data = await apiClient("/api/users/u-1", { schema: userSchema });
      expect(data).toEqual(validPayload);
    });

    it("throws AppError.validation when response fails schema validation", async () => {
      const invalidPayload = { id: "u-1", email: "invalid-email-format", role: "unknown_role" };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(invalidPayload)),
      });

      await expect(apiClient("/api/users/u-1", { schema: userSchema })).rejects.toThrow(AppError);

      try {
        await apiClient("/api/users/u-1", { schema: userSchema });
      } catch (err: any) {
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.metadata?.issues).toBeDefined();
        expect(err.userMessage).toContain("invalid data structure");
      }
    });
  });

  describe("3. Parsing & HTTP Error Mapping (4xx & 5xx)", () => {
    it("throws AppError.parse on malformed JSON response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body>Bad Gateway Error</body></html>"),
      });

      await expect(apiClient("/api/data")).rejects.toThrow(AppError);

      try {
        await apiClient("/api/data");
      } catch (err: any) {
        expect(err.code).toBe("PARSE_ERROR");
        expect(err.message).toContain("Failed to parse JSON");
      }
    });

    it("maps 401 Unauthorized to AppError.unauthorized", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ error: "Session expired" })),
      });

      try {
        await apiClient("/api/secure-data");
      } catch (err: any) {
        expect(err.code).toBe("UNAUTHORIZED");
        expect(err.statusCode).toBe(401);
      }
    });

    it("maps 403 Forbidden to AppError.forbidden", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({ error: "Insufficient permissions" })),
      });

      try {
        await apiClient("/api/admin/users");
      } catch (err: any) {
        expect(err.code).toBe("FORBIDDEN");
        expect(err.statusCode).toBe(403);
      }
    });

    it("maps 404 Not Found to AppError.notFound", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ error: "Product not found" })),
      });

      try {
        await apiClient("/api/products/missing");
      } catch (err: any) {
        expect(err.code).toBe("NOT_FOUND");
        expect(err.statusCode).toBe(404);
      }
    });

    it("maps 429 Rate Limit to AppError.rateLimit", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({ error: "Too many requests" })),
      });

      try {
        await apiClient("/api/login", { method: "POST", idempotent: false });
      } catch (err: any) {
        expect(err.code).toBe("RATE_LIMITED");
        expect(err.statusCode).toBe(429);
      }
    });
  });

  describe("4. Idempotency, Retries & Exponential Backoff with Jitter", () => {
    it("does not retry non-idempotent POST operations on 500 error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve(JSON.stringify({ error: "Database lock conflict" })),
      });

      await expect(
        apiClient.post("/api/entries", { qty: 100 })
      ).rejects.toThrow(AppError);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("retries idempotent GET request on 503 Service Unavailable and succeeds", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.resolve({
            ok: false,
            status: 503,
            text: () => Promise.resolve("Service Unavailable"),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ status: "healthy" })),
        });
      });

      const data = await apiClient<{ status: string }>("/api/health", {
        retries: 2,
        retryDelayMs: 10,
        jitter: false,
      });

      expect(data).toEqual({ status: "healthy" });
      expect(callCount).toBe(2);
    });

    it("exhausts retries and throws AppError when server continues failing", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve("Bad Gateway"),
      });

      await expect(
        apiClient("/api/failing", {
          retries: 2,
          retryDelayMs: 10,
          jitter: false,
        })
      ).rejects.toThrow(AppError);

      expect(globalThis.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("calculates exponential backoff delay within bounds", () => {
      // Without jitter: exact exponential values
      expect(calculateBackoffWithJitter(0, 100, 2000, 2, false)).toBe(100);
      expect(calculateBackoffWithJitter(1, 100, 2000, 2, false)).toBe(200);
      expect(calculateBackoffWithJitter(2, 100, 2000, 2, false)).toBe(400);
      expect(calculateBackoffWithJitter(10, 100, 1000, 2, false)).toBe(1000); // capped at max

      // With jitter: within [0, cappedDelay]
      for (let i = 0; i < 20; i++) {
        const jitterVal = calculateBackoffWithJitter(2, 100, 1000, 2, true);
        expect(jitterVal).toBeGreaterThanOrEqual(0);
        expect(jitterVal).toBeLessThanOrEqual(400);
      }
    });
  });

  describe("5. Timeouts, Caller Aborts & Offline Handling", () => {
    it("handles request timeout and throws AppError.timeout", async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
        return new Promise((_, reject) => {
          opts.signal.addEventListener("abort", () => {
            reject(new Error("The operation was aborted"));
          });
        });
      });

      const promise = apiClient("/api/slow", {
        timeoutMs: 25,
        retries: 0,
      });

      await expect(promise).rejects.toThrow(AppError);

      try {
        await apiClient("/api/slow", { timeoutMs: 25, retries: 0 });
      } catch (err: any) {
        expect(err.code).toBe("TIMEOUT");
        expect(err.message).toContain("Request timed out");
      }
    });

    it("respects caller-supplied AbortSignal and throws ABORTED error", async () => {
      const controller = new AbortController();

      globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
        return new Promise((_, reject) => {
          opts.signal.addEventListener("abort", () => {
            reject(new Error("AbortError"));
          });
        });
      });

      const promise = apiClient("/api/cancelable", {
        signal: controller.signal,
        retries: 0,
      });

      // Abort immediately
      controller.abort();

      await expect(promise).rejects.toThrow(AppError);

      try {
        await promise;
      } catch (err: any) {
        expect(err.code).toBe("ABORTED");
        expect(err.userMessage).toBe("Operation cancelled.");
      }
    });

    it("detects offline state when navigator.onLine is false", async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      try {
        await apiClient("/api/data", { retries: 0 });
      } catch (err: any) {
        expect(err.code).toBe("NETWORK_ERROR");
        expect(err.metadata?.offline).toBe(true);
        expect(err.userMessage).toContain("No network connection detected");
      } finally {
        Object.defineProperty(navigator, "onLine", { value: originalOnLine, configurable: true });
      }
    });
  });

  describe("6. useApiQuery React Hook Lifecycle", () => {
    it("manages loading to success lifecycle transition", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ factoryId: "f-101", name: "Plant Addis" })),
      });

      const { result } = renderHook(() =>
        useApiQuery<{ factoryId: string; name: string }>("/api/factories/f-101")
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual({ factoryId: "f-101", name: "Plant Addis" });
      expect(result.current.error).toBeNull();
    });

    it("manages error lifecycle and surfaces AppError", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ error: "Plant not found" })),
      });

      const { result } = renderHook(() =>
        useApiQuery("/api/factories/missing", { retries: 0 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeInstanceOf(AppError);
      expect(result.current.error?.code).toBe("NOT_FOUND");
    });

    it("supports refetching programmatically", async () => {
      let counter = 1;
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ counter: counter++ })),
        })
      );

      const { result } = renderHook(() => useApiQuery<{ counter: number }>("/api/counter"));

      await waitFor(() => {
        expect(result.current.data?.counter).toBe(1);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.data?.counter).toBe(2);
    });

    it("cancels in-flight request when component unmounts", async () => {
      let abortListenerFired = false;
      globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
        opts.signal.addEventListener("abort", () => {
          abortListenerFired = true;
        });
        return new Promise(() => {}); // never resolves
      });

      const { unmount } = renderHook(() => useApiQuery("/api/long-polling"));

      expect(abortListenerFired).toBe(false);

      // Unmount hook
      unmount();

      expect(abortListenerFired).toBe(true);
    });
  });
});
