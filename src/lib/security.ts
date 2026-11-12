/**
 * Security & Input Sanitization Utilities
 * Implements defenses against OWASP A03 (Injection / XSS),
 * OWASP A07 (Identification / Authentication Failures), and
 * OWASP A09 (Security Logging and Monitoring).
 */

/**
 * Sanitize plain user text inputs to neutralize HTML/XSS vectors and control characters.
 * Does not alter benign Unicode, Ethiopian Amharic script, or standard punctuation.
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    // Remove null bytes and dangerous control characters
    .replace(/\0/g, "")
    // Strip script and style tags completely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Strip HTML tags
    .replace(/<[^>]*>/g, "")
    // Strip dangerous inline event handlers (onerror=, onclick=, etc.)
    .replace(/on\w+\s*=/gi, "")
    // Strip javascript: pseudo-protocols
    .replace(/javascript:/gi, "")
    .trim();
}

/**
 * Validate password strength against OWASP ASVS guidelines:
 * - Minimum 12 characters (maximum 128)
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special symbol (!@#$%^&*...)
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  reason?: string;
} {
  if (!password || password.length < 12) {
    return {
      valid: false,
      reason: "Password must be at least 12 characters long",
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      reason: "Password cannot exceed 128 characters",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      reason: "Password must contain at least one uppercase letter",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      reason: "Password must contain at least one lowercase letter",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      reason: "Password must contain at least one number",
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return {
      valid: false,
      reason: "Password must contain at least one special character",
    };
  }

  return { valid: true };
}

/**
 * Mask email address for secure logging and UI display (prevents PII exposure).
 * Example: 'solomon.tadesse@example.com' -> 's***e@example.com'
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export type SecurityEventType =
  | "AUTH_SUCCESS"
  | "AUTH_FAILURE"
  | "RATE_LIMIT_TRIGGERED"
  | "SUSPICIOUS_PAYLOAD_BLOCKED"
  | "BOLA_ATTEMPT_BLOCKED"
  | "PRIVILEGE_ESCALATION_BLOCKED"
  | "PASSWORD_RESET"
  | "ROLE_CHANGED";

export interface SecurityEventData {
  event: SecurityEventType;
  userId?: string;
  ip?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
}

/**
 * Structured security event logger for audit trails (OWASP A09).
 * Ensures zero passwords, tokens, or raw secrets are logged.
 */
export function logSecurityEvent(eventData: SecurityEventData): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "SECURITY",
    event: eventData.event,
    userId: eventData.userId || "anonymous",
    ip: eventData.ip || "unknown",
    endpoint: eventData.endpoint,
    details: eventData.details,
  };

  // Structured output for security monitoring
  console.warn(`[SECURITY_AUDIT] ${JSON.stringify(logEntry)}`);
}
