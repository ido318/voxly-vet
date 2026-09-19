import { requireProviderAdminPage } from "@/lib/api/require-provider-admin-page";
import { ImprovementsPageClient } from "./page-client";

export default async function ImprovementsPage() {
  await requireProviderAdminPage();
  return <ImprovementsPageClient />;
}
