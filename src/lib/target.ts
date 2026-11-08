import { parseISO, format, addDays, isBefore, isAfter, isValid } from "date-fns";

export interface PlanTargetInput {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  plannedQty: number;
}

export interface SpecialDayInput {
  date: string; // YYYY-MM-DD
  isWorkingDay: boolean;
  nameEn?: string;
  nameAm?: string | null;
}

export interface TargetCalculationResult {
  hasTarget: boolean;
  dailyTarget: number;       // Exact number with decimals
  displayTarget: number;     // Rounded for UI display
  isWorkingDay: boolean;
  totalWorkingDays: number;
  reason?: "non_working_day" | "no_plan" | "out_of_range" | "special_non_working_day";
  holidayName?: string;
}

export interface VarianceResult {
  variance: number;
  varianceFormatted: string; // e.g. "+12", "-8", "0"
  percentOfTarget: number | null; // e.g. 115.5 (%)
  isPositive: boolean;       // >= 0
}

/**
 * Checks if a given date is a working day according to the company profile
 * and special days overrides (e.g. public holidays or special working days).
 * Default workingDays: [1, 2, 3, 4, 5, 6] (Mon-Sat, Sunday=0 off).
 */
export function isWorkingDay(
  dateInput: Date | string,
  workingDays: number[] = [1, 2, 3, 4, 5, 6],
  specialDays?: SpecialDayInput[]
): boolean {
  const d = typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
  if (!isValid(d)) return false;

  if (specialDays && specialDays.length > 0) {
    const dateStr = format(d, "yyyy-MM-dd");
    const specialDay = specialDays.find(
      (s) => s.date === dateStr || s.date.slice(0, 10) === dateStr
    );
    if (specialDay) {
      return specialDay.isWorkingDay;
    }
  }

  const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  return workingDays.includes(dayOfWeek);
}

/**
 * Counts total working days between startDate and endDate (inclusive),
 * accounting for custom working days and special day overrides.
 */
export function countWorkingDays(
  startDateInput: Date | string,
  endDateInput: Date | string,
  workingDays: number[] = [1, 2, 3, 4, 5, 6],
  specialDays?: SpecialDayInput[]
): number {
  const start = typeof startDateInput === "string" ? parseISO(startDateInput) : startDateInput;
  const end = typeof endDateInput === "string" ? parseISO(endDateInput) : endDateInput;

  if (!isValid(start) || !isValid(end)) return 0;
  if (isAfter(start, end)) return 0;

  let count = 0;
  let curr = start;

  while (!isAfter(curr, end)) {
    if (isWorkingDay(curr, workingDays, specialDays)) {
      count++;
    }
    curr = addDays(curr, 1);
  }

  return count;
}

/**
 * Pure function: calculates daily target for a line + product plan on a specific day.
 * Daily target = planned_qty ÷ number of working days in the period.
 * Days with no plan, non-working days, or special holidays show no target.
 */
export function calculateDailyTarget(
  plan: PlanTargetInput | null | undefined,
  dateInput: Date | string,
  workingDays: number[] = [1, 2, 3, 4, 5, 6],
  specialDays?: SpecialDayInput[]
): TargetCalculationResult {
  const d = typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
  if (!isValid(d)) {
    return {
      hasTarget: false,
      dailyTarget: 0,
      displayTarget: 0,
      isWorkingDay: false,
      totalWorkingDays: 0,
      reason: "out_of_range",
    };
  }

  const dateStr = format(d, "yyyy-MM-dd");

  if (specialDays && specialDays.length > 0) {
    const specialDay = specialDays.find(
      (s) => s.date === dateStr || s.date.slice(0, 10) === dateStr
    );
    if (specialDay && !specialDay.isWorkingDay) {
      return {
        hasTarget: false,
        dailyTarget: 0,
        displayTarget: 0,
        isWorkingDay: false,
        totalWorkingDays: 0,
        reason: "special_non_working_day",
        holidayName: specialDay.nameEn,
      };
    }
  }

  const working = isWorkingDay(d, workingDays, specialDays);
  if (!working) {
    return {
      hasTarget: false,
      dailyTarget: 0,
      displayTarget: 0,
      isWorkingDay: false,
      totalWorkingDays: 0,
      reason: "non_working_day",
    };
  }

  if (!plan) {
    return {
      hasTarget: false,
      dailyTarget: 0,
      displayTarget: 0,
      isWorkingDay: true,
      totalWorkingDays: 0,
      reason: "no_plan",
    };
  }

  const planStart = parseISO(plan.startDate);
  const planEnd = parseISO(plan.endDate);

  if (!isValid(planStart) || !isValid(planEnd)) {
    return {
      hasTarget: false,
      dailyTarget: 0,
      displayTarget: 0,
      isWorkingDay: true,
      totalWorkingDays: 0,
      reason: "no_plan",
    };
  }

  if (dateStr < plan.startDate || dateStr > plan.endDate) {
    return {
      hasTarget: false,
      dailyTarget: 0,
      displayTarget: 0,
      isWorkingDay: true,
      totalWorkingDays: 0,
      reason: "out_of_range",
    };
  }

  const totalWorkingDays = countWorkingDays(plan.startDate, plan.endDate, workingDays, specialDays);
  if (totalWorkingDays === 0 || plan.plannedQty <= 0) {
    return {
      hasTarget: false,
      dailyTarget: 0,
      displayTarget: 0,
      isWorkingDay: true,
      totalWorkingDays,
      reason: "no_plan",
    };
  }

  const exactDailyTarget = plan.plannedQty / totalWorkingDays;

  return {
    hasTarget: true,
    dailyTarget: exactDailyTarget,
    displayTarget: Math.round(exactDailyTarget),
    isWorkingDay: true,
    totalWorkingDays,
  };
}

/**
 * Calculates variance and percentage vs daily target.
 * Variance for a day = finished_good − daily target.
 * Returns formatted string "+12" or "−8".
 */
export function calculateVariance(
  finishedGood: number,
  dailyTarget: number
): VarianceResult {
  const diff = finishedGood - dailyTarget;
  const roundedDiff = Math.round(diff);
  const formatted =
    roundedDiff > 0 ? `+${roundedDiff}` : `${roundedDiff}`;

  const percent =
    dailyTarget > 0 ? Math.round((finishedGood / dailyTarget) * 1000) / 10 : null;

  return {
    variance: diff,
    varianceFormatted: formatted,
    percentOfTarget: percent,
    isPositive: diff >= 0,
  };
}
