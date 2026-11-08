import { requireUser } from "@/lib/authz";
import { getCurrentUserContext, getMonthCalendarSummary } from "@/actions/data";
import { CalendarClient } from "@/components/calendar/calendar-client";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import {
  gregorianToEth,
  getEthiopianMonthRange,
} from "@/lib/ethiopian-calendar";

export const dynamic = "force-dynamic";

interface CalendarPageProps {
  searchParams: Promise<{
    month?: string;
    cal?: "ethiopian" | "gregorian";
    ey?: string; // Ethiopian Year
    em?: string; // Ethiopian Month
  }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const user = await requireUser();
  const context = await getCurrentUserContext();

  if (!context.factoryId) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800">No Factory Assigned</h2>
        <p className="text-slate-500 mt-2">
          Your account is not currently associated with an active factory.
        </p>
      </div>
    );
  }

  const resolved = await searchParams;
  const today = new Date();
  const currentEth = gregorianToEth(today);

  // Default to company setting in Industry Profile (default: ethiopian), or user choice
  const companyCalSetting = (context.industryProfile as any)?.calendarSystem || "ethiopian";
  const calType = resolved.cal || companyCalSetting;

  let startDateStr: string;
  let endDateStr: string;
  let ethYear = resolved.ey ? parseInt(resolved.ey, 10) : currentEth.year;
  let ethMonth = resolved.em ? parseInt(resolved.em, 10) : currentEth.month;
  let gregMonthStr = resolved.month || format(today, "yyyy-MM");

  if (calType === "ethiopian") {
    if (isNaN(ethYear) || ethYear < 1900) ethYear = currentEth.year;
    if (isNaN(ethMonth) || ethMonth < 1 || ethMonth > 13) ethMonth = currentEth.month;
    const range = getEthiopianMonthRange(ethYear, ethMonth);
    startDateStr = range.from;
    endDateStr = range.to;
  } else {
    const monthDate = parseISO(`${gregMonthStr}-01`);
    startDateStr = format(startOfMonth(monthDate), "yyyy-MM-dd");
    endDateStr = format(endOfMonth(monthDate), "yyyy-MM-dd");
  }

  const data = await getMonthCalendarSummary(
    context.factoryId,
    startDateStr,
    endDateStr
  );

  return (
    <CalendarClient
      factoryId={context.factoryId}
      factoryName={context.factoryName || "Plant"}
      workingDays={data.workingDays}
      calendarType={calType}
      ethiopianYear={ethYear}
      ethiopianMonth={ethMonth}
      gregorianMonthStr={gregMonthStr}
      startDateStr={startDateStr}
      endDateStr={endDateStr}
      entries={data.entries}
      plans={data.plans}
    />
  );
}
