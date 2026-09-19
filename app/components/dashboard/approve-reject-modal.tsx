"use client";
import React, { useState } from "react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { useToast } from "@/components/dashboard/ui/toast";

export function ApproveRejectModal({
  mode,
  appointmentId,
  phone,
  customerName,
  petName,
  onConfirm,
  onClose,
}: {
  mode: "approve" | "reject";
  appointmentId: string;
  phone: string;
  customerName: string;
  petName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, customerName, petName }),
      });
      if (!res.ok) throw new Error();

      // Say what actually happened. This used to claim the SMS was sent even
      // when nothing was queued at all.
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { smsStatus?: "sent" | "queued" | "failed" };
      };
      const decision = mode === "approve" ? "התור אושר" : "התור נדחה";
      switch (payload.data?.smsStatus) {
        case "sent":
          toast(`${decision} · ה-SMS נשלח ללקוח`, "success");
          break;
        case "queued":
          toast(`${decision} · ה-SMS ממתין בתור וישלח בקרוב`, "success");
          break;
        case "failed":
          toast(`${decision}, אבל שליחת ה-SMS ללקוח נכשלה — צריך ליידע אותו ידנית`, "error");
          break;
        default:
          toast(decision, "success");
      }
      onConfirm();
    } catch {
      toast("שגיאה בעדכון התור", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "approve" ? "אישור תור עיקור/סירוס" : "דחיית תור עיקור/סירוס"}
      maxWidth={384}
    >
      <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        {mode === "approve"
          ? `האם לאשר את תורו של ${petName}? לאחר האישור תישלח הודעת SMS ל-${customerName}.`
          : `האם לדחות את תורו של ${petName}? לאחר הדחייה ישלח SMS ביטול ל-${customerName}.`}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
        <Btn
          variant={mode === "approve" ? "primary" : "danger"}
          size="sm"
          loading={loading}
          onClick={handleConfirm}
        >
          {mode === "approve" ? "אשר תור" : "דחה תור"}
        </Btn>
      </div>
    </Modal>
  );
}
