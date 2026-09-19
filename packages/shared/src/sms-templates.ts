// The 8 approved Hebrew SMS templates for Tomer — wording frozen, do not
// change without Dana's approval, UNLESS changed through the /dashboard/settings
// UI (owner/admin only), which is exactly the sanctioned way to change it now.
// Single source of truth for both agent/ (sends via the notification
// processor) and app/ (dashboard approve/reject/reschedule flows).

export interface SmsTemplateData {
  customerName: string;
  petName: string;
  dayName?: string;      // יום בשבוע בעברית: "יום שלישי"
  date?: string;         // "17.6.2026"
  time?: string;         // "16:30"
  location?: string;     // "הקליניקה, הדוגמה 1 ת"א" / "ביקור בית בכתובתכם"
  visitType?: string;    // "בדיקה" / "חיסונים" / "ביקור בית"
  price?: string;        // "150 ₪" — a full segment, so a service with no
                         // fixed price can say so instead of naming a number
  oldDate?: string;
  newDate?: string;
  newTime?: string;
  vaccineName?: string;
}

// Clinic address constant — used for location in all non-home-visit appointments.
export const CLINIC_LOCATION = 'הקליניקה, הדוגמה 1 ת"א';
export const HOME_VISIT_LOCATION = "ביקור בית בכתובתכם";

export type SmsTemplateKey =
  | "booking_confirmation"
  | "morning_reminder"
  | "arrival_reminder"
  | "post_visit_followup"
  | "reschedule_update"
  | "cancellation_update"
  | "client_cancellation_confirmation"
  | "vaccination_reminder";

// Per-template required-field types — callers get compile-time errors for missing fields.
type Require<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type BookingConfirmationData = Require<SmsTemplateData, "dayName" | "date" | "time" | "location" | "visitType" | "price">;
export type MorningReminderData     = Require<SmsTemplateData, "time" | "location" | "visitType">;
export type RescheduleUpdateData    = Require<SmsTemplateData, "oldDate" | "newDate" | "newTime" | "location">;
export type CancellationUpdateData  = Require<SmsTemplateData, "oldDate">;
export type VaccinationReminderData = Require<SmsTemplateData, "vaccineName" | "petName">;

/** The default, factory wording for each template — {{key}} placeholders, byte-identical
 * in rendered output to the pre-refactor hardcoded template literals. */
export const DEFAULT_SMS_TEMPLATE_TEXT: Record<SmsTemplateKey, string> = {
  booking_confirmation:
    'שלום {{customerName}}, כאן תומר ממרפאת Demo Vet Clinic של ד"ר דנה כהן.\n' +
    'התור של {{petName}} נקבע בהצלחה ✅\n' +
    '📅 {{dayName}}, {{date}} | 🕒 {{time}} | 📍 {{location}}\n' +
    '🩺 {{visitType}} | 💳 {{price}}\n' +
    'לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.\n' +
    'מאחלים ל{{petName}} בריאות שלמה 🐾',

  morning_reminder:
    'בוקר טוב {{customerName}} ☀️ תזכורת מ-Demo Vet Clinic:\n' +
    'היום 🕒 {{time}} | {{visitType}} ל{{petName}} | 📍 {{location}}\n' +
    'אם משהו השתנה — חייגו אלינו בהקדם האפשרי.\n' +
    'מחכים לכם, תומר וד"ר דנה 🐾',

  arrival_reminder:
    'שלום {{customerName}}, כאן תומר מ-Demo Vet Clinic ⏰\n' +
    'מזכירים: התור של {{petName}} היום בשעה {{time}} | {{visitType}} | 📍 {{location}}\n' +
    'אם לא תוכלו להגיע — חייגו אלינו בהקדם.\n' +
    'נתראה בקרוב 🐾',

  post_visit_followup:
    'שלום {{customerName}}, כאן תומר מ-Demo Vet Clinic 🐾\n' +
    'רצינו לשאול מה שלום {{petName}} אחרי הביקור אצל ד"ר דנה — האם המצב משתפר?\n' +
    'אם יש שאלות, החמרה או כל דבר אחר — אנחנו זמינים בטלפון.\n' +
    'החלמה מהירה ל{{petName}} ❤️',

  reschedule_update:
    'שלום {{customerName}}, עדכון מ-Demo Vet Clinic:\n' +
    'בשל אילוץ רפואי, התור של {{petName}} מיום {{oldDate}} עודכן:\n' +
    '📅 מועד חדש: {{newDate}} | 🕒 {{newTime}} | 📍 {{location}}\n' +
    'המועד לא מתאים? חייגו אלינו ונמצא זמן אחר.\n' +
    'מתנצלים על אי הנוחות 🙏 תומר, Demo Vet Clinic',

  cancellation_update:
    'שלום {{customerName}}, עדכון מ-Demo Vet Clinic:\n' +
    'בשל אילוץ רפואי, התור של {{petName}} מיום {{oldDate}} בוטל.\n' +
    'נשמח לתאם מועד חדש — חייגו אלינו ונמצא זמן שנוח לכם.\n' +
    'מתנצלים על אי הנוחות 🙏 תומר, Demo Vet Clinic',

  client_cancellation_confirmation:
    'שלום {{customerName}}, מאשרים: התור של {{petName}} מיום {{oldDate}} בוטל לבקשתכם.\n' +
    'נשמח לראותכם שוב — לקביעת תור חדש חייגו אלינו בכל עת.\n' +
    'תומר, Demo Vet Clinic 🐾',

  vaccination_reminder:
    'שלום {{customerName}}, כאן תומר מ-Demo Vet Clinic 💉\n' +
    'הגיע הזמן לחיסון הבא של {{petName}} ({{vaccineName}}) — מומלץ לתאם בקרוב לשמירה על הבריאות.\n' +
    'לתיאום תור נוח — חייגו אלינו בכל עת.\n' +
    'בריאות ל{{petName}} 🐾 תומר, Demo Vet Clinic',
};

/** Placeholders each template's DEFAULT wording requires — used to validate a custom
 * override (does the edited text still reference every field the caller will supply?)
 * and, before that, to throw before sending a malformed SMS built from missing data. */
export const SMS_TEMPLATE_REQUIRED_FIELDS: Record<SmsTemplateKey, (keyof SmsTemplateData)[]> = {
  booking_confirmation: ["dayName", "date", "time", "location", "visitType", "price"],
  morning_reminder: ["time", "location", "visitType"],
  arrival_reminder: ["time", "location", "visitType"],
  post_visit_followup: [],
  reschedule_update: ["oldDate", "newDate", "newTime", "location"],
  cancellation_update: ["oldDate"],
  client_cancellation_confirmation: ["oldDate"],
  vaccination_reminder: ["vaccineName", "petName"],
};

// Runtime guard — throws before a malformed SMS is sent.
function requireFields<T extends SmsTemplateData>(d: T, fields: (keyof T)[], template: string): void {
  const missing = fields.filter((f) => d[f] === undefined || d[f] === "");
  if (missing.length > 0) {
    throw new Error(`smsTemplates.${template}: missing required fields: ${missing.join(", ")}`);
  }
}

/** Replaces every {{key}} in `templateText` with the matching field of `data`,
 * or an empty string if that field is missing. */
export function renderSmsTemplate(templateText: string, data: SmsTemplateData): string {
  return templateText.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = (data as unknown as Record<string, unknown>)[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/** The distinct {{key}} names referenced anywhere in a template's text. */
export function extractPlaceholders(templateText: string): Set<string> {
  const matches = templateText.matchAll(/\{\{(\w+)\}\}/g);
  return new Set(Array.from(matches, (m) => m[1] as string));
}

/** Renders `key`'s template using `customText` if given, else the default wording. */
export function resolveSmsTemplate(
  key: SmsTemplateKey,
  customText: string | undefined,
  data: SmsTemplateData,
): string {
  const text = customText ?? DEFAULT_SMS_TEMPLATE_TEXT[key];
  return renderSmsTemplate(text, data);
}

/** Backward-compatible external API: smsTemplates.xxx(data) throws on missing
 * required fields, then renders the DEFAULT wording. Existing call sites that
 * don't yet pass a clinic override keep working unchanged via this object. */
export const smsTemplates = Object.fromEntries(
  (Object.keys(DEFAULT_SMS_TEMPLATE_TEXT) as SmsTemplateKey[]).map((key) => [
    key,
    (d: SmsTemplateData) => {
      requireFields(d, SMS_TEMPLATE_REQUIRED_FIELDS[key], key);
      return renderSmsTemplate(DEFAULT_SMS_TEMPLATE_TEXT[key], d);
    },
  ]),
) as {
  booking_confirmation: (d: BookingConfirmationData) => string;
  morning_reminder: (d: MorningReminderData) => string;
  arrival_reminder: (d: MorningReminderData) => string;
  post_visit_followup: (d: SmsTemplateData) => string;
  reschedule_update: (d: RescheduleUpdateData) => string;
  cancellation_update: (d: CancellationUpdateData) => string;
  client_cancellation_confirmation: (d: CancellationUpdateData) => string;
  vaccination_reminder: (d: VaccinationReminderData) => string;
};
