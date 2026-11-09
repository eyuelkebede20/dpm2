import { requireAuthPage } from "@/lib/authz";
import {
  getIndustryProfile,
  getOperationManagers,
  getAllUsersForAdmin,
} from "@/actions/admin-actions";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAuthPage(["sys_admin"]);

  const profile = await getIndustryProfile();
  const oms = await getOperationManagers();
  const allUsers = await getAllUsersForAdmin();

  const isDevImpersonationEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_IMPERSONATION === "true";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          System Administration
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage system configurations, factory executives, and user provisioning
        </p>
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
        currentUserId={user.id}
        isDevImpersonationEnabled={isDevImpersonationEnabled}
      />
    </div>
  );
}
