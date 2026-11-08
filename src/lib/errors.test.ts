import { describe, it, expect } from "vitest";
import { AppError, isAppError, toUserMessage } from "./errors";

describe("AppError Model & Error Utilities", () => {
  describe("AppError Construction & Defaults", () => {
    it("constructs an AppError with default user messages and status codes", () => {
      const err = new AppError({
        code: "UNAUTHORIZED",
        message: "Session token expired",
      });

      expect(err.name).toBe("AppError");
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Session token expired");
      expect(err.userMessage).toContain("sign in to continue");
      expect(err.retryable).toBe(false);
      expect(err.timestamp).toBeDefined();
    });

    it("allows custom overrides for userMessage, statusCode, and retryable", () => {
      const err = new AppError({
        code: "NETWORK_ERROR",
        message: "Socket closed abruptly",
        userMessage: "Connection dropped while uploading report",
        statusCode: 503,
        retryable: true,
        details: { endpoint: "/api/reports" },
      });

      expect(err.statusCode).toBe(503);
      expect(err.userMessage).toBe("Connection dropped while uploading report");
      expect(err.retryable).toBe(true);
      expect(err.details).toEqual({ endpoint: "/api/reports" });
    });

    it("serializes cleanly to JSON without leaking stack traces to clients", () => {
      const err = AppError.badRequest("Invalid date parameter", "Please select a valid working day");
      const json = err.toJSON();

      expect(json.code).toBe("BAD_REQUEST");
      expect(json.statusCode).toBe(400);
      expect(json.userMessage).toBe("Please select a valid working day");
      expect(json).not.toHaveProperty("stack");
    });
  });

  describe("Static Factory Helpers", () => {
    it("creates badRequest error", () => {
      const err = AppError.badRequest("Malformed JSON body");
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.statusCode).toBe(400);
      expect(err.retryable).toBe(false);
    });

    it("creates forbidden error", () => {
      const err = AppError.forbidden("User is not assigned to Plant 02");
      expect(err.code).toBe("FORBIDDEN");
      expect(err.statusCode).toBe(403);
    });

    it("creates notFound error with formatted identifier", () => {
      const err = AppError.notFound("Production Line", "line_hawassa_01");
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Production Line with ID 'line_hawassa_01' not found");
      expect(err.statusCode).toBe(404);
    });

    it("creates validation error with detailed field errors", () => {
      const fieldErrors = [{ field: "plannedQty", message: "Quantity must be greater than 0" }];
      const err = AppError.validation("Invalid plan quantities", fieldErrors);
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.statusCode).toBe(422);
      expect(err.details).toEqual(fieldErrors);
    });

    it("creates retryable network and timeout errors", () => {
      const netErr = AppError.network("DNS lookup failed");
      expect(netErr.code).toBe("NETWORK_ERROR");
      expect(netErr.retryable).toBe(true);

      const timeoutErr = AppError.timeout();
      expect(timeoutErr.code).toBe("TIMEOUT");
      expect(timeoutErr.statusCode).toBe(504);
      expect(timeoutErr.retryable).toBe(true);
    });

    it("creates database error with retryable true", () => {
      const dbErr = AppError.database("Unique constraint violation");
      expect(dbErr.code).toBe("DATABASE_ERROR");
      expect(dbErr.statusCode).toBe(500);
      expect(dbErr.retryable).toBe(true);
    });
  });

  describe("AppError.from() Adapter", () => {
    it("returns the exact same instance if already an AppError", () => {
      const original = AppError.forbidden("Denied");
      const result = AppError.from(original);
      expect(result).toBe(original);
    });

    it("detects unauthorized message signatures from native errors", () => {
      const native = new Error("Authentication required to access this resource");
      const adapted = AppError.from(native);
      expect(adapted.code).toBe("UNAUTHORIZED");
      expect(adapted.statusCode).toBe(401);
    });

    it("detects forbidden signatures from native errors", () => {
      const native = new Error("Permission denied: insufficient privileges");
      const adapted = AppError.from(native);
      expect(adapted.code).toBe("FORBIDDEN");
      expect(adapted.statusCode).toBe(403);
    });

    it("detects network errors from fetch failures", () => {
      const native = new Error("fetch failed: ECONNREFUSED");
      const adapted = AppError.from(native);
      expect(adapted.code).toBe("NETWORK_ERROR");
      expect(adapted.retryable).toBe(true);
    });

    it("handles non-Error objects and string throws", () => {
      const adaptedFromString = AppError.from("Service is temporarily down");
      expect(adaptedFromString.code).toBe("INTERNAL_ERROR");
      expect(adaptedFromString.message).toBe("Service is temporarily down");

      const adaptedFromUnknown = AppError.from({ foo: "bar" }, "Fallback message");
      expect(adaptedFromUnknown.message).toBe("Fallback message");
    });
  });

  describe("toUserMessage() & isAppError() Helpers", () => {
    it("identifies AppError instances with type guard", () => {
      expect(isAppError(AppError.badRequest("Test"))).toBe(true);
      expect(isAppError(new Error("Test"))).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError("string")).toBe(false);
    });

    it("extracts safe userMessage from AppError", () => {
      const err = AppError.forbidden("Hidden internal reason", "You cannot edit locked records.");
      expect(toUserMessage(err)).toBe("You cannot edit locked records.");
    });

    it("extracts clean message from simple Error object", () => {
      const err = new Error("Invalid password provided");
      expect(toUserMessage(err)).toBe("Invalid password provided");
    });

    it("extracts error field from object payloads", () => {
      expect(toUserMessage({ error: "Email already taken" })).toBe("Email already taken");
    });

    it("returns default fallback for unknown objects or undefined", () => {
      expect(toUserMessage(undefined)).toBe("An unexpected error occurred. Please try again.");
      expect(toUserMessage({})).toBe("An unexpected error occurred. Please try again.");
    });
  });
});
