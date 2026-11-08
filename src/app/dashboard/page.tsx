import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getCurrentUserContext } from "@/actions/data";
import {
  getSysAdminDashboardData,
  getOMDashboardData,
  getFMDashboardData,
  getQADashboardData,
} from "@/actions/dashboard-actions";
import { getFMFactory } from "@/actions/fm-actions";
import { DashboardView } from "./dashboard-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const context = await getCurrentUserContext();

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  let adminData;
  let omData;
  let fmData;
  let qaData;
  let factoryName: string | undefined;

  if (user.role === "sys_admin") {
    adminData = await getSysAdminDashboardData();
  } else if (user.role === "om") {
    omData = await getOMDashboardData(user.id);
  } else if (user.role === "fm") {
    try {
      const factory = await getFMFactory();
      factoryName = factory.name;
      fmData = await getFMDashboardData(factory.id);
    } catch (e) {
      console.error("Failed to load FM factory data", e);
    }
  } else if (user.role === "qa") {
    qaData = await getQADashboardData(user.id);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardView
        user={user}
        adminData={adminData}
        omData={omData}
        fmData={fmData}
        qaData={qaData}
        factoryName={factoryName}
        calendarSystem={(context.industryProfile as any)?.calendarSystem || "ethiopian"}
      />
    </div>
  );
}
