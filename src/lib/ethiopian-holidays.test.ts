import { describe, it, expect } from "vitest";
import {
  getEthiopianHolidaysForYear,
  isEthiopianHoliday,
  getHolidayForDate,
  calculateOrthodoxEaster,
  ORTHODOX_PASCHAL_MAP,
  ISLAMIC_HOLIDAYS_MAP,
} from "./ethiopian-holidays";

describe("Ethiopian Holidays Engine (ethiopian-holidays.ts)", () => {
  describe("Year 2026 Holiday Verification", () => {
    const holidays2026 = getEthiopianHolidaysForYear(2026);

    it("returns all 12 major public holidays for 2026", () => {
      expect(holidays2026.length).toBe(12);
    });

    it("verifies all holidays have isWorkingDay = false, type = 'holiday', and year = 2026", () => {
      for (const h of holidays2026) {
        expect(h.isWorkingDay).toBe(false);
        expect(h.type).toBe("holiday");
        expect(h.year).toBe(2026);
        expect(h.nameEn.length).toBeGreaterThan(0);
        expect(h.nameAm.length).toBeGreaterThan(0);
        expect(h.date).toMatch(/^2026-\d{2}-\d{2}$/);
      }
    });

    it("matches exact 2026 dates for all national and religious observances", () => {
      const holidayMap = new Map(holidays2026.map((h) => [h.nameAm, h.date]));

      // 1. Genna
      expect(holidayMap.get("ገና")).toBe("2026-01-07");
      // 2. Timkat
      expect(holidayMap.get("ጥምቀት")).toBe("2026-01-19");
      // 3. Adwa Victory Day
      expect(holidayMap.get("የዓድዋ ድል በዓል")).toBe("2026-03-02");
      // 4. Eid al-Fitr
      expect(holidayMap.get("ዒድ አል-ፊጥር")).toBe("2026-03-20");
      // 5. Siklet (Good Friday)
      expect(holidayMap.get("ስቅለት")).toBe("2026-04-10");
      // 6. Fasika (Easter Sunday)
      expect(holidayMap.get("ፋሲካ")).toBe("2026-04-12");
      // 7. Patriots Victory Day
      expect(holidayMap.get("የአርበኞች ድል በዓል")).toBe("2026-05-05");
      // 8. Eid al-Adha (Arefa)
      expect(holidayMap.get("ዒድ አል-አድሃ")).toBe("2026-05-27");
      // 9. Downfall of Derg
      expect(holidayMap.get("ደርግ የወደቀበት")).toBe("2026-05-28");
      // 10. Mawlid
      expect(holidayMap.get("መውሊድ")).toBe("2026-08-25");
      // 11. Enkutatash (Ethiopian New Year)
      expect(holidayMap.get("እንቁጣጣሽ")).toBe("2026-09-11");
      // 12. Meskel (Finding of True Cross)
      expect(holidayMap.get("መስቀል")).toBe("2026-09-27");
    });

    it("returns holidays in chronological order", () => {
      const dates = holidays2026.map((h) => h.date);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
    });
  });

  describe("Year 2027 Holiday Verification (Leap Year Shift)", () => {
    const holidays2027 = getEthiopianHolidaysForYear(2027);

    it("returns all 12 major public holidays for 2027", () => {
      expect(holidays2027.length).toBe(12);
    });

    it("correctly calculates leap year shifts for Enkutatash (Sep 12) and Meskel (Sep 28)", () => {
      const holidayMap = new Map(holidays2027.map((h) => [h.nameAm, h.date]));

      // 2019 EC is leap year (Pagume has 6 days) -> Meskerem 1 2020 EC is Sep 12, 2027
      expect(holidayMap.get("እንቁጣጣሽ")).toBe("2027-09-12");
      expect(holidayMap.get("መስቀል")).toBe("2027-09-28");
    });

    it("matches exact 2027 dates for all other observances", () => {
      const holidayMap = new Map(holidays2027.map((h) => [h.nameAm, h.date]));

      expect(holidayMap.get("ገና")).toBe("2027-01-07");
      expect(holidayMap.get("ጥምቀት")).toBe("2027-01-19");
      expect(holidayMap.get("የዓድዋ ድል በዓል")).toBe("2027-03-02");
      expect(holidayMap.get("ዒድ አል-ፊጥር")).toBe("2027-03-10");
      expect(holidayMap.get("ስቅለት")).toBe("2027-04-30");
      expect(holidayMap.get("ፋሲካ")).toBe("2027-05-02");
      expect(holidayMap.get("የአርበኞች ድል በዓል")).toBe("2027-05-05");
      expect(holidayMap.get("ዒድ አል-አድሃ")).toBe("2027-05-17");
      expect(holidayMap.get("ደርግ የወደቀበት")).toBe("2027-05-28");
      expect(holidayMap.get("መውሊድ")).toBe("2027-08-15");
    });
  });

  describe("Helper Functions: isEthiopianHoliday & getHolidayForDate", () => {
    it("returns true for confirmed holiday dates and false for regular work days", () => {
      // 2026-09-11 is Enkutatash
      expect(isEthiopianHoliday("2026-09-11")).toBe(true);
      // 2026-09-12 is regular day
      expect(isEthiopianHoliday("2026-09-12")).toBe(false);

      // 2027-09-12 is Enkutatash in leap year
      expect(isEthiopianHoliday("2027-09-12")).toBe(true);
      // 2027-09-11 is Pagume 6 (not public holiday)
      expect(isEthiopianHoliday("2027-09-11")).toBe(false);
    });

    it("retrieves holiday definition with details for a given date", () => {
      const adwa = getHolidayForDate("2026-03-02");
      expect(adwa).toBeDefined();
      expect(adwa?.nameEn).toBe("Adwa Victory Day");
      expect(adwa?.nameAm).toBe("የዓድዋ ድል በዓል");
      expect(adwa?.isWorkingDay).toBe(false);

      const regular = getHolidayForDate("2026-03-03");
      expect(regular).toBeUndefined();
    });

    it("gracefully handles invalid date formats", () => {
      expect(isEthiopianHoliday("invalid-date")).toBe(false);
      expect(getHolidayForDate("not-a-date")).toBeUndefined();
    });
  });

  describe("Paschal & Islamic Coverage (2024 through 2035)", () => {
    it("has Paschal calculations for all years 2024 through 2035", () => {
      for (let y = 2024; y <= 2035; y++) {
        const paschal = calculateOrthodoxEaster(y);
        expect(paschal.siklet).toMatch(new RegExp(`^${y}-`));
        expect(paschal.fasika).toMatch(new RegExp(`^${y}-`));

        // Good Friday is 2 days before Easter Sunday
        const diffDays =
          (new Date(paschal.fasika).getTime() - new Date(paschal.siklet).getTime()) /
          (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(2);
      }
    });

    it("has Islamic holiday mappings for all years 2024 through 2035", () => {
      for (let y = 2024; y <= 2035; y++) {
        const entry = ISLAMIC_HOLIDAYS_MAP[y];
        expect(entry).toBeDefined();
        expect(entry.eidAlFitr).toBeDefined();
        expect(entry.eidAlAdha).toBeDefined();
        expect(entry.mawlid).toBeDefined();
      }
    });

    it("verifies double Eid al-Fitr occurrence in year 2033", () => {
      const holidays2033 = getEthiopianHolidaysForYear(2033);
      const fitrHolidays = holidays2033.filter((h) => h.nameAm === "ዒድ አል-ፊጥር");
      expect(fitrHolidays.length).toBe(2);
      expect(fitrHolidays.map((h) => h.date)).toEqual(["2033-01-02", "2033-12-23"]);
    });
  });
});
