"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { Modal } from "@/components/dashboard/ui/modal";
import { useToast } from "@/components/dashboard/ui/toast";
import { MicroscopeIcon, PlusIcon } from "@/components/dashboard/icons";
import type { LabOrder, LabOrderStatus } from "@/types/domain/lab-order";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";
import type { MeResponse } from "@/types/api/me";

const STATUS_LABEL: Record<LabOrderStatus, string> = {
  ordered: "הוזמן",
  in_progress: "בבדיקה",
  completed: "הושלם",
};

const STATUS_COLOR: Record<LabOrderStatus, "muted" | "amber" | "green"> = {
  ordered: "muted",
  in_progress: "amber",
  completed: "green",
};

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function NewLabOrderModal({ open, onClose, clinicId, onCreated }: { open: boolean; onClose: () => void; clinicId: string; onCreated: () => void }) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [testName, setTestName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setCustomerQuery(""); setCustomerResults([]); setCustomer(null);
      setPets([]); setPet(null); setTestName("");
    }
  }, [open]);

  useEffect(() => {
    const trimmed = customerQuery.trim();
    if (trimmed.length < 2) { setCustomerResults([]); return; }
    const t = setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/search?entity=customers&q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json() as { data: { customers: Customer[] } };
        setCustomerResults(data.data.customers);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery]);

  useEffect(() => {
    setPet(null);
    if (!customer) { setPets([]); return; }
    void (async () => {
      const res = await fetch(`/api/customers/${customer.id}/pets`);
      if (!res.ok) { setPets([]); return; }
      const data = await res.json() as { data: { items: Pet[] } };
      setPets(data.data.items);
    })();
  }, [customer]);

  async function submit() {
    if (!customer || !pet || !testName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/lab-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, customerId: customer.id, petId: pet.id, testName: testName.trim() }),
      });
      if (!res.ok) throw new Error();
      toast("בדיקת המעבדה נוספה", "success");
      onCreated();
      onClose();
    } catch {
      toast("הוספת בדיקת המעבדה נכשלה", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="בדיקת מעבדה חדשה" maxWidth={440}>
      <div className="space-y-3">
        {!customer ? (
          <>
            <input
              autoFocus
              type="search"
              placeholder="חיפוש לקוח..."
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--brand-400)]"
            />
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCustomer(c)}
                  className="flex w-full items-center justify-between rounded-[var(--r-md)] border border-[var(--line)] px-3 py-2 text-start text-sm hover:bg-[var(--surface-2)]"
                >
                  <span className="font-semibold text-[var(--ink)]">{c.fullName}</span>
                  <span className="text-[var(--muted)]">{c.phone ?? ""}</span>
                </button>
              ))}
            </div>
          </>
        ) : !pet ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--ink-2)]">מטופל של {customer.fullName}</p>
              <button type="button" onClick={() => setCustomer(null)} className="text-xs font-semibold text-[var(--brand-600)] hover:underline">
                החלף לקוח
              </button>
            </div>
            {pets.length === 0 ? (
              <p className="text-sm text-[var(--faint)]">ללקוח זה אין מטופלים רשומים.</p>
            ) : pets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPet(p)}
                className="flex w-full items-center justify-between rounded-[var(--r-md)] border border-[var(--line)] px-3 py-2 text-start text-sm hover:bg-[var(--surface-2)]"
              >
                <span className="font-semibold text-[var(--ink)]">{p.name}</span>
                <span className="text-[var(--muted)]">{p.species}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--ink-2)]">{customer.fullName} · {pet.name}</p>
              <button type="button" onClick={() => setPet(null)} className="text-xs font-semibold text-[var(--brand-600)] hover:underline">
                החלף מטופל
              </button>
            </div>
            <input
              autoFocus
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="שם הבדיקה (למשל: CBC, ביוכימיה)"
              className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--brand-400)]"
            />
          </>
        )}

        <div className="flex justify-between border-t border-[var(--line-2)] pt-3">
          <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          {customer && pet && (
            <Btn size="sm" loading={submitting} disabled={!testName.trim()} onClick={submit}>הזמן בדיקה</Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function LabPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/lab-orders");
    if (res.ok) {
      const d = await res.json() as { data: { items: LabOrder[] } };
      setOrders(d.data.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/me");
      if (meRes.ok) {
        const me = await meRes.json() as { data: MeResponse };
        setClinicId(me.data.profile.defaultClinicId ?? me.data.memberships[0]?.clinicId ?? null);
      }
    })();
    void fetchOrders();
  }, [fetchOrders]);

  async function updateStatus(order: LabOrder, status: LabOrderStatus) {
    setSavingId(order.id);
    try {
      const resultText = resultDrafts[order.id]?.trim();
      const res = await fetch(`/api/lab-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: order.version,
          status,
          ...(status === "completed" ? { resultText } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      await fetchOrders();
    } catch {
      toast("עדכון סטטוס הבדיקה נכשל", "error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold text-[var(--ink)]">מעבדה</h1>
        <Btn size="md" onClick={() => setShowNew(true)}>
          <PlusIcon size={15} />
          בדיקה חדשה
        </Btn>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : orders.length === 0 ? (
        <EmptyState icon={<MicroscopeIcon size={32} />} title="אין בדיקות מעבדה" subtitle="בדיקות שיוזמנו יופיעו כאן" />
      ) : (
        <Card noPad className="overflow-hidden">
          <div className="divide-y divide-[var(--line-2)]">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-[var(--ink)]">{order.testName}</p>
                    {order.flagged && <Badge color="red">חריג</Badge>}
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    <Link href={`/dashboard/pets/${order.petId}`} className="text-[var(--brand-600)] hover:underline">
                      {order.petName ?? order.petId}
                    </Link>
                    {" · "}{order.customerName ?? order.customerId} · {fmtDateTime(order.orderedAt)}
                  </p>
                  {order.resultText ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--ink-2)]">{order.resultText}</p>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 flex-col gap-2 sm:items-end">
                  <Badge color={STATUS_COLOR[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  {order.status === "in_progress" && (
                    <textarea
                      value={resultDrafts[order.id] ?? ""}
                      onChange={(event) => setResultDrafts((drafts) => ({ ...drafts, [order.id]: event.target.value }))}
                      rows={2}
                      placeholder="תוצאת מעבדה לפני השלמה"
                      className="w-full min-w-[260px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)] sm:w-[320px]"
                    />
                  )}
                  {order.status === "ordered" && (
                    <Btn size="sm" variant="soft" loading={savingId === order.id} onClick={() => updateStatus(order, "in_progress")}>התחל</Btn>
                  )}
                  {order.status === "in_progress" && (
                    <Btn
                      size="sm"
                      variant="soft"
                      loading={savingId === order.id}
                      disabled={!(resultDrafts[order.id]?.trim() || order.resultText?.trim())}
                      onClick={() => updateStatus(order, "completed")}
                    >
                      סמן כהושלם
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {clinicId && (
        <NewLabOrderModal open={showNew} onClose={() => setShowNew(false)} clinicId={clinicId} onCreated={() => void fetchOrders()} />
      )}
    </div>
  );
}
