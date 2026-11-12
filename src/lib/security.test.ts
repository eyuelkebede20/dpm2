import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sanitizeString,
  validatePasswordStrength,
  maskEmail,
  logSecurityEvent,
} from "./security";

describe("Security Utilities - Input Sanitization & Password Policies", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("sanitizeString", () => {
    it("strips script tags and executable JavaScript from text", () => {
      const malicious = "<script>alert('XSS')</script>Machine 1 broke down";
      const sanitized = sanitizeString(malicious);
      expect(sanitized).toBe("Machine 1 broke down");
      expect(sanitized).not.toContain("<script>");
    });

    it("strips inline event handlers like onerror and onclick", () => {
      const payload = `<img src=x onerror=alert('hack') />Conveyor belt jammed`;
      const sanitized = sanitizeString(payload);
      expect(sanitized).toBe("Conveyor belt jammed");
    });

    it("preserves legitimate Ethiopian Amharic script and punctuation", () => {
      const amharicText = "የማሽን ብልሽት እና ሜካኒካል ችግር - Line 01 (OK)";
      const sanitized = sanitizeString(amharicText);
      expect(sanitized).toBe(amharicText);
    });

    it("handles non-string values gracefully", () => {
      expect(sanitizeString(null)).toBe("");
      expect(sanitizeString(undefined)).toBe("");
      expect(sanitizeString(12345)).toBe("");
    });
  });

  describe("validatePasswordStrength", () => {
    it("rejects passwords shorter than 12 characters", () => {
      const res = validatePasswordStrength("Short1!a");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("at least 12 characters");
    });

    it("rejects passwords without uppercase letters", () => {
      const res = validatePasswordStrength("weakpass123!@#");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("uppercase letter");
    });

    it("rejects passwords without special symbols", () => {
      const res = validatePasswordStrength("StrongPassword123");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("special character");
    });

    it("approves strong passwords satisfying all OWASP criteria", () => {
      const res = validatePasswordStrength("Admin@Dpm2026Secure!");
      expect(res.valid).toBe(true);
      expect(res.reason).toBeUndefined();
    });
  });

  describe("maskEmail", () => {
    it("masks email local part preserving domain for privacy", () => {
      expect(maskEmail("solomon.tadesse@dpm.local")).toBe("s***e@dpm.local");
      expect(maskEmail("fm@factory.com")).toBe("f*@factory.com");
      expect(maskEmail("invalid-email")).toBe("***");
    });
  });

  describe("logSecurityEvent", () => {
    it("outputs structured security log without throwing", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logSecurityEvent({
        event: "AUTH_FAILURE",
        ip: "192.168.1.100",
        endpoint: "/api/auth/sign-in",
        details: { reason: "Invalid credentials" },
      });

      expect(spy).toHaveBeenCalled();
      const logCall = spy.mock.calls[0][0];
      expect(logCall).toContain("[SECURITY_AUDIT]");
      expect(logCall).toContain("AUTH_FAILURE");
      expect(logCall).toContain("192.168.1.100");
    });
  });
});
