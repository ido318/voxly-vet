import { redirect } from "next/navigation";
import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";

/**
 * Page-level equivalent of requireProviderAdmin() for Server Components that
 * live inside the shared /dashboard/* tree (whose layout already ran
 * requireAuth(), not requireProviderAdmin()). Redirects rather than
 * throwing, since a page component isn't wrapped in a route handler's
 * try/catch → handleRouteError.
 */
export async function requireProviderAdminPage(): Promise<void> {
  const services = await createServices();
  try {
    await requireProviderAdmin(services.auth);
  } catch {
    redirect("/dashboard");
  }
}
