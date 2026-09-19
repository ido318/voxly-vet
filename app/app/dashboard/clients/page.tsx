"use client";
import React, { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input, Select, Textarea } from "@/components/dashboard/ui/field";
import { Drawer } from "@/components/dashboard/ui/drawer";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { PersonAvatar, AnimalAvatar } from "@/components/dashboard/ui/avatar";
import { useToast } from "@/components/dashboard/ui/toast";
import { SearchIcon, PhoneIcon, MailIcon, PinIcon, ChevRightIcon, XIcon } from "@/components/dashboard/icons";
import { NewCustomerModal } from "@/components/dashboard/new-customer-modal";
import { NewPetModal } from "@/components/dashboard/new-pet-modal";
import { InvoicesSection } from "@/components/dashboard/invoices-section";
import { SendMessageModal } from "@/components/dashboard/send-message-modal";
import type { Customer, PreferredContactMethod } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";
import type { Appointment } from "@/types/domain/appointment";
import type { Visit } from "@/types/domain/visit";

// ─── helpers ──────────────────────────────────────────────────────────────────

const TZ = "Asia/Jerusalem";
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function petAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) return `${years} שנ'`;
  const months = Math.floor(diff / (30.4 * 24 * 3600 * 1000));
  return months > 0 ? `${months} חו'` : "גור";
}

// ─── PetCard ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function PetCard({ pet }: { pet: Pet }) {
  const age = petAge(pet.birthDate);
  return (
    <Link href={`/dashboard/pets/${pet.id}`} className="block">
      <Card hover>
        <div className="flex flex-col items-start gap-2.5">
          <AnimalAvatar species={pet.species} size={56} />
          <div className="w-full min-w-0">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-semibold text-[15px] text-[var(--text-primary)]">{pet.name}</p>
              {pet.isNeutered && <Badge tone="neutral" className="flex-shrink-0">מעוקר/ת</Badge>}
            </div>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}{age ? ` · ${age}` : ""}
              {pet.sex === "male" ? " · זכר" : pet.sex === "female" ? " · נקבה" : ""}
            </p>
            {pet.weight && (
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{`${pet.weight} ק"ג`}</p>
            )}
            {pet.chronicConditions && (
              <div className="mt-1 inline-block w-fit max-w-full rounded bg-[var(--red-50)] px-1.5 py-0.5">
                <p className="line-clamp-2 text-xs text-[var(--red-700)]">
                  {pet.chronicConditions}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

// ─── ClientProfile drawer ──────────────────────────────────────────────────────

function ClientProfile({
  customer,
  onClose,
  onUpdated,
}: {
  customer: Customer;
  onClose: () => void;
  onUpdated: (customer: Customer) => void;
}) {
  const { toast } = useToast();
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [apptLoading, setApptLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [showNewPet, setShowNewPet] = useState(false);
  const [messageTarget, setMessageTarget] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(customer.fullName);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [preferredContactMethod, setPreferredContactMethod] = useState<PreferredContactMethod>(customer.preferredContactMethod);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [tags, setTags] = useState<string[]>(customer.tags);
  const [tagInput, setTagInput] = useState("");
  const [, startTransition] = useTransition();

  function addTag() {
    const value = tagInput.trim();
    if (!value) return;
    if (tags.length >= 10) {
      toast("עד 10 תגיות ללקוח", "error");
      return;
    }
    if (!tags.includes(value)) setTags((current) => [...current, value]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  const fetchPets = useCallback(async (showLoading = true) => {
    if (showLoading) setPetsLoading(true);
    const res = await fetch(`/api/pets?customerId=${customer.id}`);
    if (res.ok) {
      const d = await res.json() as { data: { items: Pet[] } };
      setPets(d.data.items ?? []);
    }
    setPetsLoading(false);
  }, [customer.id]);

  useEffect(() => {
    startTransition(() => {
      void fetchPets();
    });
  }, [fetchPets, startTransition]);

  useEffect(() => {
    setEditing(false);
    setFullName(customer.fullName);
    setPhone(customer.phone ?? "");
    setEmail(customer.email ?? "");
    setAddress(customer.address ?? "");
    setPreferredContactMethod(customer.preferredContactMethod);
    setNotes(customer.notes ?? "");
    setTags(customer.tags);
    setTagInput("");
  }, [customer]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/appointments?customerId=${customer.id}`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Appointment[] } };
        const sorted = (d.data.items ?? []).sort(
          (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        );
        setAppointments(sorted);
      }
      setApptLoading(false);
    })();
  }, [customer.id]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/visits?customerId=${customer.id}&limit=10`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Visit[] } };
        setVisits(d.data.items ?? []);
      }
      setVisitsLoading(false);
    })();
  }, [customer.id]);

  const APPT_STATUS_LABELS: Record<string, string> = {
    scheduled: "מתוזמן",
    confirmed: "מאושר",
    completed: "הושלם",
    cancelled: "בוטל",
    no_show: "לא הגיע",
    pending_approval: "ממתין לאישור",
    late_cancellation: "ביטול מאוחר",
  };

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      toast("שם מלא חייב להכיל לפחות 2 תווים", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          preferredContactMethod,
          notes: notes.trim() || null,
          tags,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as { data: Customer };
      onUpdated(updated.data);
      setEditing(false);
      toast("פרטי הלקוח עודכנו", "success");
    } catch {
      toast("שגיאה בעדכון פרטי הלקוח", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width={480}
        title={
          <div className="flex items-center gap-3">
            <PersonAvatar initials={initials(customer.fullName)} size={44} />
            <div>
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">{customer.fullName}</p>
              <p className="text-xs font-normal text-[var(--text-muted)]">לקוח/ה מאז {fmtDate(customer.createdAt)}</p>
            </div>
          </div>
        }
      >
        <div className="px-5 py-4 space-y-6">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Btn href={`/dashboard/calendar?newAppointment=1&customerId=${customer.id}`} variant="primary" size="sm">
              תור חדש
            </Btn>
            <Btn type="button" variant="soft" size="sm" onClick={() => setEditing((value) => !value)}>
              {editing ? "סגור עריכה" : "ערוך פרטים"}
            </Btn>
          </div>

          {editing && (
            <form onSubmit={saveCustomer} className="space-y-3 rounded-[var(--radius-3)] border border-[var(--border-hairline)] p-3">
              <Field label="שם מלא" htmlFor="editCustomerFullName">
                <Input
                  id="editCustomerFullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="טלפון" htmlFor="editCustomerPhone">
                  <Input
                    id="editCustomerPhone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    dir="ltr"
                  />
                </Field>
                <Field label="אימייל" htmlFor="editCustomerEmail">
                  <Input
                    id="editCustomerEmail"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    dir="ltr"
                  />
                </Field>
              </div>
              <Field label="כתובת" htmlFor="editCustomerAddress">
                <Input
                  id="editCustomerAddress"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </Field>
              <Field label="ערוץ מועדף" htmlFor="editCustomerPreferredContactMethod">
                <Select
                  id="editCustomerPreferredContactMethod"
                  value={preferredContactMethod}
                  onChange={(event) => setPreferredContactMethod(event.target.value as PreferredContactMethod)}
                >
                  <option value="phone">טלפון</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">אימייל</option>
                </Select>
              </Field>
              <Field label="הערות" htmlFor="editCustomerNotes">
                <Textarea
                  id="editCustomerNotes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                />
              </Field>
              <Field label="תגיות" htmlFor="editCustomerTagInput" hint="למשל: VIP, רגיש להרדמה — עד 10 תגיות">
                {tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 text-[12px]"
                        style={{
                          height: "var(--chip-h)",
                          borderRadius: "var(--radius-1)",
                          background: "var(--status-neutral-wash)",
                          color: "var(--status-neutral-text)",
                          fontWeight: "var(--w-semibold)",
                        }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          aria-label={`הסר תגית ${tag}`}
                          className="hover:opacity-70"
                        >
                          <XIcon size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    id="editCustomerTagInput"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="הוספת תגית..."
                  />
                  <Btn type="button" variant="soft" size="sm" onClick={addTag}>הוסף</Btn>
                </div>
              </Field>
              <div className="flex justify-end gap-2">
                <Btn type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>ביטול</Btn>
                <Btn type="submit" size="sm" loading={saving}>שמור</Btn>
              </div>
            </form>
          )}

          {!editing && customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.map((tag) => (
                <Badge key={tag} tone="neutral">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Pets — hero */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                חיות מחמד ({petsLoading ? "…" : pets.length})
              </p>
              <Btn size="sm" variant="ghost" onClick={() => setShowNewPet(true)}>+ הוסף חיה</Btn>
            </div>
            {petsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : pets.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">אין חיות מחמד רשומות</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pets.map(pet => <PetCard key={pet.id} pet={pet} />)}
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">פרטי קשר</p>
            {customer.phone && (
              <>
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <PhoneIcon size={14} className="text-[var(--text-muted)]" />
                  <a href={`tel:${customer.phone}`} className="hover:text-[var(--accent)]">{customer.phone}</a>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMessageTarget(customer)}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    שלח הודעה
                  </button>
                </div>
              </>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <MailIcon size={14} className="text-[var(--text-muted)]" />
                <a href={`mailto:${customer.email}`} className="hover:text-[var(--accent)]">{customer.email}</a>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <PinIcon size={14} className="text-[var(--text-muted)]" />
                {customer.address}
              </div>
            )}
          </div>

          {/* Appointment history */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              היסטוריית תורים ({apptLoading ? "…" : appointments.length})
            </p>
            {apptLoading ? (
              <Skeleton className="h-24" />
            ) : appointments.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">אין תורים רשומים</p>
            ) : (
              <div className="rounded-[var(--radius-3)] border border-[var(--border-hairline)] divide-y divide-[var(--border-row)]">
                {appointments.slice(0, 10).map(appt => (
                  <div key={appt.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                        {fmtDate(appt.scheduledAt)}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{appt.appointmentType}</p>
                    </div>
                    <Badge
                      tone={
                        appt.status === "completed" ? "done"
                          : appt.status === "cancelled" ? "neutral"
                          : "info"
                      }
                    >
                      {APPT_STATUS_LABELS[appt.status] ?? appt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visit history */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              ביקורים רפואיים ({visitsLoading ? "…" : visits.length})
            </p>
            {visitsLoading ? (
              <Skeleton className="h-24" />
            ) : visits.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">אין ביקורים רשומים</p>
            ) : (
              <div className="rounded-[var(--radius-3)] border border-[var(--border-hairline)] divide-y divide-[var(--border-row)]">
                {visits.map(visit => (
                  <Link
                    key={visit.id}
                    href={`/dashboard/visits/${visit.id}`}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{fmtDate(visit.startedAt)}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{visit.chiefComplaint ?? "ללא תלונה ראשית"}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {visit.aiVisitSummary && <Badge tone="info">AI</Badge>}
                      <Badge
                        tone={
                          visit.status === "completed" ? "done"
                            : visit.status === "cancelled" ? "neutral"
                            : "info"
                        }
                      >
                        {visit.status === "completed" ? "הושלם" : visit.status === "cancelled" ? "בוטל" : "בטיפול"}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Billing */}
          <InvoicesSection clinicId={customer.clinicId} customerId={customer.id} />

          {/* Notes */}
          {customer.notes && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">הערות</p>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{customer.notes}</p>
            </div>
          )}
        </div>
      </Drawer>

      <NewPetModal
        open={showNewPet}
        onClose={() => setShowNewPet(false)}
        clinicId={customer.clinicId}
        customerId={customer.id}
        onCreated={() => { void fetchPets(false); }}
      />

      {messageTarget?.phone && (
        <SendMessageModal
          customerId={messageTarget.id}
          customerName={messageTarget.fullName}
          phone={messageTarget.phone}
          // Only when there is no ambiguity. With several animals this used to
          // put the first one's name into "reminder" and "follow-up" templates,
          // which is how a client gets a message about the wrong pet.
          petName={pets.length === 1 ? pets[0]!.name : undefined}
          onClose={() => setMessageTarget(null)}
        />
      )}
    </>
  );
}

// ─── ClientCard ────────────────────────────────────────────────────────────────

function ClientCard({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  return (
    <Card hover onClick={onClick}>
      <div className="flex items-center gap-3">
        <PersonAvatar initials={initials(customer.fullName)} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14px] text-[var(--text-primary)] truncate">{customer.fullName}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">{customer.phone ?? customer.email ?? "—"}</p>
        </div>
        <ChevRightIcon size={14} className="flex-shrink-0 text-[var(--text-faint)]" />
      </div>
      {customer.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {customer.tags.map((tag) => (
            <Badge key={tag} tone="neutral">{tag}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const fetchData = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const params = q ? `?query=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/customers${params}`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Customer[] } };
        setItems(d.data.items ?? []);
      }
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData("");
    });
  }, [fetchData]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { void fetchData(query); }, 300);
    return () => clearTimeout(t);
  }, [query, fetchData]);

  // Deep-link: /dashboard/clients?customerId=<id> opens that customer's profile directly
  const searchParams = useSearchParams();
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (!customerId) return;
    void (async () => {
      const res = await fetch(`/api/customers/${customerId}`);
      if (res.ok) {
        const d = await res.json() as { data: Customer };
        setSelected(d.data);
      }
    })();
  }, [searchParams]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[length:var(--size-page-title-lg)] font-semibold text-[var(--text-primary)]">לקוחות</h1>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[length:var(--size-metric)] font-semibold text-[var(--text-primary)] tabular-nums">{items.length}</span>
            <span className="text-xs text-[var(--text-muted)]">רשומים</span>
          </div>
        </div>
        <Btn size="sm" onClick={() => setShowNewCustomer(true)}>לקוח חדש</Btn>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input
          type="text"
          placeholder="חיפוש לפי שם, טלפון או מייל…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-[var(--radius-3)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] py-2 pe-3 ps-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-focus)]"
        />
        {searching && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-[var(--border-focus)] border-t-transparent animate-spin" />
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={32} />}
          title={query ? "לא נמצאו לקוחות" : "אין לקוחות עדיין"}
          subtitle={query ? `אין תוצאות עבור "${query}"` : "לקוחות שיצרו קשר דרך תומר יופיעו כאן"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(customer => (
            <ClientCard
              key={customer.id}
              customer={customer}
              onClick={() => setSelected(customer)}
            />
          ))}
        </div>
      )}

      {/* Profile drawer */}
      {selected && (
        <ClientProfile
          customer={selected}
          onClose={() => setSelected(null)}
          onUpdated={(customer) => {
            setSelected(customer);
            setItems((current) => current.map((item) => item.id === customer.id ? customer : item));
          }}
        />
      )}

      <NewCustomerModal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreated={() => { void fetchData(query); }}
      />
    </div>
  );
}
