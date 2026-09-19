import { ForgotPasswordForm } from "@/app/login/forgot-password/forgot-password-form";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const linkExpired = params.error === "invalid_link";

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
          שחזור סיסמה
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          הזיני את כתובת האימייל שלך ונשלח אליך קישור לאיפוס הסיסמה
        </p>

        {linkExpired ? (
          <p className="mt-4 text-[13px]" style={{ color: "var(--status-critical-text)" }} role="alert">
            הקישור פג תוקף או אינו תקין. הזיני את האימייל שלך שוב כדי לקבל קישור חדש.
          </p>
        ) : null}

        <ForgotPasswordForm />
      </div>
    </main>
  );
}
