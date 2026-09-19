import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { ToastProvider } from "@/components/dashboard/ui/toast";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { MeResponse } from "@/types/api/me";
import type { ClinicSettings } from "@/types/domain/clinic";

async function getOpenEscalationCount(): Promise<number> {
  try {
    const data = await dashboardApiFetch<{ count: number }>("/api/escalations/count");
    return data?.count ?? 0;
  } catch {
    return 0;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [me, openEscalations, settings] = await Promise.all([
    dashboardApiFetch<MeResponse>("/api/me"),
    getOpenEscalationCount(),
    dashboardApiFetch<ClinicSettings>("/api/settings"),
  ]);

  const clinicName = me?.memberships?.[0]?.clinicName ?? "Demo Vet Clinic";
  const clinicLocation = settings?.contact.address || undefined;

  return (
    <ToastProvider>
      {/* Full-height RTL flex container: sidebar + content area. DOM order matters here —
          the first flex child sits at the inline-start edge, which is the right side under dir="rtl". */}
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-canvas)" }}>
        {/* Sidebar (right in RTL) */}
        <Sidebar openEscalations={openEscalations} isProviderAdmin={me?.profile.role === "provider_admin"} />

        {/* Main content (flex-1, scroll here) */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <Header
            clinicName={clinicName}
            clinicLocation={clinicLocation}
            openEscalations={openEscalations}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="page-enter">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
