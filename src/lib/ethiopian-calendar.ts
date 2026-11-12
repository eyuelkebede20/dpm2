/**
 * Ethiopian Calendar Module (JDN Integer Arithmetic)
 *
 * Implements bidirectional conversion between Ethiopian Calendar (EC)
 * and ISO 8601 Gregorian Calendar (GC).
 *
 * Mathematical constants:
 * ETH_EPOCH_JDN = 1724221 (1 Meskerem 1 EC)
 * OFFSET        = 1723856 (used by jdnToEth inverse)
 * UNIX_EPOCH_JDN = 2440588 (1970-01-01 Gregorian)
 */

export interface EthiopianDate {
  year: number;
  month: number;
  day: number;
}

export interface DateRange {
  from: string; // ISO YYYY-MM-DD
  to: string;   // ISO YYYY-MM-DD
}

export const ETH_EPOCH_JDN = 1724221;
export const OFFSET = 1723856;
export const UNIX_EPOCH_JDN = 2440588;

export const ETH_MONTH_NAMES_AM = [
  "",
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜ",
] as const;

export const ETH_MONTH_NAMES_EN = [
  "",
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miazia",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
] as const;

export const ETH_WEEKDAYS_AM = [
  "እሁድ",
  "ሰኞ",
  "ማክሰኞ",
  "ረቡዕ",
  "ሐሙስ",
  "አርብ",
  "ቅዳሜ",
] as const;

export const ETH_WEEKDAYS_EN = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/**
 * Check if Ethiopian year is a leap year (Pagume has 6 days).
 * (year % 4 === 3)
 */
export function isLeapEth(year: number): boolean {
  if (!Number.isInteger(year) || year < 1) {
    throw new Error(`Invalid Ethiopian year: ${year}`);
  }
  return year % 4 === 3;
}

/**
 * Returns number of days in an Ethiopian month.
 * Months 1–12 have 30 days.
 * Month 13 (Pagume) has 5 days (6 in a leap year).
 */
export function daysInMonthEth(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 13) {
    throw new Error(`Invalid Ethiopian month: ${month}. Must be 1 to 13.`);
  }
  if (month < 13) {
    return 30;
  }
  return isLeapEth(year) ? 6 : 5;
}

/**
 * Validate an Ethiopian date. Throws error if invalid.
 */
export function validateEthDate(year: number, month: number, day: number): void {
  if (!Number.isInteger(year) || year < 1) {
    throw new Error(`Invalid Ethiopian year: ${year}. Must be >= 1.`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 13) {
    throw new Error(`Invalid Ethiopian month: ${month}. Must be between 1 and 13.`);
  }
  const maxDays = daysInMonthEth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDays) {
    throw new Error(
      `Invalid Ethiopian day: ${day} for year ${year}, month ${month}. Must be between 1 and ${maxDays}.`
    );
  }
}

/**
 * Convert Ethiopian date (Y, M, D) to Julian Day Number (JDN).
 */
export function ethToJdn(year: number, month: number, day: number): number {
  validateEthDate(year, month, day);
  return (
    ETH_EPOCH_JDN +
    365 * (year - 1) +
    Math.floor(year / 4) +
    30 * (month - 1) +
    (day - 1)
  );
}

/**
 * Convert Julian Day Number (JDN) to Ethiopian date.
 */
export function jdnToEth(jdn: number): EthiopianDate {
  if (!Number.isInteger(jdn) || jdn < ETH_EPOCH_JDN) {
    throw new Error(`JDN must be >= Ethiopian epoch (${ETH_EPOCH_JDN}). Received: ${jdn}`);
  }
  const diff = jdn - OFFSET;
  const q = Math.floor(diff / 1461);
  const r = ((diff % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * q + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;

  validateEthDate(year, month, day);
  return { year, month, day };
}

/**
 * Convert UTC Gregorian date string ("YYYY-MM-DD") or Date to JDN.
 */
export function gregorianToJdn(gregorian: string | Date): number {
  let utcDays: number;
  if (typeof gregorian === "string") {
    const parts = gregorian.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      throw new Error(`Invalid Gregorian date format. Expected YYYY-MM-DD, received: ${gregorian}`);
    }
    const [gy, gm, gd] = parts;
    const ms = Date.UTC(gy, gm - 1, gd);
    utcDays = Math.floor(ms / 86400000);
  } else {
    const ms = Date.UTC(
      gregorian.getUTCFullYear(),
      gregorian.getUTCMonth(),
      gregorian.getUTCDate()
    );
    utcDays = Math.floor(ms / 86400000);
  }
  return utcDays + UNIX_EPOCH_JDN;
}

/**
 * Convert JDN to UTC Gregorian date string ("YYYY-MM-DD").
 */
export function jdnToGregorian(jdn: number): string {
  const utcDays = jdn - UNIX_EPOCH_JDN;
  const ms = utcDays * 86400000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert Ethiopian date to Gregorian date string ("YYYY-MM-DD").
 */
export function ethToGregorian(year: number, month: number, day: number): string {
  const jdn = ethToJdn(year, month, day);
  return jdnToGregorian(jdn);
}

/**
 * Convert Gregorian date string or Date to Ethiopian date.
 */
export function gregorianToEth(gregorian: string | Date): EthiopianDate {
  const jdn = gregorianToJdn(gregorian);
  return jdnToEth(jdn);
}

/**
 * Format an Ethiopian date for UI display.
 */
export function formatEthDate(
  date: EthiopianDate,
  format: "iso" | "full_am" | "full_en" | "short" | "short_am" = "full_en"
): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  if (format === "iso") {
    return `${date.year}-${mm}-${dd}`;
  }
  if (format === "full_am") {
    return `${ETH_MONTH_NAMES_AM[date.month]} ${date.day} ቀን ${date.year} ዓ.ም`;
  }
  if (format === "short_am") {
    return `${ETH_MONTH_NAMES_AM[date.month]} ${date.day}, ${date.year}`;
  }
  if (format === "short") {
    return `${ETH_MONTH_NAMES_EN[date.month]} ${date.day}, ${date.year}`;
  }
  return `${ETH_MONTH_NAMES_EN[date.month]} ${date.day}, ${date.year} EC`;
}

/**
 * Get Gregorian [from, to] date range for a given Ethiopian month.
 */
export function getEthiopianMonthRange(year: number, month: number): DateRange {
  const days = daysInMonthEth(year, month);
  return {
    from: ethToGregorian(year, month, 1),
    to: ethToGregorian(year, month, days),
  };
}

/**
 * Day of week for an Ethiopian date (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 */
export function getEthDayOfWeek(year: number, month: number, day: number): number {
  const jdn = ethToJdn(year, month, day);
  // In JDN, (jdn + 1) % 7 maps to 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return (jdn + 1) % 7;
}
