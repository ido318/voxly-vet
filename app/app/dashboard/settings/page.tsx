"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { Field, Input } from "@/components/dashboard/ui/field";
import { useToast } from "@/components/dashboard/ui/toast";
import { Btn } from "@/components/dashboard/ui/btn";
import { Drawer } from "@/components/dashboard/ui/drawer";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { PriceListSettings } from "@/components/dashboard/settings/price-list-settings";
import type { MeResponse } from "@/types/api/me";
import type { ClinicSettings } from "@/types/domain/clinic";
import { MAX_BUSINESS_HOURS_ROWS, MAX_VISIT_PRICE_ROWS } from "@/lib/validators/clinic-settings";
import type { SmsTemplateKey } from "@tomer/shared";
import { DEFAULT_SMS_TEMPLATE_TEXT, SMS_TEMPLATE_REQUIRED_FIELDS } from "@tomer/shared";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  veterinarian: "וטרינר/ית",
  staff: "צוות",
};

const CLIENT_SMS: Array<{ key: SmsTemplateKey; label: string; when: string }> = [
  { key: "booking_confirmation", label: "אישור קביעת תור", when: "מיד עם הקביעה" },
  { key: "morning_reminder", label: "תזכורת בוקר", when: "08:00 ביום התור" },
  { key: "arrival_reminder", label: "אישור הגעה", when: "שעתיים לפני התור" },
  { key: "post_visit_followup", label: "מעקב אחרי ביקור", when: "יממה לאחר הביקור" },
  { key: "reschedule_update", label: "עדכון שינוי תור", when: "כשדנה משנה תור" },
  { key: "cancellation_update", label: "עדכון ביטול (מהדשבורד)", when: "כשדנה מבטלת תור" },
  { key: "client_cancellation_confirmation", label: "אישור ביטול (מהלקוח)", when: "כשהלקוח מבטל בטלפון" },
  { key: "vaccination_reminder", label: "תזכורת חיסון", when: "14 יום לפני מועד" },
];

const FIELD_LABELS: Record<string, string> = {
  customerName: "שם הלקוח",
  petName: "שם החיה",
  dayName: "יום בשבוע",
  date: "תאריך",
  time: "שעה",
  location: "מיקום",
  visitType: "סוג ביקור",
  price: "מחיר",
  oldDate: "תאריך ישן",
  newDate: "תאריך חדש",
  newTime: "שעה חדשה",
  vaccineName: "שם החיסון",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5 last:border-0"
      style={{ borderBottom: "var(--rule)" }}
    >
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function SectionTitle({
  children,
  hint,
  action,
  readOnly,
}: {
  children: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
  readOnly?: boolean;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {children}
          </h2>
          {readOnly ? <Badge tone="neutral" plain>לקריאה בלבד</Badge> : null}
        </div>
        {hint ? <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

function EditRow({
  value,
  onChange,
  onRemove,
  canRemove,
  labels,
  idPrefix,
}: {
  value: { a: string; b: string };
  onChange: (next: { a: string; b: string }) => void;
  onRemove: () => void;
  canRemove: boolean;
  labels: [string, string];
  idPrefix: string;
}) {
  return (
    <div
      className="flex items-end gap-2 py-2 last:border-0"
      style={{ borderBottom: "var(--rule)" }}
    >
      <Field label={labels[0]} htmlFor={`${idPrefix}-a`} className="flex-1 min-w-0">
        <Input
          id={`${idPrefix}-a`}
          value={value.a}
          onChange={(e) => onChange({ ...value, a: e.target.value })}
        />
      </Field>
      <Field label={labels[1]} htmlFor={`${idPrefix}-b`} className="flex-1 min-w-0">
        <Input
          id={`${idPrefix}-b`}
          value={value.b}
          onChange={(e) => onChange({ ...value, b: e.target.value })}
        />
      </Field>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title={canRemove ? undefined : "חייבת להישאר לפחות שורה אחת"}
        className="flex-shrink-0 whitespace-nowrap text-xs font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
        style={{ color: "var(--red-600)", height: "var(--field-h)", display: "flex", alignItems: "center" }}
      >
        הסר
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [draft, setDraft] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoadFailed, setSettingsLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplateKey, setEditingTemplateKey] = useState<SmsTemplateKey | null>(null);
  const [templateDraftText, setTemplateDraftText] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const [meRes, settingsRes] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/settings"),
        ]);
        if (!ignore && meRes.ok) {
          const payload = (await meRes.json()) as { data: MeResponse };
          setMe(payload.data);
        }
        if (!ignore) {
          if (settingsRes.ok) {
            const payload = (await settingsRes.json()) as { data: ClinicSettings };
            setSettings(payload.data);
          } else {
            setSettingsLoadFailed(true);
            toast("טעינת הגדרות המרפאה נכשלה — נסה/י לרענן את הדף", "error");
          }
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const membership = me?.memberships.find((m) => m.clinicId === me.profile.defaultClinicId)
    ?? me?.memberships[0];
  const canEdit = membership?.role === "owner" || membership?.role === "admin";

  function startEditing() {
    if (!settings) return;
    setDraft(structuredClone(settings));
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(null);
    setEditing(false);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast(body?.error?.message ?? "שמירת ההגדרות נכשלה", "error");
        return;
      }
      const payload = (await res.json()) as { data: ClinicSettings };
      setSettings(payload.data);
      setDraft(null);
      setEditing(false);
      toast("ההגדרות נשמרו", "success");
    } finally {
      setSaving(false);
    }
  }

  function openTemplateEditor(key: SmsTemplateKey) {
    setEditingTemplateKey(key);
    setTemplateDraftText(settings?.smsTemplates?.[key] ?? DEFAULT_SMS_TEMPLATE_TEXT[key]);
  }

  function closeTemplateEditor() {
    setEditingTemplateKey(null);
  }

  async function saveTemplate() {
    if (!editingTemplateKey) return;
    setSavingTemplate(true);
    try {
      const nextSmsTemplates = { ...(settings?.smsTemplates ?? {}), [editingTemplateKey]: templateDraftText };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsTemplates: nextSmsTemplates }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast(body?.error?.message ?? "שמירת הניסוח נכשלה", "error");
        return;
      }
      const payload = (await res.json()) as { data: ClinicSettings };
      setSettings(payload.data);
      toast("הניסוח נשמר", "success");
      setEditingTemplateKey(null);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function resetTemplateToDefault(key: SmsTemplateKey) {
    setSavingTemplate(true);
    try {
      const nextSmsTemplates = { ...(settings?.smsTemplates ?? {}) };
      delete nextSmsTemplates[key];
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsTemplates: nextSmsTemplates }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast(body?.error?.message ?? "איפוס הניסוח נכשל", "error");
        return;
      }
      const payload = (await res.json()) as { data: ClinicSettings };
      setSettings(payload.data);
      toast("אופס לברירת המחדל", "success");
      setEditingTemplateKey(null);
    } finally {
      setSavingTemplate(false);
    }
  }

  const editAction = canEdit && settings ? (
    editing ? (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={cancelEditing}
          disabled={saving}
          className="rounded-[var(--radius-1)] border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--border-hairline)", color: "var(--text-secondary)" }}
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-[var(--radius-1)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "שומר..." : "שמור"}
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={startEditing}
        className="rounded-[var(--radius-1)] border px-3 py-1.5 text-xs font-semibold"
        style={{ borderColor: "var(--border-hairline)", color: "var(--text-primary)" }}
      >
        ערוך
      </button>
    )
  ) : null;

  return (
    <div className="min-h-full p-6" style={{ background: "var(--surface-canvas)" }}>
      <div className="mx-auto max-w-[880px] space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>הגדרות</h1>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              סקירת התצורה של המרפאה והחשבון שלך
            </p>
          </div>
          {!loading ? editAction : null}
        </div>

        {settingsLoadFailed ? (
          <div className="rounded-[var(--radius-2)] border border-[var(--red-100)] bg-[var(--red-050)] px-4 py-3 text-sm font-semibold text-[var(--red-700)]">
            טעינת הגדרות המרפאה נכשלה. רענן/י את הדף כדי לנסות שוב.
          </div>
        ) : null}

        {/* Clinic profile */}
        <Card>
          <SectionTitle>פרטי המרפאה</SectionTitle>
          {loading ? (
            <Skeleton className="h-24" />
          ) : editing && draft ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 py-1 text-sm">
                <span style={{ color: "var(--text-secondary)" }}>שם</span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{membership?.clinicName ?? "Demo Vet Clinic"}</span>
              </div>
              <Field label="כתובת" htmlFor="settingsAddress">
                <Input
                  id="settingsAddress"
                  value={draft.contact.address}
                  onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, address: e.target.value } })}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="וואטסאפ" htmlFor="settingsWhatsapp">
                  <Input
                    id="settingsWhatsapp"
                    dir="ltr"
                    value={draft.contact.whatsapp}
                    onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, whatsapp: e.target.value } })}
                  />
                </Field>
                <Field label="אימייל" htmlFor="settingsEmail">
                  <Input
                    id="settingsEmail"
                    dir="ltr"
                    value={draft.contact.email}
                    onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, email: e.target.value } })}
                  />
                </Field>
              </div>
              <Row label="אזור זמן" value="ישראל (Asia/Jerusalem)" />
            </div>
          ) : (
            <div>
              <Row label="שם" value={membership?.clinicName ?? "Demo Vet Clinic"} />
              <Row label="כתובת" value={settings?.contact.address ?? "—"} />
              <Row label="וואטסאפ" value={<span dir="ltr">{settings?.contact.whatsapp ?? "—"}</span>} />
              <Row label="אימייל" value={settings?.contact.email ?? "—"} />
              <Row label="אזור זמן" value="ישראל (Asia/Jerusalem)" />
            </div>
          )}
        </Card>

        {/* Business hours */}
        <Card>
          <SectionTitle hint="תומר מציע תורים רק בשעות אלה">שעות פעילות</SectionTitle>
          {loading ? (
            <Skeleton className="h-20" />
          ) : editing && draft ? (
            <div>
              {draft.businessHours.map((b, i) => (
                <EditRow
                  key={i}
                  value={{ a: b.day, b: b.hours }}
                  labels={["יום", "שעות"]}
                  idPrefix={`business-hours-${i}`}
                  canRemove={draft.businessHours.length > 1}
                  onChange={(next) =>
                    setDraft({
                      ...draft,
                      businessHours: draft.businessHours.map((row, idx) =>
                        idx === i ? { day: next.a, hours: next.b } : row,
                      ),
                    })
                  }
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      businessHours: draft.businessHours.filter((_, idx) => idx !== i),
                    })
                  }
                />
              ))}
              <button
                type="button"
                disabled={draft.businessHours.length >= MAX_BUSINESS_HOURS_ROWS}
                onClick={() =>
                  setDraft({ ...draft, businessHours: [...draft.businessHours, { day: "", hours: "" }] })
                }
                className="mt-2 text-xs font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
                style={{ color: "var(--accent)" }}
              >
                {draft.businessHours.length >= MAX_BUSINESS_HOURS_ROWS
                  ? `הגעת למספר השורות המרבי (${MAX_BUSINESS_HOURS_ROWS})`
                  : "+ הוסף שורה"}
              </button>
            </div>
          ) : (
            <div>
              {(settings?.businessHours ?? []).map((b) => (
                <Row key={b.day} label={b.day} value={<span dir="ltr">{b.hours}</span>} />
              ))}
            </div>
          )}
        </Card>

        {/* Visit types */}
        <Card>
          <SectionTitle>סוגי ביקורים ומחירים</SectionTitle>
          {loading ? (
            <Skeleton className="h-32" />
          ) : editing && draft ? (
            <div>
              {draft.visitPrices.map((v, i) => (
                <EditRow
                  key={i}
                  value={{ a: v.label, b: v.detail }}
                  labels={["סוג ביקור", "מחיר / פרטים"]}
                  idPrefix={`visit-price-${i}`}
                  canRemove={draft.visitPrices.length > 1}
                  onChange={(next) =>
                    setDraft({
                      ...draft,
                      visitPrices: draft.visitPrices.map((row, idx) =>
                        idx === i ? { label: next.a, detail: next.b } : row,
                      ),
                    })
                  }
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      visitPrices: draft.visitPrices.filter((_, idx) => idx !== i),
                    })
                  }
                />
              ))}
              <button
                type="button"
                disabled={draft.visitPrices.length >= MAX_VISIT_PRICE_ROWS}
                onClick={() =>
                  setDraft({ ...draft, visitPrices: [...draft.visitPrices, { label: "", detail: "" }] })
                }
                className="mt-2 text-xs font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
                style={{ color: "var(--accent)" }}
              >
                {draft.visitPrices.length >= MAX_VISIT_PRICE_ROWS
                  ? `הגעת למספר השורות המרבי (${MAX_VISIT_PRICE_ROWS})`
                  : "+ הוסף שורה"}
              </button>
            </div>
          ) : (
            <div>
              {(settings?.visitPrices ?? []).map((v) => (
                <Row key={v.label} label={v.label} value={v.detail} />
              ))}
            </div>
          )}
        </Card>

        {/* Price list — real numeric pricing, editable, used when billing a visit */}
        {membership ? (
          <Card>
            <SectionTitle hint="המחירים בפועל המוצעים בעת חיוב ביקור">מחירון</SectionTitle>
            {loading ? <Skeleton className="h-32" /> : <PriceListSettings clinicId={membership.clinicId} />}
          </Card>
        ) : null}

        {/* Client SMS — 8 templates, wording editable per-clinic via the drawer below */}
        <Card style={{ background: "var(--surface-sunken)" }}>
          <SectionTitle hint="הודעות שנשלחות אוטומטית ללקוחות" readOnly={!canEdit}>התראות SMS ללקוחות</SectionTitle>
          <div>
            {CLIENT_SMS.map((sms) => (
              <div
                key={sms.key}
                className="flex items-center justify-between gap-3 py-2.5 last:border-0"
                style={{ borderBottom: "var(--rule)" }}
              >
                <div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{sms.label}</p>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>{sms.when}</p>
                </div>
                {canEdit ? (
                  <Btn variant="ghost" size="sm" onClick={() => openTemplateEditor(sms.key)}>
                    ערוך
                  </Btn>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        {/* Tomer agent — informational only, managed in ElevenLabs, not fetched here */}
        <Card style={{ background: "var(--surface-sunken)" }}>
          <SectionTitle hint="מנוהל בתצורת הסוכן (ElevenLabs)" readOnly>תומר — הסוכן הקולי</SectionTitle>
          <div>
            <Row label="מספר נכנס" value={<span dir="ltr">+972 53-564-8742</span>} />
            <Row label="שפה" value="עברית" />
            <Row
              label="ניתוב תורים"
              value={<Badge tone="done">בזמן אמת ליומן</Badge>}
            />
            <Row
              label="העברה לנציג אנושי"
              value="בשעות פעילות (אחרת — הסלמה)"
            />
          </div>
        </Card>

        {/* Account */}
        <Card>
          <SectionTitle>החשבון שלי</SectionTitle>
          {loading ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="space-y-3">
              <Row label="שם" value={me?.profile.fullName ?? "—"} />
              <Row label="אימייל" value={<span dir="ltr">{me?.user.email ?? "—"}</span>} />
              <Row
                label="הרשאה"
                value={membership ? (ROLE_LABELS[membership.role] ?? membership.role) : "—"}
              />
              <div className="flex justify-end pt-1">
                <LogoutButton />
              </div>
            </div>
          )}
        </Card>
      </div>

      {editingTemplateKey ? (
        <Drawer
          open
          onClose={closeTemplateEditor}
          title={CLIENT_SMS.find((s) => s.key === editingTemplateKey)?.label ?? ""}
          subtitle="נוסח הודעת ה-SMS שנשלחת ללקוח"
          footer={
            <>
              <Btn variant="primary" size="sm" loading={savingTemplate} onClick={() => void saveTemplate()}>
                שמור
              </Btn>
              <Btn
                variant="soft"
                size="sm"
                loading={savingTemplate}
                onClick={() => void resetTemplateToDefault(editingTemplateKey)}
              >
                אפס לברירת מחדל
              </Btn>
            </>
          }
        >
          <div className="space-y-3 p-5">
            <Field label="נוסח ההודעה" htmlFor="sms-template-draft">
              <textarea
                id="sms-template-draft"
                value={templateDraftText}
                onChange={(e) => setTemplateDraftText(e.target.value)}
                rows={8}
                dir="rtl"
                className="w-full text-sm p-3"
                style={{
                  border: "var(--rule)",
                  borderRadius: "var(--radius-2)",
                  background: "var(--surface-sunken)",
                }}
              />
            </Field>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                משתנים זמינים:
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {Array.from(new Set(["customerName", "petName", ...SMS_TEMPLATE_REQUIRED_FIELDS[editingTemplateKey]]))
                  .map((field) => `{{${field}}} (${FIELD_LABELS[field] ?? field})`)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
