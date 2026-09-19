"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/dashboard/ui/drawer";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { AnimalIcon } from "@/components/dashboard/icons";
import { ApproveRejectModal } from "@/components/dashboard/approve-reject-modal";
import { useToast } from "@/components/dashboard/ui/toast";
import { VISIT_TYPE_CONFIG } from "@/lib/appointment-rules";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";

function visitLabel(type: string) {
  return VISIT_TYPE_CONFIG[type as keyof typeof VISIT_TYPE_CONFIG]?.labelHe ?? type;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "מתוכנן",
  confirmed: "מאושר",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "לא הגיע",
  pending_approval: "ממתין לאישור",
  late_cancellation: "ביטול מאוחר",
  checked_in: "צ׳ק־אין",
  in_visit: "בביקור",
};

export function AppointmentDrawer({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [approveRejectMode, setApproveRejectMode] = useState<"approve" | "reject" | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<"cancelled" | "no_show" | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [startingVisit, setStartingVisit] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // AppointmentDrawer itself never unmounts (Drawer only hides its content via
  // `open`), so local UI state must be reset explicitly whenever the selected
  // appointment changes — otherwise a leftover approve/reject or cancel-confirm
  // step from a previous appointment would reappear for the next one.
  useEffect(() => {
    setApproveRejectMode(null);
    setConfirmingCancel(null);
  }, [appointment?.id]);

  async function applyStatus(status: "cancelled" | "no_show") {
    if (!appointment) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: appointment.version, status }),
      });
      if (!res.ok) throw new Error();
      toast(status === "cancelled" ? "התור בוטל" : "התור סומן כלא הגיע", "success");
      setConfirmingCancel(null);
      onChanged();
      onClose();
    } catch {
      toast("עדכון התור נכשל", "error");
    } finally {
      setSavingStatus(false);
    }
  }

  async function checkIn() {
    if (!appointment) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: appointment.version }),
      });
      if (!res.ok) throw new Error();
      toast("המטופל סומן כצ׳ק־אין", "success");
      onChanged();
    } catch {
      toast("סימון הצ׳ק־אין נכשל", "error");
    } finally {
      setSavingStatus(false);
    }
  }

  async function openVisit() {
    if (!appointment) return;
    setStartingVisit(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/open-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: appointment.version }),
      });
      if (!res.ok) throw new Error();
      const payload = (await res.json()) as { data: { id: string } };
      toast("הביקור נפתח", "success");
      onChanged();
      onClose();
      router.push(`/dashboard/visits/${payload.data.id}`);
      router.refresh();
    } catch {
      toast("פתיחת הביקור נכשלה", "error");
    } finally {
      setStartingVisit(false);
    }
  }

  return (
    <>
      <Drawer open={appointment != null} onClose={onClose} title={appointment?.petName ?? undefined} width={420}>
        {appointment && (
          <div className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <AnimalIcon species={appointment.petSpecies ?? "dog"} size={28} />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-[var(--text-primary)]">{appointment.petName ?? "חיה"}</p>
                <p className="truncate text-[13px] text-[var(--text-muted)]">{appointment.customerName ?? "לקוח"}</p>
              </div>
              <Badge tone={appointment.status === "pending_approval" ? "pending" : "neutral"} className="ms-auto">
                {STATUS_LABEL[appointment.status] ?? appointment.status}
              </Badge>
            </div>

            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">סוג תור</dt>
                <dd className="font-semibold text-[var(--text-primary)]">{visitLabel(appointment.appointmentType)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-muted)]">מועד</dt>
                <dd className="font-semibold text-[var(--text-primary)]">{formatIsraelDateTime(appointment.scheduledAt)}</dd>
              </div>
              {appointment.reason && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--text-muted)]">סיבה</dt>
                  <dd className="font-semibold text-[var(--text-primary)]">{appointment.reason}</dd>
                </div>
              )}
              {appointment.notes && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--text-muted)]">הערות</dt>
                  <dd className="font-semibold text-[var(--text-primary)]">{appointment.notes}</dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col gap-2 border-t border-[var(--border-row)] pt-4">
              <Link href={`/dashboard/pets/${appointment.petId}`} className="text-[13px] font-semibold text-[var(--accent)] hover:underline">
                פתח כרטיס מטופל →
              </Link>
              {appointment.status === "in_visit" && (
                <Link
                  href={`/dashboard/visits/new?appointmentId=${appointment.id}`}
                  className="text-[13px] font-semibold text-[var(--accent)] hover:underline"
                >
                  עבור לביקור →
                </Link>
              )}
            </div>

            {confirmingCancel ? (
              <div className="space-y-2 border-t border-[var(--border-row)] pt-4">
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {confirmingCancel === "cancelled" ? "לבטל את התור?" : "לסמן כלא הגיע?"}
                </p>
                <div className="flex gap-2">
                  <Btn variant="ghost" size="sm" onClick={() => setConfirmingCancel(null)}>חזרה</Btn>
                  <Btn variant="danger" size="sm" loading={savingStatus} onClick={() => applyStatus(confirmingCancel)}>
                    כן, אישור
                  </Btn>
                </div>
              </div>
            ) : appointment.status === "pending_approval" ? (
              <div className="flex gap-2 border-t border-[var(--border-row)] pt-4">
                <Btn variant="soft" onClick={() => setApproveRejectMode("approve")}>אשר תור</Btn>
                <Btn variant="dangerSoft" onClick={() => setApproveRejectMode("reject")}>דחה תור</Btn>
              </div>
            ) : appointment.status === "scheduled" || appointment.status === "confirmed" ? (
              <div className="flex gap-2 border-t border-[var(--border-row)] pt-4">
                <Btn variant="soft" size="sm" loading={savingStatus} onClick={checkIn}>צ׳ק־אין</Btn>
                <Btn variant="dangerSoft" size="sm" onClick={() => setConfirmingCancel("cancelled")}>ביטול תור</Btn>
                <Btn variant="dangerSoft" size="sm" onClick={() => setConfirmingCancel("no_show")}>סימון כלא הגיע</Btn>
              </div>
            ) : appointment.status === "checked_in" || appointment.status === "in_visit" ? (
              <div className="flex gap-2 border-t border-[var(--border-row)] pt-4">
                <Btn variant="primary" size="sm" loading={startingVisit} onClick={openVisit}>פתח ביקור</Btn>
                {appointment.status === "checked_in" && (
                  <>
                    <Btn variant="dangerSoft" size="sm" onClick={() => setConfirmingCancel("cancelled")}>ביטול תור</Btn>
                    <Btn variant="dangerSoft" size="sm" onClick={() => setConfirmingCancel("no_show")}>סימון כלא הגיע</Btn>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Drawer>

      {appointment && approveRejectMode && (
        <ApproveRejectModal
          mode={approveRejectMode}
          appointmentId={appointment.id}
          phone={appointment.customerPhone ?? ""}
          customerName={appointment.customerName ?? ""}
          petName={appointment.petName ?? ""}
          onConfirm={() => {
            setApproveRejectMode(null);
            onChanged();
            onClose();
          }}
          onClose={() => setApproveRejectMode(null)}
        />
      )}
    </>
  );
}
