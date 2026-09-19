import { requireProviderAdminPage } from "@/lib/api/require-provider-admin-page";
import { QaCallsPageClient } from "./page-client";

export default async function QaCallsPage() {
  await requireProviderAdminPage();
  return <QaCallsPageClient />;
}
