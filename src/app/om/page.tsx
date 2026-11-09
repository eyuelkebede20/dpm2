import { requireAuthPage } from "@/lib/authz";
import {
  getOMFactories,
  getOMUsers,
  getQAProductMatrixData,
  getOMSpecialDays,
  getOMDowntimeReasons,
  getOMLines,
} from "@/actions/om-actions";
import { OMClient } from "./om-client";

export const dynamic = "force-dynamic";

export default async function OMPage() {
  await requireAuthPage(["om", "sys_admin"]);

  const [factories, factoryUsers, matrixData, specialDays, downtimeReasons, linesList] =
    await Promise.all([
      getOMFactories(),
      getOMUsers(),
      getQAProductMatrixData(),
      getOMSpecialDays(),
      getOMDowntimeReasons(),
      getOMLines().catch(() => []),
    ]);

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
        linesList={linesList}
      />
    </div>
  );
}
