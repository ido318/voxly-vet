import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { safeNextPath } from "@/lib/safe-next-path";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  return <LoginForm nextPath={nextPath} />;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--surface-canvas)" }}
    >
      <div
        className="w-full p-8"
        style={{
          maxWidth: "var(--modal-w)",
          background: "var(--surface-raised)",
          borderRadius: "var(--radius-3)",
          boxShadow: "var(--shadow-raised)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="block h-5 w-5 flex-shrink-0"
            style={{
              background: "var(--text-secondary)",
              WebkitMaskImage: "url(/logo-mark.svg)",
              maskImage: "url(/logo-mark.svg)",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              maskSize: "contain",
            }}
          />
          <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            Demo Vet Clinic · קליניקה וטרינרית
          </p>
        </div>
        <h1 className="mt-3" style={{ font: "var(--type-page-title)", letterSpacing: "var(--track-title)" }}>
          התחברות למערכת
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          הזיני את פרטי ההתחברות שלך כדי להמשיך
        </p>

        <Suspense
          fallback={<p className="mt-8 text-[13px]" style={{ color: "var(--text-muted)" }}>טוען...</p>}
        >
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
