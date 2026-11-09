import { requireAuthPage } from "@/lib/authz";
import { getCurrentUserContext, getDailyGridData } from "@/actions/data";
import { DailyEntryClient } from "@/components/entry-grid/daily-entry-client";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface EntryPageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function EntryPage({ searchParams }: EntryPageProps) {
  const user = await requireAuthPage(["fm", "om"]);
  const context = await getCurrentUserContext();

  if (!context.factoryId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="card bg-white border border-slate-200/90 shadow-2xs p-8 rounded-3xl max-w-md w-full text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
            <Building2 className="w-6 h-6 text-slate-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            No Factory Assigned
          </h2>
          <p className="text-sm text-slate-500">
            Your account is not currently associated with an active production facility.
          </p>
        </div>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  let dateStr = resolvedSearchParams.date || todayStr;

  // Disallow future dates: redirect to today if date is in the future
  if (dateStr > todayStr) {
    redirect(`/entry?date=${todayStr}`);
  }

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
