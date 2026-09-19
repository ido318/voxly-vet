import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { VisitShareRepository } from "@/lib/repositories/visit-share.repository";
import { ClinicRepository } from "@/lib/repositories/clinic.repository";
import { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import { ProfileRepository } from "@/lib/repositories/profile.repository";
import { formatIsraelDate } from "@/lib/israel-date";
import { formatPetAge } from "@/lib/pet-age";
import { selectVisitMedicalNote } from "@/lib/visit-medical-note";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

function ExpiredNotice() {
  return (
    <main dir="rtl" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 bg-white p-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no Next Image optimization needed for a tiny error state */}
      <img src="/demovet-logo.png" alt="Demo Vet Clinic" className="h-12 w-auto" />
      <h1 className="text-lg font-semibold text-zinc-900">הקישור אינו זמין</h1>
      <p className="text-sm text-zinc-600">
        ייתכן שהקישור פג תוקף או בוטל. לפרטים, אנא פנו ישירות למרפאה.
      </p>
    </main>
  );
}

export default async function VisitSharePage({ params }: Params) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();

  const shareRepo = new VisitShareRepository(admin);
  const shareResult = await shareRepo.findLiveByToken(token);
  if (!shareResult.ok || !shareResult.value) return <ExpiredNotice />;
  const share = shareResult.value;

  const visitResult = await new VisitRepository(admin).findById(share.visitId);
  if (!visitResult.ok || !visitResult.value) return <ExpiredNotice />;
  const visit = visitResult.value;

  const [petResult, customerResult, prescriptionsResult, clinicResult, medicalNotesResult] =
    await Promise.all([
      new PetRepository(admin).findById(visit.petId),
      new CustomerRepository(admin).findById(visit.customerId),
      new PrescriptionRepository(admin).listByVisit(visit.id),
      new ClinicRepository(admin).findById(visit.clinicId),
      new MedicalNoteRepository(admin).listByVisit(visit.id),
    ]);

  const pet = petResult.ok ? petResult.value : null;
  const customer = customerResult.ok ? customerResult.value : null;
  const prescriptions = prescriptionsResult.ok
    ? prescriptionsResult.value.filter((p) => p.status === "active")
    : [];
  const clinic = clinicResult.ok ? clinicResult.value : null;
  const medicalNote = medicalNotesResult.ok ? selectVisitMedicalNote(medicalNotesResult.value) : null;

  const vetProfileResult = visit.createdByUserId
    ? await new ProfileRepository(admin).findByUserId(visit.createdByUserId)
    : null;
  const vetName = vetProfileResult?.ok ? (vetProfileResult.value?.fullName ?? null) : null;

  const age = formatPetAge(pet?.birthDate ?? null);

  const soapSections = medicalNote
    ? {
        history: medicalNote.subjective,
        findings: medicalNote.objective,
        diagnosis: medicalNote.assessment,
        treatment: medicalNote.plan,
      }
    : null;
  const hasSoapContent =
    soapSections !== null &&
    (soapSections.history || soapSections.findings || soapSections.diagnosis || soapSections.treatment);
  const freeTextSummary = visit.aiVisitSummary ?? visit.manualVisitSummary;

  // Best-effort view tracking; never block rendering on it.
  await shareRepo.recordView(share.id, share.viewCount).catch(() => undefined);

  const clinicName = clinic?.name ?? "Demo Vet Clinic";
  const clinicAddress = clinic?.settings.contact.address ?? "";
  const clinicPhone = clinic?.settings.contact.whatsapp ?? "";
  const clinicEmail = clinic?.settings.contact.email ?? "";

  const animalInfoFields: Array<[string, string | null]> = [
    ["שם החיה", pet?.name ?? null],
    ["סוג", pet?.species ?? null],
    ["גזע", pet?.breed ?? null],
    ["מין", pet?.sex ?? null],
    ["גיל", age],
    ["שבב", pet?.chipNumber ?? null],
  ].filter(([, value]) => value !== null) as Array<[string, string]>;

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-2xl bg-white p-6 text-zinc-900 print:p-0">
      <PrintButton />

      <header className="mb-5 flex items-start justify-between border-b border-zinc-300 pb-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img src="/demovet-logo.png" alt={clinicName} className="h-14 w-auto" />
          <div className="text-sm text-zinc-700">
            <p className="text-base font-semibold text-zinc-900">{clinicName}</p>
            {clinicAddress ? <p>{clinicAddress}</p> : null}
            {clinicPhone ? <p>{clinicPhone}</p> : null}
            {clinicEmail ? <p>{clinicEmail}</p> : null}
          </div>
        </div>
        <div className="text-left text-sm text-zinc-700">
          {customer?.fullName ? <p>לקוח: {customer.fullName}</p> : null}
          <p>תאריך: {formatIsraelDate(visit.startedAt)}</p>
        </div>
      </header>

      {animalInfoFields.length > 0 ? (
        <table className="mb-5 w-full border-collapse text-sm">
          <thead>
            <tr>
              {animalInfoFields.map(([label]) => (
                <th key={label} className="border-b border-zinc-300 pb-1 text-right font-medium text-zinc-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {animalInfoFields.map(([label, value]) => (
                <td key={label} className="pt-1 font-medium text-zinc-900">
                  {value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : null}

      <section className="mb-5 space-y-3 border-b border-zinc-200 pb-4 text-sm">
        {vetName ? (
          <p>
            <span className="font-medium text-zinc-500">הרופא: </span>
            {vetName}
          </p>
        ) : null}

        {hasSoapContent ? (
          <>
            {soapSections?.history ? (
              <p>
                <span className="block font-medium text-zinc-500">היסטוריה/סיבת הביקור:</span>
                <span className="whitespace-pre-wrap text-zinc-800">{soapSections.history}</span>
              </p>
            ) : null}
            {soapSections?.findings ? (
              <p>
                <span className="block font-medium text-zinc-500">ממצאים ובדיקות:</span>
                <span className="whitespace-pre-wrap text-zinc-800">{soapSections.findings}</span>
              </p>
            ) : null}
            {soapSections?.diagnosis ? (
              <p>
                <span className="block font-medium text-zinc-500">אבחנה:</span>
                <span className="whitespace-pre-wrap text-zinc-800">{soapSections.diagnosis}</span>
              </p>
            ) : null}
            {soapSections?.treatment ? (
              <p>
                <span className="block font-medium text-zinc-500">הטיפול:</span>
                <span className="whitespace-pre-wrap text-zinc-800">{soapSections.treatment}</span>
              </p>
            ) : null}
          </>
        ) : freeTextSummary ? (
          <p>
            <span className="block font-medium text-zinc-500">סיכום הביקור:</span>
            <span className="whitespace-pre-wrap text-zinc-800">{freeTextSummary}</span>
          </p>
        ) : null}
      </section>

      {prescriptions.length > 0 ? (
        <section className="mb-5 text-sm">
          <h2 className="mb-2 font-medium text-zinc-500">מרשמים:</h2>
          <ul className="space-y-2">
            {prescriptions.map((rx) => (
              <li key={rx.id} className="border-b border-zinc-100 pb-2">
                <p className="font-semibold text-zinc-900">{rx.medicationName}</p>
                <p className="whitespace-pre-wrap text-zinc-800">{rx.instructions}</p>
                {rx.notes ? <p className="text-xs text-zinc-500">{rx.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-6 text-center text-xs text-zinc-400 print:mt-3">
        הודעה זו נשלחה ממרפאת {clinicName}. אין להשיב להודעה זו.
      </footer>
    </main>
  );
}
