import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { ChangePasswordClient } from "./change-password-client";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  return <ChangePasswordClient />;
}
