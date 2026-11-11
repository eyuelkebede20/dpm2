import { requireAuthPage } from "@/lib/authz";
import { getQAEntriesAction } from "@/actions/qa-actions";
import { QAClient } from "./qa-client";
import { PageContainer } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function QAPage() {
  await requireAuthPage();

  const data = await getQAEntriesAction();

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="badge badge-sm uppercase text-[10px] font-black tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Quality Assurance (የጥራት ቁጥጥር)
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Production Batch Sign-off & Verification</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            QA Production Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl">
            Review production numbers recorded by Factory Managers. Verify quality standards, approve batches, or reject non-conforming entries.
          </p>
        </div>
      </div>

      <QAClient initialEntries={data.entries} userRole={data.userRole} />
    </PageContainer>
  );
}
