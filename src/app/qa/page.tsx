import { requireAuthPage } from "@/lib/authz";
import { getQAWorkspaceData, getQAInspectionsHistory } from "@/actions/qa-actions";
import { QAClient } from "./qa-client";

export const dynamic = "force-dynamic";

export default async function QAPage() {
  await requireAuthPage();

  const { assignedProducts, availableLines } = await getQAWorkspaceData();
  const inspections = await getQAInspectionsHistory();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="badge badge-sm uppercase text-[10px] font-black tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
              Quality Assurance
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Batch Inspection & Defect Tracking</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            QA Operations & Batch Audits
          </h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl">
            Sample production runs, verify physical tolerances and packaging specs, and record quality inspection logs.
          </p>
        </div>
      </div>

      <QAClient
        assignedProducts={assignedProducts}
        availableLines={availableLines}
        inspections={inspections}
      />
    </div>
  );
}
