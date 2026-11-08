import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getQAWorkspaceData, getQAInspectionsHistory } from "@/actions/qa-actions";
import { QAClient } from "./qa-client";

export const dynamic = "force-dynamic";

export default async function QAPage() {
  const user = await requireUser();

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  const { assignedProducts, availableLines } = await getQAWorkspaceData();
  const inspections = await getQAInspectionsHistory();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Quality Assurance (QA) Operations
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor product quality specifications, sample batches, and log defect findings
        </p>
      </div>

      <QAClient
        assignedProducts={assignedProducts}
        availableLines={availableLines}
        inspections={inspections}
      />
    </div>
  );
}
