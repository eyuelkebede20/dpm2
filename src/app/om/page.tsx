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
    <PageContainer className="min-h-[calc(100vh-4rem)]">
      <div className="mb-6 sm:mb-8 pb-5 border-b border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="badge badge-sm font-mono text-[10px] tracking-wider uppercase bg-emerald-50 text-emerald-800 border-emerald-200 font-bold">
                Operations Management (የኦፕሬሽን ስራ አመራር)
              </span>
              <span className="text-xs text-slate-400 font-medium font-mono hidden sm:inline">
                /om
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Operations Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl">
              Supervise operating facilities, manage factory personnel and roles, and configure the QA inspection matrix.
            </p>
          </div>
        </div>
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
