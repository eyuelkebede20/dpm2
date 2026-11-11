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
import { PageContainer } from "@/components/ui";

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
    <PageContainer>
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
    </PageContainer>
  );
}
