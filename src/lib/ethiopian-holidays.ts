/**
 * Ethiopian National & Public Holidays Engine
 *
 * Implements standard Ethiopian public holidays calculation for any Gregorian year,
 * combining astronomical/calendar-aligned Ethiopian dates, Orthodox Paschal
 * computations (Siklet and Fasika), and lunar Islamic holiday mappings.
 */

import { ethToGregorian } from "./ethiopian-calendar";

export interface EthiopianHolidayDefinition {
  date: string; // YYYY-MM-DD
  nameEn: string;
  nameAm: string;
  type: "holiday" | "shutdown" | "custom";
  isWorkingDay: boolean;
  year: number;
}

/**
 * Verified Paschal lookup map for Orthodox Good Friday (Siklet) & Easter Sunday (Fasika)
 * for Gregorian years 2024 through 2035.
 */
export const ORTHODOX_PASCHAL_MAP: Record<number, { siklet: string; fasika: string }> = {
  2024: { siklet: "2024-05-03", fasika: "2024-05-05" },
  2025: { siklet: "2025-04-18", fasika: "2025-04-20" },
  2026: { siklet: "2026-04-10", fasika: "2026-04-12" },
  2027: { siklet: "2027-04-30", fasika: "2027-05-02" },
  2028: { siklet: "2028-04-14", fasika: "2028-04-16" },
  2029: { siklet: "2029-04-06", fasika: "2029-04-08" },
  2030: { siklet: "2030-04-26", fasika: "2030-04-28" },
  2031: { siklet: "2031-04-11", fasika: "2031-04-13" },
  2032: { siklet: "2032-04-30", fasika: "2032-05-02" },
  2033: { siklet: "2033-04-22", fasika: "2033-04-24" },
  2034: { siklet: "2034-04-07", fasika: "2034-04-09" },
  2035: { siklet: "2035-04-27", fasika: "2035-04-29" },
};

/**
 * Calculates Orthodox Easter (Fasika) and Good Friday (Siklet) using the Meeus/Gauss
 * Julian Easter algorithm with the 13-day Gregorian adjustment (valid 1900-2099).
 */
export function calculateOrthodoxEaster(year: number): { siklet: string; fasika: string } {
  if (ORTHODOX_PASCHAL_MAP[year]) {
    return ORTHODOX_PASCHAL_MAP[year];
  }
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31);
  const julianDay = ((d + e + 114) % 31) + 1;

  // Convert Julian date to Gregorian (13 days offset in 20th and 21st centuries)
  const easterUtcMs = Date.UTC(year, julianMonth - 1, julianDay + 13);
  const easterDate = new Date(easterUtcMs);
  const goodFridayDate = new Date(easterUtcMs - 2 * 86400000);

  const fasika = easterDate.toISOString().split("T")[0];
  const siklet = goodFridayDate.toISOString().split("T")[0];

  return { siklet, fasika };
}

/**
 * Official Islamic holiday projections for Ethiopia (years 2024 through 2035).
 * Eid al-Fitr, Eid al-Adha (Arefa), and Mawlid (Prophet's Birthday).
 */
export interface IslamicHolidayMapEntry {
  eidAlFitr: string | string[];
  eidAlAdha: string;
  mawlid: string;
}

export const ISLAMIC_HOLIDAYS_MAP: Record<number, IslamicHolidayMapEntry> = {
  2024: {
    eidAlFitr: "2024-04-10",
    eidAlAdha: "2024-06-17",
    mawlid: "2024-09-16",
  },
  2025: {
    eidAlFitr: "2025-03-31",
    eidAlAdha: "2025-06-06",
    mawlid: "2025-09-04",
  },
  2026: {
    eidAlFitr: "2026-03-20",
    eidAlAdha: "2026-05-27",
    mawlid: "2026-08-25",
  },
  2027: {
    eidAlFitr: "2027-03-10",
    eidAlAdha: "2027-05-17",
    mawlid: "2027-08-15",
  },
  2028: {
    eidAlFitr: "2028-02-26",
    eidAlAdha: "2028-05-05",
    mawlid: "2028-08-03",
  },
  2029: {
    eidAlFitr: "2029-02-14",
    eidAlAdha: "2029-04-24",
    mawlid: "2029-07-24",
  },
  2030: {
    eidAlFitr: "2030-02-04",
    eidAlAdha: "2030-04-13",
    mawlid: "2030-07-13",
  },
  2031: {
    eidAlFitr: "2031-01-24",
    eidAlAdha: "2031-04-03",
    mawlid: "2031-07-02",
  },
  2032: {
    eidAlFitr: "2032-01-14",
    eidAlAdha: "2032-03-21",
    mawlid: "2032-06-21",
  },
  2033: {
    eidAlFitr: ["2033-01-02", "2033-12-23"],
    eidAlAdha: "2033-03-11",
    mawlid: "2033-06-09",
  },
  2034: {
    eidAlFitr: "2034-12-12",
    eidAlAdha: "2034-03-02",
    mawlid: "2034-05-30",
  },
  2035: {
    eidAlFitr: "2035-12-01",
    eidAlAdha: "2035-02-18",
    mawlid: "2035-05-20",
  },
};

/**
 * Returns all Ethiopian public holidays for a given Gregorian year.
 *
 * Supported holidays:
 * - Genna (Ethiopian Christmas): Jan 7
 * - Timkat (Epiphany): Jan 19 (or Jan 20 on leap year cycles)
 * - Adwa Victory Day: Mar 2
 * - Siklet (Orthodox Good Friday): Paschal calculation
 * - Fasika (Orthodox Easter): Paschal calculation
 * - Patriots Victory Day: May 5
 * - Downfall of Derg: May 28
 * - Eid al-Fitr: Islamic calendar mapping
 * - Eid al-Adha: Islamic calendar mapping
 * - Mawlid: Islamic calendar mapping
 * - Enkutatash (Ethiopian New Year): Sep 11 (or Sep 12 on leap years)
 * - Meskel (Finding of True Cross): Sep 27 (or Sep 28 on leap years)
 */
export function getEthiopianHolidaysForYear(gregorianYear: number): EthiopianHolidayDefinition[] {
  const holidays: EthiopianHolidayDefinition[] = [];

  // Helper to push a holiday
  const addHoliday = (date: string, nameEn: string, nameAm: string) => {
    holidays.push({
      date,
      nameEn,
      nameAm,
      type: "holiday",
      isWorkingDay: false,
      year: gregorianYear,
    });
  };

  // 1. Genna (Ethiopian Christmas): January 7
  addHoliday(`${gregorianYear}-01-07`, "Genna (Ethiopian Christmas)", "ገና");

  // 2. Timkat (Epiphany): Tir 11 EC
  // In January of gregorianYear, the Ethiopian year is (gregorianYear - 8)
  const timkatDate = ethToGregorian(gregorianYear - 8, 5, 11);
  addHoliday(timkatDate, "Timkat (Epiphany)", "ጥምቀት");

  // 3. Adwa Victory Day: March 2
  addHoliday(`${gregorianYear}-03-02`, "Adwa Victory Day", "የዓድዋ ድል በዓል");

  // 4. Orthodox Paschal Cycle: Siklet (Good Friday) & Fasika (Easter Sunday)
  const { siklet, fasika } = calculateOrthodoxEaster(gregorianYear);
  addHoliday(siklet, "Siklet (Good Friday)", "ስቅለት");
  addHoliday(fasika, "Fasika (Easter Sunday)", "ፋሲካ");

  // 5. Patriots Victory Day: May 5
  addHoliday(`${gregorianYear}-05-05`, "Patriots Victory Day", "የአርበኞች ድል በዓል");

  // 6. Downfall of Derg: May 28
  addHoliday(`${gregorianYear}-05-28`, "Downfall of Derg", "ደርግ የወደቀበት");

  // 7. Enkutatash (Ethiopian New Year): Meskerem 1 EC
  // In September of gregorianYear, the Ethiopian year starting is (gregorianYear - 7)
  const enkutatashDate = ethToGregorian(gregorianYear - 7, 1, 1);
  addHoliday(enkutatashDate, "Enkutatash (Ethiopian New Year)", "እንቁጣጣሽ");

  // 8. Meskel (Finding of True Cross): Meskerem 17 EC
  const meskelDate = ethToGregorian(gregorianYear - 7, 1, 17);
  addHoliday(meskelDate, "Meskel (Finding of True Cross)", "መስቀል");

  // 9. Islamic Holidays (Eid al-Fitr, Eid al-Adha, Mawlid)
  const islamicHolidays = ISLAMIC_HOLIDAYS_MAP[gregorianYear];
  if (islamicHolidays) {
    // Eid al-Fitr (can have 2 dates in rare lunar cycle years e.g. 2033)
    const fitrDates = Array.isArray(islamicHolidays.eidAlFitr)
      ? islamicHolidays.eidAlFitr
      : [islamicHolidays.eidAlFitr];
    for (const d of fitrDates) {
      addHoliday(d, "Eid al-Fitr", "ዒድ አል-ፊጥር");
    }

    // Eid al-Adha (Arefa)
    addHoliday(islamicHolidays.eidAlAdha, "Eid al-Adha (Arefa)", "ዒድ አል-አድሃ");

    // Mawlid
    addHoliday(islamicHolidays.mawlid, "Mawlid (Prophet's Birthday)", "መውሊድ");
  }

  // Sort chronologically by date
  holidays.sort((a, b) => a.date.localeCompare(b.date));

  return holidays;
}

/**
 * Check if a specific date (YYYY-MM-DD) is an Ethiopian public holiday.
 */
export function isEthiopianHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.slice(0, 4), 10);
  if (isNaN(year)) return false;
  const holidays = getEthiopianHolidaysForYear(year);
  return holidays.some((h) => h.date === dateStr);
}

/**
 * Retrieve the holiday definition for a given date (YYYY-MM-DD), if any.
 */
export function getHolidayForDate(dateStr: string): EthiopianHolidayDefinition | undefined {
  const year = parseInt(dateStr.slice(0, 4), 10);
  if (isNaN(year)) return undefined;
  const holidays = getEthiopianHolidaysForYear(year);
  return holidays.find((h) => h.date === dateStr);
}
