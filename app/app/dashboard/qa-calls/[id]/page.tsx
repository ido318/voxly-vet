import { requireProviderAdminPage } from "@/lib/api/require-provider-admin-page";
import { QaCallDetailPageClient } from "./page-client";

export default async function QaCallDetailPage() {
  await requireProviderAdminPage();
  return <QaCallDetailPageClient />;
}
