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
import { ListCheckIcon, PlusIcon, CheckIcon } from "@/components/dashboard/icons";
import { DueBadge } from "./due-badge";
import type { Task, TaskPriority, TaskSourceType } from "@/types/domain/task";
import type { Appointment } from "@/types/domain/appointment";
import type { Invoice } from "@/types/domain/invoice";
import type { MeResponse } from "@/types/api/me";

const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "נמוכה", medium: "בינונית", high: "גבוהה" };
const PRIORITY_COLOR: Record<TaskPriority, "muted" | "amber" | "red"> = { low: "muted", medium: "amber", high: "red" };
const SOURCE_LABEL: Record<TaskSourceType, string> = { manual: "ידני", visit: "מביקור", call: "משיחה", follow_up: "מעקב" };

type InboxRow = {
  id: string;
  title: string;
  subtitle: string;
  tone: "muted" | "amber" | "red";
  toneLabel: string;
  dueAt?: string | null;
  href?: string;
  onComplete?: () => void;
  completing?: boolean;
};

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function NewTaskModal({ open, onClose, clinicId, onCreated }: { open: boolean; onClose: () => void; clinicId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) { setTitle(""); setPriority("medium"); setDueAt(""); }
  }, [open]);

  async function submit() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          title: title.trim(),
          priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("המשימה נוספה", "success");
      onCreated();
      onClose();
    } catch {
      toast("הוספת המשימה נכשלה", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="משימה חדשה" maxWidth={420}>
      <div className="space-y-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת המשימה"
          className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--brand-400)]"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="h-10 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--brand-400)]"
          >
            <option value="low">עדיפות נמוכה</option>
            <option value="medium">עדיפות בינונית</option>
            <option value="high">עדיפות גבוהה</option>
          </select>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="h-10 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--brand-400)]"
          />
        </div>
        <div className="flex justify-between border-t border-[var(--line-2)] pt-3">
          <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn size="sm" loading={submitting} disabled={!title.trim()} onClick={submit}>הוסף משימה</Btn>
        </div>
      </div>
    </Modal>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "call">("all");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    const taskParams = new URLSearchParams({ status: "open" });
    if (sourceFilter === "call") taskParams.set("sourceType", "call");
    const [tasksRes, apptRes, invRes] = await Promise.all([
      fetch(`/api/tasks?${taskParams.toString()}`),
      fetch("/api/appointments?status=pending_approval"),
      fetch("/api/invoices?status=sent"),
    ]);
    if (tasksRes.ok) {
      const d = await tasksRes.json() as { data: { items: Task[] } };
      setTasks(d.data.items ?? []);
    }
    if (apptRes.ok) {
      const d = await apptRes.json() as { data: { items: Appointment[] } };
      setPendingAppointments(d.data.items ?? []);
    }
    if (invRes.ok) {
      const d = await invRes.json() as { data: { items: Invoice[] } };
      setUnpaidInvoices(d.data.items ?? []);
    }
    setLoading(false);
  }, [sourceFilter]);

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/me");
      if (meRes.ok) {
        const me = await meRes.json() as { data: MeResponse };
        setClinicId(me.data.profile.defaultClinicId ?? me.data.memberships[0]?.clinicId ?? null);
      }
    })();
    void fetchAll();
  }, [fetchAll]);

  async function completeTask(task: Task) {
    setCompletingId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: task.version, status: "done" }),
      });
      if (!res.ok) throw new Error();
      await fetchAll();
    } catch {
      toast("עדכון המשימה נכשל", "error");
    } finally {
      setCompletingId(null);
    }
  }

  const rows: InboxRow[] = [
    ...tasks.map((t): InboxRow => ({
      id: `task-${t.id}`,
      title: t.title,
      subtitle: [SOURCE_LABEL[t.sourceType], t.customerName, t.dueAt ? fmtDateTime(t.dueAt) : null].filter(Boolean).join(" · ") || "משימה כללית",
      tone: PRIORITY_COLOR[t.priority],
      toneLabel: PRIORITY_LABEL[t.priority],
      dueAt: t.dueAt,
      onComplete: () => completeTask(t),
      completing: completingId === t.id,
    })),
    ...pendingAppointments.map((a): InboxRow => ({
      id: `appt-${a.id}`,
      title: `תור ממתין לאישור - ${a.petName ?? "מטופל"}`,
      subtitle: `${a.customerName ?? ""} · ${fmtDateTime(a.scheduledAt)}`,
      tone: "amber",
      toneLabel: "אישור תור",
      dueAt: a.scheduledAt,
      href: "/dashboard/calendar",
    })),
    ...unpaidInvoices.map((inv): InboxRow => ({
      id: `inv-${inv.id}`,
      title: `חשבונית לא שולמה - ${inv.customerName ?? ""}`,
      subtitle: `#${inv.invoiceNumber} · ₪${inv.total.toLocaleString("he-IL", { minimumFractionDigits: 2 })}`,
      tone: "red",
      toneLabel: "חוב פתוח",
      href: "/dashboard/billing",
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold text-[var(--ink)]">משימות ופריטים לטיפול</h1>
        <Btn size="md" onClick={() => setShowNew(true)}>
          <PlusIcon size={15} />
          משימה חדשה
        </Btn>
      </div>

      <div className="flex gap-2">
        <Btn
          type="button"
          size="sm"
          variant={sourceFilter === "all" ? "primary" : "soft"}
          onClick={() => setSourceFilter("all")}
        >
          הכל
        </Btn>
        <Btn
          type="button"
          size="sm"
          variant={sourceFilter === "call" ? "primary" : "soft"}
          onClick={() => setSourceFilter("call")}
        >
          From Calls
        </Btn>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ListCheckIcon size={32} />} title="אין פריטים לטיפול" subtitle="משימות ופריטים שדורשים תשומת לב יופיעו כאן" />
      ) : (
        <Card noPad className="overflow-hidden">
          <div className="divide-y divide-[var(--line-2)]">
            {rows.map((row) => {
              const content = (
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--ink)]">{row.title}</p>
                    <p className="text-xs text-[var(--muted)]">{row.subtitle}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <DueBadge dueAt={row.dueAt ?? null} />
                    <Badge color={row.tone}>{row.toneLabel}</Badge>
                    {row.onComplete && (
                      <Btn size="sm" variant="soft" loading={row.completing} onClick={row.onComplete}>
                        <CheckIcon size={12} />
                        טופל
                      </Btn>
                    )}
                  </div>
                </div>
              );
              return row.href ? (
                <Link key={row.id} href={row.href} className="block transition-colors hover:bg-[var(--surface-2)]">
                  {content}
                </Link>
              ) : (
                <div key={row.id}>{content}</div>
              );
            })}
          </div>
        </Card>
      )}

      {clinicId && (
        <NewTaskModal open={showNew} onClose={() => setShowNew(false)} clinicId={clinicId} onCreated={() => void fetchAll()} />
      )}
    </div>
  );
}
