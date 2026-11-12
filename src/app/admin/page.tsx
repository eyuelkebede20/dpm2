import { requireAuthPage } from "@/lib/authz";
import {
  getIndustryProfile,
  getOperationManagers,
  getAllUsersForAdmin,
} from "@/actions/admin-actions";
import { getAllServerEndpointsForAdminAction } from "@/actions/server-endpoint-actions";
import { AdminClient } from "./admin-client";
import { PageContainer } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAuthPage(["sys_admin"]);

  const profile = await getIndustryProfile();
  const oms = await getOperationManagers();
  const allUsers = await getAllUsersForAdmin();
  const serverEndpoints = await getAllServerEndpointsForAdminAction();

  const isDevImpersonationEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_IMPERSONATION === "true";

  return (
    <PageContainer className="min-h-[calc(100vh-4rem)]">
      <div className="mb-6 sm:mb-8 pb-5 border-b border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="badge badge-sm font-mono text-[10px] tracking-wider uppercase bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                Sys Admin Portal
              </span>
              <span className="text-xs text-slate-400 font-medium font-mono hidden sm:inline">
                /admin
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-baseline gap-2 flex-wrap">
              <span>System Administration</span>
              <span className="text-base sm:text-lg font-semibold text-slate-500 leading-normal">
                (የስርዓት አስተዳደር)
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed max-w-3xl">
              Manage system configurations, factory executives, and user provisioning{" "}
              <span className="text-slate-400 font-normal">
                (የስርዓት ውቅሮች፣ የአስተዳዳሪዎች እና የተጠቃሚዎች ሚና አስተዳደር)
              </span>
            </p>
          </div>
        </div>
      </div>

      <AdminClient
        initialProfile={{
          id: profile.id,
          companyName: profile.companyName,
          workingDays: (profile.workingDays as number[]) || [1, 2, 3, 4, 5, 6],
          units: profile.units,
          calendarSystem: (profile.calendarSystem as "ethiopian" | "gregorian") || "ethiopian",
        }}
        initialOms={oms}
        initialUsers={allUsers}
        initialServerEndpoints={serverEndpoints}
        currentUserId={user.id}
        isDevImpersonationEnabled={isDevImpersonationEnabled}
      />
    </PageContainer>
  );
}
