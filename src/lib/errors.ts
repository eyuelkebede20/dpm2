/**
 * Error Model & Resilience Architecture for DPM
 * Adheres to Section 6 of AGENT.md: Two audiences (developers get logs, users get actionable steps).
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  userMessage?: string;
  statusCode?: number;
  retryable?: boolean;
  details?: unknown;
  cause?: unknown;
}

const DEFAULT_USER_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: "The request was invalid. Please check your inputs.",
  UNAUTHORIZED: "You are not logged in. Please sign in to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested item could not be found.",
  CONFLICT: "A conflicting record already exists.",
  VALIDATION_ERROR: "Please correct the highlighted form errors and try again.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  NETWORK_ERROR: "Network connection lost. Please check your internet connection.",
  TIMEOUT: "The server took too long to respond. Please try again.",
  DATABASE_ERROR: "A database error occurred. Your changes were safely rolled back.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again or contact support.",
};

const DEFAULT_STATUS_CODES: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  NETWORK_ERROR: 503,
  TIMEOUT: 504,
  DATABASE_ERROR: 500,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details?: unknown;
  readonly timestamp: string;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode || DEFAULT_STATUS_CODES[options.code] || 500;
    this.userMessage = options.userMessage || DEFAULT_USER_MESSAGES[options.code];
    this.retryable = options.retryable ?? (this.statusCode >= 500 || this.code === "NETWORK_ERROR" || this.code === "TIMEOUT");
    this.details = options.details;
    this.cause = options.cause;
    this.timestamp = new Date().toISOString();

    // Maintain V8 stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  // Static Factory Methods
  static badRequest(message: string, userMessage?: string, details?: unknown): AppError {
    return new AppError({
      code: "BAD_REQUEST",
      message,
      userMessage,
      statusCode: 400,
      retryable: false,
      details,
    });
  }

  static unauthorized(message = "Unauthorized authentication required", userMessage?: string): AppError {
    return new AppError({
      code: "UNAUTHORIZED",
      message,
      userMessage,
      statusCode: 401,
      retryable: false,
    });
  }

  static forbidden(message = "Access forbidden", userMessage?: string): AppError {
    return new AppError({
      code: "FORBIDDEN",
      message,
      userMessage,
      statusCode: 403,
      retryable: false,
    });
  }

  static notFound(resource: string, identifier?: string): AppError {
    const detail = identifier ? ` with ID '${identifier}'` : "";
    return new AppError({
      code: "NOT_FOUND",
      message: `${resource}${detail} not found`,
      userMessage: `The requested ${resource.toLowerCase()} was not found.`,
      statusCode: 404,
      retryable: false,
    });
  }

  static conflict(message: string, userMessage?: string): AppError {
    return new AppError({
      code: "CONFLICT",
      message,
      userMessage,
      statusCode: 409,
      retryable: false,
    });
  }

  static validation(message: string, details?: unknown, userMessage?: string): AppError {
    return new AppError({
      code: "VALIDATION_ERROR",
      message,
      userMessage: userMessage || "Please check your input values.",
      statusCode: 422,
      retryable: false,
      details,
    });
  }

  static network(message = "Network connection failed", retryable = true, cause?: unknown): AppError {
    return new AppError({
      code: "NETWORK_ERROR",
      message,
      statusCode: 503,
      retryable,
      cause,
    });
  }

  static timeout(message = "Request timed out", retryable = true): AppError {
    return new AppError({
      code: "TIMEOUT",
      message,
      statusCode: 504,
      retryable,
    });
  }

  static database(message: string, cause?: unknown): AppError {
    return new AppError({
      code: "DATABASE_ERROR",
      message,
      statusCode: 500,
      retryable: true,
      cause,
    });
  }

  static internal(message = "Internal application error", cause?: unknown): AppError {
    return new AppError({
      code: "INTERNAL_ERROR",
      message,
      statusCode: 500,
      retryable: true,
      cause,
    });
  }

  /**
   * Safely wraps any caught exception into an AppError
   */
  static from(err: unknown, fallbackMessage = "An unexpected error occurred"): AppError {
    if (err instanceof AppError) {
      return err;
    }

    if (err instanceof Error) {
      // Check for common error signatures
      const msg = err.message.toLowerCase();
      if (msg.includes("unauthorized") || msg.includes("authentication required")) {
        return AppError.unauthorized(err.message);
      }
      if (msg.includes("forbidden") || msg.includes("permission denied")) {
        return AppError.forbidden(err.message);
      }
      if (msg.includes("not found")) {
        return AppError.notFound("Resource");
      }
      if (msg.includes("network") || msg.includes("fetch failed") || msg.includes("econnrefused")) {
        return AppError.network(err.message, true, err);
      }
      return AppError.internal(err.message, err);
    }

    return AppError.internal(typeof err === "string" ? err : fallbackMessage, err);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      retryable: this.retryable,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Extracts a safe, friendly user message from any error object
 */
export function toUserMessage(error: unknown, fallback = "An unexpected error occurred. Please try again."): string {
  if (!error) return fallback;

  if (isAppError(error)) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    // If it's a standard error with a simple friendly message, use it if appropriate
    const msg = error.message;
    if (msg && !msg.includes("at ") && !msg.includes("Error:") && !msg.includes("Object.")) {
      return msg;
    }
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "error" in error && typeof (error as any).error === "string") {
    return (error as any).error;
  }

  return fallback;
}
