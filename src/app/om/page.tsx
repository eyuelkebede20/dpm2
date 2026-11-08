import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import {
  getOMFactories,
  getOMUsers,
  getQAProductMatrixData,
  getOMSpecialDays,
  getOMDowntimeReasons,
} from "@/actions/om-actions";
import { OMClient } from "./om-client";

export const dynamic = "force-dynamic";

export default async function OMPage() {
  const user = await requireUser();

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  if (user.role !== "om" && user.role !== "sys_admin") {
    redirect("/dashboard");
  }

  const factories = await getOMFactories();
  const factoryUsers = await getOMUsers();
  const matrixData = await getQAProductMatrixData();
  const specialDays = await getOMSpecialDays();
  const downtimeReasons = await getOMDowntimeReasons();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Operations Management (OM)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Supervise factory plants, assign team members, and configure QA inspection matrices
        </p>
      </div>

      <OMClient
        factories={factories}
        factoryUsers={factoryUsers}
        matrixData={matrixData}
        initialSpecialDays={specialDays}
        initialDowntimeReasons={downtimeReasons}
      />
    </div>
  );
}
