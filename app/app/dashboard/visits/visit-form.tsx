"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input, Select, Textarea } from "@/components/dashboard/ui/field";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

type Props = {
  clinicId: string;
  customers: Customer[];
  /** Preselected context when the visit is opened from an appointment or a pet card. */
  initialCustomerId?: string | null;
  initialPetId?: string | null;
  initialPets?: Pet[];
  appointmentId?: string | null;
  /**
   * True when the visit was opened from a specific appointment: the patient is
   * decided by that appointment, so the pickers are shown read-only rather than
   * letting the visit drift onto a different animal than the one booked.
   */
  contextLocked?: boolean;
};

export function VisitForm({
  clinicId,
  customers,
  initialCustomerId,
  initialPetId,
  initialPets = [],
  appointmentId,
  contextLocked = false,
}: Props) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [petId, setPetId] = useState(initialPetId ?? "");
  const [pets, setPets] = useState<Pet[]>(initialPets);
  const [petsLoading, setPetsLoading] = useState(false);
  // Which customer the `pets` in state actually belong to. Comparing against
  // initialCustomerId instead was wrong: switching away and back left the other
  // customer's animals on screen, and picking one failed the server's
  // pet/customer/clinic check.
  const loadedForCustomerId = useRef<string>(initialCustomerId ?? "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOptions, setCustomerOptions] = useState<Customer[]>(customers);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [manualVisitSummary, setManualVisitSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPets = useCallback(async (nextCustomerId: string) => {
    if (!nextCustomerId) {
      setPets([]);
      return;
    }
    setPetsLoading(true);
    try {
      const response = await fetch(`/api/customers/${nextCustomerId}/pets`);
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { data: { items: Pet[] } };
      const items = payload.data.items ?? [];
      setPets(items);
      // One animal is not a choice — select it so the vet does not have to.
      setPetId((current) => (items.some((p) => p.id === current) ? current : items.length === 1 ? items[0]!.id : ""));
    } catch {
      setPets([]);
      setPetId("");
      setError("טעינת החיות של הלקוח נכשלה");
    } finally {
      setPetsLoading(false);
    }
  }, []);

  // The initial list is only the first page the API returns, so an older client
  // is unreachable by scrolling the dropdown alone. Two characters or more
  // search server-side; fewer falls back to that first page.
  useEffect(() => {
    if (contextLocked) return;
    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomerOptions(customers);
      setCustomerSearching(false);
      return;
    }

    let cancelled = false;
    setCustomerSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/customers?q=${encodeURIComponent(query)}&limit=50`);
          if (!response.ok) throw new Error();
          const payload = (await response.json()) as { data: { items: Customer[] } };
          if (!cancelled) setCustomerOptions(payload.data.items ?? []);
        } catch {
          if (!cancelled) setCustomerOptions([]);
        } finally {
          if (!cancelled) setCustomerSearching(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerQuery, customers, contextLocked]);

  useEffect(() => {
    if (contextLocked) return;
    if (!customerId) {
      setPets([]);
      setPetId("");
      loadedForCustomerId.current = "";
      return;
    }
    if (customerId === loadedForCustomerId.current) return;
    loadedForCustomerId.current = customerId;
    void loadPets(customerId);
  }, [customerId, contextLocked, loadPets]);

  const selectedCustomer =
    customerOptions.find((c) => c.id === customerId) ??
    customers.find((c) => c.id === customerId) ??
    null;
  const selectedPet = pets.find((p) => p.id === petId) ?? null;
  const canSubmit = Boolean(customerId && petId) && !loading;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guarded in the UI too, but never post a visit without an explicit patient:
    // the old form fell back to the clinic's first customer and first pet.
    if (!customerId || !petId) {
      setError("צריך לבחור לקוח וחיה לפני פתיחת הביקור");
      return;
    }
    setLoading(true);
    setError(null);

    const response = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        customerId,
        petId,
        appointmentId: appointmentId ?? null,
        chiefComplaint: chiefComplaint || null,
        manualVisitSummary: manualVisitSummary || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      setError(payload.error?.message ?? "יצירת הביקור נכשלה");
      return;
    }

    const payload = (await response.json()) as { data: { id: string } };
    router.push(`/dashboard/visits/${payload.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {contextLocked ? (
        <div className="rounded-[var(--radius-2)] bg-[var(--surface-sunken)] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            הביקור נפתח עבור
          </p>
          <p className="mt-1 text-sm text-[var(--text-primary)]">
            {selectedPet?.name ?? "מטופל"} · {selectedCustomer?.fullName ?? "לקוח"}
          </p>
        </div>
      ) : (
        <>
          <Field
            label="לקוח"
            htmlFor="visitCustomer"
            required
            hint={
              customerSearching
                ? "מחפש…"
                : customerQuery.trim().length >= 2 && customerOptions.length === 0
                  ? "לא נמצאו לקוחות מתאימים"
                  : "אפשר לחפש לפי שם, טלפון או אימייל"
            }
          >
            <Input
              id="visitCustomerSearch"
              value={customerQuery}
              placeholder="חיפוש לקוח…"
              onChange={(event) => setCustomerQuery(event.target.value)}
              className="mb-2"
            />
            <Select
              id="visitCustomer"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setPetId("");
                setError(null);
              }}
            >
              <option value="">בחר לקוח…</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="מטופל"
            htmlFor="visitPet"
            required
            hint={
              customerId && !petsLoading && pets.length === 0
                ? "ללקוח הזה אין חיות רשומות — צריך להוסיף חיה בכרטיס הלקוח"
                : undefined
            }
          >
            <Select
              id="visitPet"
              value={petId}
              disabled={!customerId || petsLoading || pets.length === 0}
              onChange={(event) => {
                setPetId(event.target.value);
                setError(null);
              }}
            >
              <option value="">
                {!customerId ? "בחר קודם לקוח" : petsLoading ? "טוען…" : "בחר מטופל…"}
              </option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                  {pet.species ? ` · ${pet.species}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}

      <Field label="סיבת הביקור" htmlFor="chiefComplaint">
        <Input
          id="chiefComplaint"
          value={chiefComplaint}
          onChange={(event) => setChiefComplaint(event.target.value)}
        />
      </Field>

      <Field label="סיכום ביקור ידני" htmlFor="manualVisitSummary">
        <Textarea
          id="manualVisitSummary"
          value={manualVisitSummary}
          onChange={(event) => setManualVisitSummary(event.target.value)}
          rows={4}
        />
      </Field>

      {appointmentId ? (
        <p className="text-sm text-[var(--text-muted)]">תור מקושר: {appointmentId}</p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
      <Btn type="submit" loading={loading} disabled={!canSubmit}>צור ביקור</Btn>
    </form>
  );
}
