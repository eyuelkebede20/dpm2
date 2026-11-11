import { requireAuthPage } from "@/lib/authz";
import { getStoreStockData } from "@/actions/fm-actions";
import { StoreClient } from "./store-client";
import { PageContainer } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StoreStockPage() {
  await requireAuthPage(["fm", "om", "sys_admin"]);

  const { factory, productBalances, transactions } = await getStoreStockData();

  return (
    <PageContainer>
      <StoreClient
        factory={factory}
        productBalances={productBalances}
        transactions={transactions}
      />
    </PageContainer>
  );
}