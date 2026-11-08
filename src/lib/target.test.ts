import { describe, it, expect } from "vitest";
import {
  isWorkingDay,
  countWorkingDays,
  calculateDailyTarget,
  calculateVariance,
  SpecialDayInput,
} from "./target";

describe("target.ts - Daily target and variance calculations", () => {
  describe("isWorkingDay", () => {
    it("recognizes weekdays and Saturday as working days by default (Sunday off)", () => {
      // 2026-11-08 is a Sunday
      expect(isWorkingDay("2026-11-08")).toBe(false);
      // 2026-11-09 is Monday
      expect(isWorkingDay("2026-11-09")).toBe(true);
      // 2026-11-14 is Saturday
      expect(isWorkingDay("2026-11-14")).toBe(true);
    });

    it("supports custom working days (e.g. 5-day work week Mon-Fri)", () => {
      const monToFri = [1, 2, 3, 4, 5];
      // 2026-11-14 is Saturday
      expect(isWorkingDay("2026-11-14", monToFri)).toBe(false);
      // 2026-11-13 is Friday
      expect(isWorkingDay("2026-11-13", monToFri)).toBe(true);
    });

    it("respects special non-working days (holidays on normally working days)", () => {
      // 2026-03-02 is Monday (Adwa Victory Day)
      const specialDays: SpecialDayInput[] = [
        {
          date: "2026-03-02",
          isWorkingDay: false,
          nameEn: "Adwa Victory Day",
          nameAm: "የዓድዋ ድል በዓል",
        },
      ];
      expect(isWorkingDay("2026-03-02", undefined, specialDays)).toBe(false);
      // 2026-03-03 is Tuesday (not a special day, normal working day)
      expect(isWorkingDay("2026-03-03", undefined, specialDays)).toBe(true);
    });

    it("respects special working days (e.g. Sunday designated as working day)", () => {
      // 2026-11-08 is Sunday (normally off)
      const specialDays: SpecialDayInput[] = [
        {
          date: "2026-11-08",
          isWorkingDay: true,
          nameEn: "Overtime Catch-up Sunday",
        },
      ];
      expect(isWorkingDay("2026-11-08", undefined, specialDays)).toBe(true);
      // 2026-11-15 is another Sunday (not special, stays off)
      expect(isWorkingDay("2026-11-15", undefined, specialDays)).toBe(false);
    });
  });

  describe("countWorkingDays", () => {
    it("counts working days correctly excluding Sundays in a week", () => {
      // Monday Nov 9, 2026 to Sunday Nov 15, 2026 (7 days total, 6 working days)
      const count = countWorkingDays("2026-11-09", "2026-11-15");
      expect(count).toBe(6);
    });

    it("returns 0 if start date is after end date", () => {
      expect(countWorkingDays("2026-11-15", "2026-11-09")).toBe(0);
    });

    it("accurately calculates a full month working days", () => {
      // November 2026: 30 days. Sundays in Nov 2026: 1, 8, 15, 22, 29 (5 Sundays)
      // Total working days = 30 - 5 = 25
      const count = countWorkingDays("2026-11-01", "2026-11-30");
      expect(count).toBe(25);
    });

    it("excludes special holidays from working days count", () => {
      // Nov 9, 2026 to Nov 15, 2026: normally 6 working days
      const specialDays: SpecialDayInput[] = [
        {
          date: "2026-11-10", // Tuesday off
          isWorkingDay: false,
          nameEn: "Special Holiday",
        },
        {
          date: "2026-11-12", // Thursday off
          isWorkingDay: false,
          nameEn: "Special Holiday 2",
        },
      ];
      const count = countWorkingDays("2026-11-09", "2026-11-15", undefined, specialDays);
      expect(count).toBe(4); // 6 - 2 = 4
    });

    it("includes special working days on weekend in working days count", () => {
      // Nov 9, 2026 to Nov 15, 2026: normally 6 working days
      const specialDays: SpecialDayInput[] = [
        {
          date: "2026-11-15", // Sunday worked
          isWorkingDay: true,
          nameEn: "Working Sunday",
        },
      ];
      const count = countWorkingDays("2026-11-09", "2026-11-15", undefined, specialDays);
      expect(count).toBe(7); // 6 + 1 = 7
    });
  });

  describe("calculateDailyTarget", () => {
    const novPlan = {
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      plannedQty: 2500, // 25 working days in Nov 2026 -> exactly 100/day
    };

    it("calculates daily target for a working day within plan range", () => {
      const res = calculateDailyTarget(novPlan, "2026-11-09"); // Monday
      expect(res.hasTarget).toBe(true);
      expect(res.dailyTarget).toBe(100);
      expect(res.displayTarget).toBe(100);
      expect(res.totalWorkingDays).toBe(25);
    });

    it("returns no target on non-working days (Sunday)", () => {
      const res = calculateDailyTarget(novPlan, "2026-11-08"); // Sunday
      expect(res.hasTarget).toBe(false);
      expect(res.reason).toBe("non_working_day");
    });

    it("returns no target when date is a special holiday (e.g. Adwa Victory Day on Tuesday)", () => {
      const marchPlan = {
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        plannedQty: 2600,
      };
      const specialDays: SpecialDayInput[] = [
        {
          date: "2026-03-02", // Monday/Tuesday holiday
          isWorkingDay: false,
          nameEn: "Adwa Victory Day",
          nameAm: "የዓድዋ ድል በዓል",
        },
      ];

      const res = calculateDailyTarget(marchPlan, "2026-03-02", undefined, specialDays);
      expect(res.hasTarget).toBe(false);
      expect(res.dailyTarget).toBe(0);
      expect(res.displayTarget).toBe(0);
      expect(res.isWorkingDay).toBe(false);
      expect(res.totalWorkingDays).toBe(0);
      expect(res.reason).toBe("special_non_working_day");
      expect(res.holidayName).toBe("Adwa Victory Day");
    });

    it("correctly distributes planned quantity across actual working days excluding special off-days", () => {
      // Nov 2026 normally has 25 working days.
      // With 1 special off-day on Nov 10, total working days = 24.
      // plannedQty = 2400 -> daily target = 2400 / 24 = 100.
      const plan = {
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 2400,
      };
      const specialDays: SpecialDayInput[] = [
        {
          date: "2026-11-10",
          isWorkingDay: false,
          nameEn: "Special Off Day",
        },
      ];

      const res = calculateDailyTarget(plan, "2026-11-09", undefined, specialDays); // Monday
      expect(res.hasTarget).toBe(true);
      expect(res.isWorkingDay).toBe(true);
      expect(res.totalWorkingDays).toBe(24);
      expect(res.dailyTarget).toBe(100);
      expect(res.displayTarget).toBe(100);
    });

    it("allows target on a weekend day if designated as a special working day", () => {
      const specialDays: SpecialDayInput[] = [
        {
          date: "2026-11-08", // Sunday
          isWorkingDay: true,
          nameEn: "Special Shift Sunday",
        },
      ];

      // Nov 2026 normally 25 working days + 1 Sunday = 26 working days
      const plan = {
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 2600,
      };

      const res = calculateDailyTarget(plan, "2026-11-08", undefined, specialDays);
      expect(res.hasTarget).toBe(true);
      expect(res.isWorkingDay).toBe(true);
      expect(res.totalWorkingDays).toBe(26);
      expect(res.dailyTarget).toBe(100);
      expect(res.displayTarget).toBe(100);
    });

    it("returns no target when date is outside plan period", () => {
      const res = calculateDailyTarget(novPlan, "2026-12-01");
      expect(res.hasTarget).toBe(false);
      expect(res.reason).toBe("out_of_range");
    });

    it("returns no target when plan is null or undefined", () => {
      const res = calculateDailyTarget(null, "2026-11-09");
      expect(res.hasTarget).toBe(false);
      expect(res.reason).toBe("no_plan");
    });

    it("keeps exact decimals in dailyTarget while displayTarget is rounded", () => {
      const unevenPlan = {
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        plannedQty: 1000, // 1000 / 25 = 40
      };
      const plan3 = {
        startDate: "2026-11-09",
        endDate: "2026-11-15",
        plannedQty: 100, // 6 working days: 100 / 6 = 16.666666...
      };
      const res = calculateDailyTarget(plan3, "2026-11-09");
      expect(res.hasTarget).toBe(true);
      expect(res.dailyTarget).toBeCloseTo(16.6667, 3);
      expect(res.displayTarget).toBe(17);
    });
  });

  describe("calculateVariance", () => {
    it("computes positive variance formatted with +", () => {
      const var1 = calculateVariance(112, 100);
      expect(var1.variance).toBe(12);
      expect(var1.varianceFormatted).toBe("+12");
      expect(var1.percentOfTarget).toBe(112);
      expect(var1.isPositive).toBe(true);
    });

    it("computes negative variance formatted with -", () => {
      const var2 = calculateVariance(92, 100);
      expect(var2.variance).toBe(-8);
      expect(var2.varianceFormatted).toBe("-8");
      expect(var2.percentOfTarget).toBe(92);
      expect(var2.isPositive).toBe(false);
    });

    it("computes zero variance", () => {
      const var3 = calculateVariance(100, 100);
      expect(var3.variance).toBe(0);
      expect(var3.varianceFormatted).toBe("0");
      expect(var3.percentOfTarget).toBe(100);
      expect(var3.isPositive).toBe(true);
    });
  });
});
