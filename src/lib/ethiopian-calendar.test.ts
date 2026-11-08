import { describe, it, expect } from "vitest";
import {
  ethToGregorian,
  gregorianToEth,
  ethToJdn,
  jdnToEth,
  isLeapEth,
  daysInMonthEth,
  formatEthDate,
  getEthiopianMonthRange,
  getEthDayOfWeek,
} from "./ethiopian-calendar";

describe("ethiopian-calendar.ts - Verified Golden Vectors", () => {
  const goldenVectors = [
    {
      ethiopian: { year: 2015, month: 13, day: 5 },
      gregorian: "2023-09-10",
      jdn: 2460198,
      desc: "Pagume 5 in a leap year",
    },
    {
      ethiopian: { year: 2015, month: 13, day: 6 },
      gregorian: "2023-09-11",
      jdn: 2460199,
      desc: "Pagume 6 (leap year 2015)",
    },
    {
      ethiopian: { year: 2016, month: 1, day: 1 },
      gregorian: "2023-09-12",
      jdn: 2460200,
      desc: "New year after a leap Pagume",
    },
    {
      ethiopian: { year: 2018, month: 13, day: 5 },
      gregorian: "2026-09-10",
      jdn: 2461294,
      desc: "Last day of a non-leap year",
    },
    {
      ethiopian: { year: 2019, month: 1, day: 1 },
      gregorian: "2026-09-11",
      jdn: 2461295,
      desc: "New year 2019",
    },
    {
      ethiopian: { year: 2019, month: 2, day: 3 },
      gregorian: "2026-10-13",
      jdn: 2461327,
      desc: "Mid-year sample (Tikimt 3)",
    },
    {
      ethiopian: { year: 2019, month: 13, day: 6 },
      gregorian: "2027-09-11",
      jdn: 2461660,
      desc: "Next leap Pagume 6",
    },
    {
      ethiopian: { year: 2020, month: 1, day: 1 },
      gregorian: "2027-09-12",
      jdn: 2461661,
      desc: "New year after leap",
    },
    {
      ethiopian: { year: 2020, month: 6, day: 21 },
      gregorian: "2028-02-29",
      jdn: 2461831,
      desc: "Gregorian leap day (Yekatit 21, 2020)",
    },
  ];

  goldenVectors.forEach(({ ethiopian, gregorian, jdn, desc }) => {
    it(`accurately converts ${desc} (${gregorian} <-> ${ethiopian.year}-${ethiopian.month}-${ethiopian.day})`, () => {
      // 1. Ethiopian -> JDN
      expect(ethToJdn(ethiopian.year, ethiopian.month, ethiopian.day)).toBe(jdn);

      // 2. JDN -> Ethiopian
      expect(jdnToEth(jdn)).toEqual(ethiopian);

      // 3. Ethiopian -> Gregorian string
      expect(ethToGregorian(ethiopian.year, ethiopian.month, ethiopian.day)).toBe(gregorian);

      // 4. Gregorian string -> Ethiopian
      expect(gregorianToEth(gregorian)).toEqual(ethiopian);
    });
  });

  describe("Leap year and month lengths", () => {
    it("correctly identifies leap years (year % 4 === 3)", () => {
      expect(isLeapEth(2011)).toBe(true);
      expect(isLeapEth(2012)).toBe(false);
      expect(isLeapEth(2013)).toBe(false);
      expect(isLeapEth(2014)).toBe(false);
      expect(isLeapEth(2015)).toBe(true);
      expect(isLeapEth(2018)).toBe(false);
      expect(isLeapEth(2019)).toBe(true);
    });

    it("returns 30 days for months 1-12, and 5 or 6 for Pagume", () => {
      for (let m = 1; m <= 12; m++) {
        expect(daysInMonthEth(2019, m)).toBe(30);
      }
      expect(daysInMonthEth(2018, 13)).toBe(5); // non-leap
      expect(daysInMonthEth(2019, 13)).toBe(6); // leap
    });

    it("throws on invalid dates", () => {
      expect(() => ethToGregorian(2018, 13, 6)).toThrow(); // Pagume only has 5 days in 2018
      expect(() => ethToGregorian(2019, 14, 1)).toThrow(); // Only 13 months
      expect(() => ethToGregorian(2019, 1, 31)).toThrow(); // Standard months have 30 days
    });
  });

  describe("Formatting and Day of Week", () => {
    it("formats dates in English and Amharic", () => {
      const ed = { year: 2017, month: 2, day: 29 };
      expect(formatEthDate(ed, "short")).toBe("Tikimt 29, 2017");
      expect(formatEthDate(ed, "full_am")).toBe("ጥቅምት 29 ቀን 2017 ዓ.ም");
    });

    it("computes day of week accurately", () => {
      // 2026-09-11 (1 Meskerem 2019) was Friday (day 5)
      expect(getEthDayOfWeek(2019, 1, 1)).toBe(5);
    });

    it("computes month ranges accurately", () => {
      const range = getEthiopianMonthRange(2019, 1);
      expect(range.from).toBe("2026-09-11");
      expect(range.to).toBe("2026-10-10");
    });
  });
});
