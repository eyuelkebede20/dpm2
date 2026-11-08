import { requireUser } from "@/lib/authz";
import { getCurrentUserContext, getDailyGridData } from "@/actions/data";
import { DailyEntryClient } from "@/components/entry-grid/daily-entry-client";
import { redirect } from "next/navigation";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface EntryPageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function EntryPage({ searchParams }: EntryPageProps) {
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

  const resolvedSearchParams = await searchParams;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const dateStr = resolvedSearchParams.date || todayStr;

  const data = await getDailyGridData(context.factoryId, dateStr);

  return (
    <DailyEntryClient
      initialDate={dateStr}
      factoryId={context.factoryId}
      factoryName={context.factoryName || "Plant"}
      workingDays={data.workingDays}
      initialRows={data.gridRows}
      userRole={user.role}
      calendarSystem={(context.industryProfile as any)?.calendarSystem || "ethiopian"}
      specialDay={data.specialDay}
      downtimeReasons={data.downtimeReasons}
    />
  );
}
