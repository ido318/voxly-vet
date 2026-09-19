/**
 * Demo data seeder — generates realistic Hebrew demo data for a vet clinic.
 *
 * Idempotent: if any non-deleted customer already exists in the dev clinic,
 * the script exits without inserting more.
 *
 * Usage (after `supabase start` and `node scripts/seed-dev-user.mjs`):
 *   export SUPABASE_SERVICE_ROLE_KEY="$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2)"
 *   node scripts/seed-demo-data.mjs
 *
 * Env:
 *   SUPABASE_URL                 default http://127.0.0.1:54321
 *   SUPABASE_SERVICE_ROLE_KEY    required
 *   DEV_USER_EMAIL               default owner@demo-clinic.local
 *   DEMO_CLINIC_ID               default 00000000-0000-4000-8000-000000000001
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clinicId =
  process.env.DEMO_CLINIC_ID ?? "00000000-0000-4000-8000-000000000001";
const devEmail = process.env.DEV_USER_EMAIL ?? "owner@demo-clinic.local";

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- helpers ----------

function pad2(n) {
  return n.toString().padStart(2, "0");
}

/** Returns an ISO timestamp at the given offset from "now",
 *  snapped to a clean half-hour slot. */
function slot(daysOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Returns ISO date string (YYYY-MM-DD) at offset days from today. */
function dateOnly(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

async function getDevUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === devEmail);
  if (!user) {
    throw new Error(
      `Dev user ${devEmail} not found. Run scripts/seed-dev-user.mjs first.`,
    );
  }
  return user.id;
}

async function shouldSkip() {
  const { count, error } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .is("deleted_at", null);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ---------- data definitions ----------

const customers = [
  {
    full_name: "שרון לוי",
    phone: "+972501234567",
    email: "sharon.levi@example.com",
    address: "רחוב הרצל 14, תל אביב",
    preferred_contact_method: "whatsapp",
    notes: "מעדיפה תורים בשעות הבוקר.",
  },
  {
    full_name: "אבי כהן",
    phone: "+972529876543",
    email: "avi.cohen@example.com",
    address: "שדרות בן גוריון 27, רמת גן",
    preferred_contact_method: "phone",
    notes: "צריך תזכורת SMS יום לפני התור.",
  },
  {
    full_name: "מיכל ברק",
    phone: "+972542233445",
    email: "michal.barak@example.com",
    address: "רחוב יפו 80, ירושלים",
    preferred_contact_method: "email",
    notes: null,
  },
  {
    full_name: "יוסי שמש",
    phone: "+972537711223",
    email: null,
    address: "רחוב ויצמן 5, חיפה",
    preferred_contact_method: "phone",
    notes: "מבקש להגיע רק בימי שני וחמישי.",
  },
  {
    full_name: "ענת רוזן",
    phone: "+972584455667",
    email: "anat.rozen@example.com",
    address: "רחוב סוקולוב 22, הרצליה",
    preferred_contact_method: "sms",
    notes: null,
  },
  {
    full_name: "דני אזולאי",
    phone: "+972503344556",
    email: "dani.azoulay@example.com",
    address: "רחוב הגלעד 11, מודיעין",
    preferred_contact_method: "whatsapp",
    notes: "בעל שתי חיות מחמד.",
  },
  {
    full_name: "רותם פרץ",
    phone: "+972521122334",
    email: "rotem.peretz@example.com",
    address: "רחוב הירדן 9, באר שבע",
    preferred_contact_method: "whatsapp",
    notes: null,
  },
  {
    full_name: "נטע גולן",
    phone: "+972549988776",
    email: "neta.golan@example.com",
    address: "רחוב התמר 3, פתח תקווה",
    preferred_contact_method: "phone",
    notes: "ותיקה אצלנו מאז 2019.",
  },
];

// pets[i] belongs to customers[customerIndex]
const pets = [
  {
    customerIndex: 0,
    name: "ביסקוויט",
    species: "כלב",
    breed: "לברדור שוקולד",
    sex: "זכר",
    birth_date: "2020-03-15",
    weight: 28.5,
    chip_number: "972000000000101",
    is_neutered: true,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: "אוהב לרוץ בפארק.",
  },
  {
    customerIndex: 0,
    name: "לונה",
    species: "חתול",
    breed: "מעורב",
    sex: "נקבה",
    birth_date: "2022-06-01",
    weight: 4.2,
    chip_number: "972000000000102",
    is_neutered: true,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: null,
  },
  {
    customerIndex: 1,
    name: "מקס",
    species: "כלב",
    breed: "גולדן רטריבר",
    sex: "זכר",
    birth_date: "2019-11-20",
    weight: 32.0,
    chip_number: "972000000000103",
    is_neutered: true,
    allergies: "אלרגיה לעוף.",
    chronic_conditions: null,
    current_medications: null,
    notes: "רגיש בבטן — לא להאכיל פינוקים שמנים.",
  },
  {
    customerIndex: 2,
    name: "צ'אקי",
    species: "כלב",
    breed: "מעורב",
    sex: "זכר",
    birth_date: "2021-08-09",
    weight: 18.4,
    chip_number: "972000000000104",
    is_neutered: false,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: null,
  },
  {
    customerIndex: 3,
    name: "שוקו",
    species: "כלב",
    breed: "פודל קטן",
    sex: "נקבה",
    birth_date: "2017-04-22",
    weight: 6.8,
    chip_number: "972000000000105",
    is_neutered: true,
    allergies: null,
    chronic_conditions: "דלקת מפרקים קלה.",
    current_medications: "Carprofen 25mg — כדור ביום",
    notes: "כלבה ותיקה, צריכה ליווי עדין.",
  },
  {
    customerIndex: 4,
    name: "נמרוד",
    species: "חתול",
    breed: "אביסיני",
    sex: "זכר",
    birth_date: "2020-12-05",
    weight: 5.1,
    chip_number: "972000000000106",
    is_neutered: true,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: null,
  },
  {
    customerIndex: 4,
    name: "ביבי",
    species: "חתול",
    breed: "פרסי",
    sex: "נקבה",
    birth_date: "2023-02-18",
    weight: 3.6,
    chip_number: "972000000000107",
    is_neutered: false,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: "צעירה, פעלתנית.",
  },
  {
    customerIndex: 5,
    name: "ספייסי",
    species: "כלב",
    breed: "יורקשייר טרייר",
    sex: "נקבה",
    birth_date: "2021-05-30",
    weight: 3.2,
    chip_number: "972000000000108",
    is_neutered: true,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: null,
  },
  {
    customerIndex: 5,
    name: "וילי",
    species: "כלב",
    breed: "בורדר קולי",
    sex: "זכר",
    birth_date: "2018-09-14",
    weight: 22.1,
    chip_number: "972000000000109",
    is_neutered: true,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: "כלב עבודה, אנרגטי מאוד.",
  },
  {
    customerIndex: 6,
    name: "מיני",
    species: "כלב",
    breed: "צ'יוואווה",
    sex: "נקבה",
    birth_date: "2022-11-11",
    weight: 2.8,
    chip_number: "972000000000110",
    is_neutered: true,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: null,
  },
  {
    customerIndex: 7,
    name: "אלפי",
    species: "חתול",
    breed: "מעין קון",
    sex: "זכר",
    birth_date: "2019-07-07",
    weight: 7.4,
    chip_number: "972000000000111",
    is_neutered: true,
    allergies: null,
    chronic_conditions: null,
    current_medications: null,
    notes: null,
  },
  {
    customerIndex: 7,
    name: "סני",
    species: "כלב",
    breed: "תחש",
    sex: "זכר",
    birth_date: "2020-01-25",
    weight: 8.6,
    chip_number: "972000000000112",
    is_neutered: true,
    allergies: null,
    chronic_conditions: "נטייה לבעיות גב.",
    current_medications: null,
    notes: "להימנע ממדרגות גבוהות.",
  },
];

// appointments are placed at clean half-hour slots so the no-overlap constraint holds
const appointmentSeeds = [
  // past — completed
  {
    petIndex: 0,
    when: slot(-14, 9, 0),
    type: "vaccination",
    status: "completed",
    source: "phone",
    reason: "חיסון שנתי",
  },
  {
    petIndex: 2,
    when: slot(-10, 11, 30),
    type: "checkup",
    status: "completed",
    source: "front_desk",
    reason: "בדיקה כללית",
  },
  {
    petIndex: 4,
    when: slot(-5, 10, 0),
    type: "consultation",
    status: "completed",
    source: "phone",
    reason: "ייעוץ תזונה",
  },

  // past — cancelled
  {
    petIndex: 7,
    when: slot(-3, 14, 0),
    type: "checkup",
    status: "cancelled",
    source: "online",
    reason: "ביטול ע\"י הלקוחה",
  },

  // upcoming
  {
    petIndex: 1,
    when: slot(1, 9, 30),
    type: "checkup",
    status: "scheduled",
    source: "phone",
    reason: "בדיקה שגרתית",
  },
  {
    petIndex: 3,
    when: slot(1, 11, 0),
    type: "vaccination",
    status: "confirmed",
    source: "online",
    reason: "חיסון משולש",
  },
  {
    petIndex: 5,
    when: slot(2, 16, 0),
    type: "follow_up",
    status: "scheduled",
    source: "front_desk",
    reason: "מעקב אחרי טיפול",
  },
  {
    petIndex: 8,
    when: slot(4, 10, 30),
    type: "urgent",
    status: "confirmed",
    source: "phone",
    reason: "פציעה קלה ברגל",
  },
];

// visits ↔ (one per past completed appointment)
const visitSeeds = [
  // visit for appointmentSeeds[0] — vaccination ביסקוויט
  {
    petIndex: 0,
    appointmentIndexFromPast: 0,
    chief_complaint: "חיסון שנתי שגרתי. ללא תלונות.",
    notes: [
      {
        note_type: "soap_subjective",
        content:
          "הבעלים מדווחת שביסקוויט במצב מצוין, אוכל ושותה כרגיל, פעיל בפארק. ללא הקאות או שלשולים.",
      },
      {
        note_type: "soap_objective",
        content:
          "מצב גוף תקין (BCS 5/9), חום גוף 38.6°C, דופק 92, נשימה 22. שיניים נקיות. אוזניים נקיות.",
      },
      {
        note_type: "soap_plan",
        content:
          "חיסון משולש (DAPP) ניתן. חיסון כלבת ניתן. תזכורת לבדיקת לב-תולעים בעוד 6 חודשים.",
      },
    ],
    vaccinations: [
      {
        vaccine_name: "חיסון משולש (DAPP)",
        offsetDays: -14,
        batch_number: "DAPP-A2026-01",
        next_due_offsetDays: 365,
        notes: null,
      },
      {
        vaccine_name: "חיסון כלבת",
        offsetDays: -14,
        batch_number: "RAB-2026-04",
        next_due_offsetDays: 365,
        notes: null,
      },
    ],
    prescriptions: [],
  },
  // visit for appointmentSeeds[1] — checkup מקס
  {
    petIndex: 2,
    appointmentIndexFromPast: 1,
    chief_complaint: "בדיקה כללית. הבעלים מציין רגישות בבטן ופחות תיאבון השבוע.",
    notes: [
      {
        note_type: "soap_subjective",
        content:
          "מאז שבוע מקס אוכל פחות, אנרגיה תקינה, שתייה רגילה. הוקאות פעמיים בלבד.",
      },
      {
        note_type: "soap_objective",
        content:
          "מצב גוף 6/9, חום גוף 38.8°C. בטן רכה, ללא רגישות בולטת בבדיקה ידנית. שאר הבדיקה תקינה.",
      },
      {
        note_type: "soap_assessment",
        content:
          "חשד לדלקת קיבה קלה. אין סימני התייבשות. ממליץ על שינוי דיאטה זמני ומעקב.",
      },
      {
        note_type: "soap_plan",
        content:
          "דיאטה רכה לשבוע (אורז + עוף מבושל ללא שומן). פרוביוטיקה למשך 10 ימים. אם אין שיפור — בדיקת דם.",
      },
    ],
    vaccinations: [],
    prescriptions: [
      {
        medication_name: "Fortiflora פרוביוטיקה לכלבים",
        instructions: "1 שקיק ביום, מערבבים באוכל, למשך 10 ימים.",
        notes: null,
      },
      {
        medication_name: "Sucralfate 1g",
        instructions: "חצי טבליה כל 12 שעות במשך 7 ימים, על קיבה ריקה.",
        notes: "לקחת חצי שעה לפני הארוחה.",
      },
    ],
  },
  // visit for appointmentSeeds[2] — consultation ביבי (cat owned by Anat)
  {
    petIndex: 6,
    appointmentIndexFromPast: 2,
    chief_complaint: "ייעוץ תזונה לחתולה צעירה. הבעלים שואלת מה כדאי להאכיל.",
    notes: [
      {
        note_type: "general",
        content:
          "ביבי בת כשנה וחצי, גודלת בקצב מצוין. הבעלים מבקשת המלצות תזונה למניעת עודף משקל.",
      },
      {
        note_type: "soap_plan",
        content:
          "ממליץ על מזון חתולים פרימיום למניעת תזונה, ארוחות מדודות 2-3 פעמים ביום. שתייה מובטחת — להשאיר מים זמינים תמיד. לעודד פעילות עם צעצועי טריקים.",
      },
    ],
    vaccinations: [],
    prescriptions: [],
  },
];

// ---------- main ----------

async function main() {
  if (await shouldSkip()) {
    console.log(
      "Demo data already present in clinic — skipping. Reset DB to re-seed.",
    );
    return;
  }

  const userId = await getDevUserId();
  console.log(`Seeding demo data for clinic ${clinicId} as user ${userId}...`);

  // 1) Customers
  const customerRows = customers.map((c) => ({
    ...c,
    clinic_id: clinicId,
  }));
  const { data: insertedCustomers, error: customersError } = await admin
    .from("customers")
    .insert(customerRows)
    .select("id, full_name");
  if (customersError) throw customersError;
  const customerIds = insertedCustomers.map((c) => c.id);
  console.log(`  ${insertedCustomers.length} customers`);

  // 2) Pets
  const petRows = pets.map((p) => {
    const { customerIndex, ...rest } = p;
    return {
      ...rest,
      clinic_id: clinicId,
      customer_id: customerIds[customerIndex],
    };
  });
  const { data: insertedPets, error: petsError } = await admin
    .from("pets")
    .insert(petRows)
    .select("id, name");
  if (petsError) throw petsError;
  const petIds = insertedPets.map((p) => p.id);
  console.log(`  ${insertedPets.length} pets`);

  // 3) Appointments
  const appointmentRows = appointmentSeeds.map((a) => {
    const pet = pets[a.petIndex];
    return {
      clinic_id: clinicId,
      customer_id: customerIds[pet.customerIndex],
      pet_id: petIds[a.petIndex],
      appointment_type: a.type,
      status: a.status,
      source: a.source,
      scheduled_at: a.when,
      end_at: a.when, // overwritten by trigger
      duration_minutes: 30,
      reason: a.reason,
      created_by_user_id: userId,
    };
  });
  const { data: insertedAppointments, error: appointmentsError } = await admin
    .from("appointments")
    .insert(appointmentRows)
    .select("id, scheduled_at, status");
  if (appointmentsError) throw appointmentsError;
  console.log(`  ${insertedAppointments.length} appointments`);

  // Map past completed appointments to their original index in appointmentSeeds
  const pastCompletedIds = appointmentSeeds
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.status === "completed")
    .map(({ i }) => insertedAppointments[i].id);

  // 4) Visits + notes + vaccinations + prescriptions
  let visitCount = 0;
  let noteCount = 0;
  let vaccinationCount = 0;
  let prescriptionCount = 0;

  for (const v of visitSeeds) {
    const pet = pets[v.petIndex];
    const apptId = pastCompletedIds[v.appointmentIndexFromPast] ?? null;
    const appt = insertedAppointments[v.appointmentIndexFromPast];
    const startedAt = appt?.scheduled_at ?? slot(-1, 9, 0);

    const { data: visitRows, error: visitError } = await admin
      .from("visits")
      .insert({
        clinic_id: clinicId,
        customer_id: customerIds[pet.customerIndex],
        pet_id: petIds[v.petIndex],
        appointment_id: apptId,
        status: "completed",
        chief_complaint: v.chief_complaint,
        started_at: startedAt,
        completed_at: startedAt,
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (visitError) throw visitError;
    const visitId = visitRows.id;
    visitCount += 1;

    if (v.notes.length > 0) {
      const noteRows = v.notes.map((n) => ({
        clinic_id: clinicId,
        visit_id: visitId,
        note_type: n.note_type,
        content: n.content,
        author_user_id: userId,
      }));
      const { error: notesError } = await admin
        .from("medical_notes")
        .insert(noteRows);
      if (notesError) throw notesError;
      noteCount += v.notes.length;
    }

    if (v.vaccinations.length > 0) {
      const vaccinationRows = v.vaccinations.map((vac) => ({
        clinic_id: clinicId,
        pet_id: petIds[v.petIndex],
        customer_id: customerIds[pet.customerIndex],
        visit_id: visitId,
        vaccine_name: vac.vaccine_name,
        administered_at: slot(vac.offsetDays, 10, 0),
        batch_number: vac.batch_number,
        next_due_at:
          vac.next_due_offsetDays != null
            ? dateOnly(vac.offsetDays + vac.next_due_offsetDays)
            : null,
        notes: vac.notes,
        administered_by_user_id: userId,
      }));
      const { error: vaccinationsError } = await admin
        .from("vaccinations")
        .insert(vaccinationRows);
      if (vaccinationsError) throw vaccinationsError;
      vaccinationCount += v.vaccinations.length;
    }

    if (v.prescriptions.length > 0) {
      const prescriptionRows = v.prescriptions.map((p) => ({
        clinic_id: clinicId,
        visit_id: visitId,
        pet_id: petIds[v.petIndex],
        medication_name: p.medication_name,
        instructions: p.instructions,
        notes: p.notes,
        prescribed_by_user_id: userId,
      }));
      const { error: prescriptionsError } = await admin
        .from("prescriptions")
        .insert(prescriptionRows);
      if (prescriptionsError) throw prescriptionsError;
      prescriptionCount += v.prescriptions.length;
    }
  }

  console.log(
    `  ${visitCount} visits, ${noteCount} notes, ${vaccinationCount} vaccinations, ${prescriptionCount} prescriptions`,
  );
  console.log("Demo data ready.");
}

main().catch((err) => {
  console.error("Seed failed.");
  if (err && typeof err === "object") {
    const { message, details, hint, code, status } = err;
    console.error({ message, details, hint, code, status });
    if (err.stack) console.error(err.stack);
  } else {
    console.error(err);
  }
  console.error(
    "\nHint: if message is empty, check that SUPABASE_SERVICE_ROLE_KEY is set correctly.",
  );
  process.exit(1);
});
