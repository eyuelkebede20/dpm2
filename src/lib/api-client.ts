/**
 * Resilient API Client & State Layer for DPM
 *
 * Implements:
 * - Typed fetch wrapper with AbortController support
 * - Request timeouts with automatic abort
 * - Exponential backoff with full jitter (idempotent methods only)
 * - Runtime Zod schema validation
 * - Unified AppError mapping for all error scenarios
 * - useApiQuery React hook with lifecycle cancellation
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import { AppError } from "./errors";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface ApiClientOptions<T = unknown> extends Omit<RequestInit, "body"> {
  method?: HttpMethod;
  body?: unknown;
  schema?: z.ZodType<T>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
  idempotent?: boolean;
}

export interface ApiQueryResult<T> {
  data: T | null;
  error: AppError | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<T | null>;
}

export interface UseApiQueryOptions<T> extends ApiClientOptions<T> {
  enabled?: boolean;
  initialData?: T | null;
}

const IDEMPOTENT_METHODS = new Set<HttpMethod>(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);
const RETRYABLE_STATUS_CODES = new Set<number>([408, 429, 500, 502, 503, 504]);

/**
 * Calculates exponential backoff delay with full jitter:
 * delay = min(maxDelay, baseDelay * factor^attempt + random * baseDelay)
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs: number = 300,
  maxDelayMs: number = 5000,
  factor: number = 2,
  useJitter: boolean = true
): number {
  const exponentialDelay = baseDelayMs * Math.pow(factor, attempt);
  const cappedDelay = Math.min(maxDelayMs, exponentialDelay);
  if (!useJitter) {
    return cappedDelay;
  }
  // Full jitter: uniformly random between 0 and cappedDelay
  return Math.floor(Math.random() * cappedDelay);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a resilient HTTP request.
 */
export async function apiClient<T = unknown>(
  url: string,
  options: ApiClientOptions<T> = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    headers: customHeaders = {},
    schema,
    timeoutMs = 10000,
    retries: customRetries,
    retryDelayMs = 300,
    maxRetryDelayMs = 5000,
    backoffFactor = 2,
    jitter = true,
    idempotent,
    signal: userSignal,
    credentials,
    ...fetchOptions
  } = options;

  // Resolve relative URLs to active custom backend server if set in localStorage
  let resolvedUrl = url;
  let defaultCredentials = credentials;

  if (typeof window !== "undefined" && url.startsWith("/")) {
    try {
      const customBackend = window.localStorage.getItem("dpm_active_backend_url");
      if (customBackend && customBackend.trim()) {
        const cleanBackend = customBackend.trim().replace(/\/+$/, "");
        if (cleanBackend && cleanBackend !== window.location.origin) {
          resolvedUrl = `${cleanBackend}${url}`;
          defaultCredentials = defaultCredentials || "include";
        }
      }
    } catch {
      // Ignore localStorage read errors and fall back to relative URL
    }
  }

  const isIdempotent = idempotent !== undefined ? idempotent : IDEMPOTENT_METHODS.has(method);
  // Only retry idempotent operations by default
  const maxRetries = customRetries !== undefined ? customRetries : (isIdempotent ? 2 : 0);

  let attempt = 0;
  let lastError: AppError = AppError.internal("Request not executed");

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    let isTimeout = false;

    // Timeout timer
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, timeoutMs);

    // Link user-supplied AbortSignal
    let onUserAbort: (() => void) | undefined;
    if (userSignal) {
      if (userSignal.aborted) {
        clearTimeout(timeoutId);
        throw AppError.fromCode("ABORTED", "Request was aborted by caller", {
          userMessage: "Operation cancelled.",
          retryable: false,
        });
      }
      onUserAbort = () => controller.abort();
      userSignal.addEventListener("abort", onUserAbort);
    }

    try {
      const headers = new Headers(customHeaders as HeadersInit);
      let formattedBody: BodyInit | undefined;

      if (body !== undefined && body !== null) {
        if (typeof body === "string" || body instanceof FormData || body instanceof URLSearchParams) {
          formattedBody = body;
        } else {
          formattedBody = JSON.stringify(body);
          if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
          }
        }
      }

      const response = await fetch(resolvedUrl, {
        ...fetchOptions,
        method,
        headers,
        body: formattedBody,
        signal: controller.signal,
        ...(defaultCredentials ? { credentials: defaultCredentials } : {}),
      });

      clearTimeout(timeoutId);
      if (userSignal && onUserAbort) {
        userSignal.removeEventListener("abort", onUserAbort);
      }

      // Check HTTP status
      if (!response.ok) {
        let errorPayload: unknown;
        try {
          const text = await response.text();
          errorPayload = text ? JSON.parse(text) : undefined;
        } catch {
          // If response body is not valid JSON, leave as text or empty
        }

        const appErr = AppError.fromHttpStatus(response.status, {
          responseBody: errorPayload,
          url,
          method,
        });

        // Determine if we should retry
        const isRetryableStatus = RETRYABLE_STATUS_CODES.has(response.status);
        if (isIdempotent && isRetryableStatus && attempt < maxRetries) {
          lastError = appErr;
          attempt++;
          const delay = calculateBackoffWithJitter(attempt - 1, retryDelayMs, maxRetryDelayMs, backoffFactor, jitter);
          await sleep(delay);
          continue;
        }

        throw appErr;
      }

      // Parse JSON response or handle empty response (204 No Content)
      if (response.status === 204) {
        return undefined as T;
      }

      let data: unknown;
      const text = await response.text();
      if (!text || !text.trim()) {
        data = undefined;
      } else {
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          throw AppError.parse("Failed to parse JSON response from server", {
            cause: parseErr,
            metadata: { url, method, rawText: text.slice(0, 200) },
          });
        }
      }

      // Validate schema if provided
      if (schema) {
        const parseResult = schema.safeParse(data);
        if (!parseResult.success) {
          throw AppError.validation(
            "Response data does not conform to expected schema",
            {
              url,
              method,
              issues: parseResult.error.issues,
            },
            "Received invalid data structure from manufacturing server."
          );
        }
        return parseResult.data;
      }

      return data as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (userSignal && onUserAbort) {
        userSignal.removeEventListener("abort", onUserAbort);
      }

      let appErr: AppError;

      if (err instanceof AppError) {
        appErr = err;
      } else if (isTimeout) {
        appErr = new AppError({
          code: "TIMEOUT",
          message: `Request timed out after ${timeoutMs}ms`,
          details: { url, method, timeoutMs },
          retryable: true,
        });
      } else if (userSignal?.aborted) {
        appErr = AppError.fromCode("ABORTED", "Request was aborted by caller", {
          userMessage: "Operation cancelled.",
          retryable: false,
        });
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        appErr = new AppError({
          code: "NETWORK_ERROR",
          message: "Device is currently offline",
          statusCode: 503,
          retryable: true,
          details: { url, method, offline: true },
          userMessage: "No network connection detected. Please reconnect and try again.",
        });
      } else {
        appErr = new AppError({
          code: "NETWORK_ERROR",
          message: (err as Error)?.message || "Network request failed",
          cause: err,
          details: { url, method },
          retryable: true,
        });
      }

      // Check if retry is appropriate
      const canRetry = isIdempotent && appErr.retryable && attempt < maxRetries;
      if (canRetry) {
        lastError = appErr;
        attempt++;
        const delay = calculateBackoffWithJitter(attempt - 1, retryDelayMs, maxRetryDelayMs, backoffFactor, jitter);
        await sleep(delay);
        continue;
      }

      throw appErr;
    }
  }

  throw lastError;
}

// Convenient HTTP verb helpers
apiClient.get = <T = unknown>(url: string, options?: Omit<ApiClientOptions<T>, "method">) =>
  apiClient<T>(url, { ...options, method: "GET" });

apiClient.post = <T = unknown>(url: string, body?: unknown, options?: Omit<ApiClientOptions<T>, "method" | "body">) =>
  apiClient<T>(url, { ...options, method: "POST", body });

apiClient.put = <T = unknown>(url: string, body?: unknown, options?: Omit<ApiClientOptions<T>, "method" | "body">) =>
  apiClient<T>(url, { ...options, method: "PUT", body });

apiClient.patch = <T = unknown>(url: string, body?: unknown, options?: Omit<ApiClientOptions<T>, "method" | "body">) =>
  apiClient<T>(url, { ...options, method: "PATCH", body });

apiClient.delete = <T = unknown>(url: string, options?: Omit<ApiClientOptions<T>, "method">) =>
  apiClient<T>(url, { ...options, method: "DELETE" });

/**
 * Declarative query hook for client components.
 * Automatically manages loading, error, success states, and handles unmount cancellation.
 */
export function useApiQuery<T = unknown>(
  url: string,
  options: UseApiQueryOptions<T> = {}
): ApiQueryResult<T> {
  const { enabled = true, initialData = null, ...clientOptions } = options;
  const clientOptionsRef = useRef(clientOptions);
  clientOptionsRef.current = clientOptions;

  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (): Promise<T | null> => {
    // Abort previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient<T>(url, {
        ...clientOptionsRef.current,
        signal: controller.signal,
      });
      setData(result);
      setIsLoading(false);
      return result;
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        // Ignored if cancelled by new query or unmount
        return null;
      }
      const appErr = AppError.from(err);
      setError(appErr);
      setIsLoading(false);
      return null;
    }
  }, [url]);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, fetchData]);

  return {
    data,
    error,
    isLoading,
    isError: error !== null,
    isSuccess: data !== null && error === null && !isLoading,
    refetch: fetchData,
  };
}
