"use client";

import React, { useMemo, useState } from "react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Textarea } from "@/components/dashboard/ui/field";
import { useToast } from "@/components/dashboard/ui/toast";
import { toWhatsAppPhone } from "@tomer/shared";

/**
 * Sending a message to a client used to mean an `sms:` link — which opens the
 * staff member's own messaging app (and does nothing at all on a desktop), so the
 * clinic kept no record of what was said. This sends through the clinic's Twilio
 * number and logs it, or hands the same text to WhatsApp pre-filled.
 */

export type MessageTemplate = { label: string; build: (petName?: string) => string };

export const CLIENT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    label: "תזכורת לתור",
    build: (petName) =>
      `שלום, כאן מרפאת Demo Vet Clinic 🐾\nרצינו להזכיר את התור${petName ? ` של ${petName}` : ""}.\nלשינוי או ביטול — חייגו אלינו.`,
  },
  {
    label: "מעקב אחרי ביקור",
    build: (petName) =>
      `שלום, כאן מרפאת Demo Vet Clinic 🐾\nרצינו לשאול מה שלום ${petName ?? "החיה"} אחרי הביקור.\nאם יש שאלות או החמרה — אנחנו זמינים בטלפון.`,
  },
  {
    label: "בקשה לחזור אלינו",
    build: () =>
      `שלום, כאן מרפאת Demo Vet Clinic 🐾\nניסינו להשיג אתכם. נשמח שתחזרו אלינו בטלפון כשנוח.`,
  },
];

export function SendMessageModal({
  customerId,
  customerName,
  phone,
  petName,
  onClose,
}: {
  customerId: string;
  customerName: string;
  phone: string;
  petName?: string;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // A fourth private phone normaliser used to live here. It now shares the
  // one in @tomer/shared, which returns null for a number that cannot be
  // reached — so a broken number produces no link instead of a wa.me link
  // that silently goes nowhere.
  const whatsappHref = useMemo(() => {
    const waNumber = toWhatsAppPhone(phone);
    if (!waNumber) return null;
    const text = body.trim();
    const base = `https://wa.me/${waNumber}`;
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
  }, [body, phone]);

  async function sendSms() {
    const text = body.trim();
    if (!text) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "שליחת ה-SMS נכשלה");
      }
      toast(`ההודעה נשלחה ל-${customerName}`, "success");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "שליחת ה-SMS נכשלה", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`הודעה ל${customerName}`} subtitle={phone} maxWidth={460}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CLIENT_MESSAGE_TEMPLATES.map((template) => (
          <Btn
            key={template.label}
            size="sm"
            variant="ghost"
            onClick={() => setBody(template.build(petName))}
          >
            {template.label}
          </Btn>
        ))}
      </div>

      <Field label="תוכן ההודעה" htmlFor="clientMessageBody">
        <Textarea
          id="clientMessageBody"
          rows={5}
          maxLength={800}
          placeholder="כתוב הודעה, או בחר תבנית למעלה…"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>
      <p className="mt-1 text-[11px] text-[var(--text-faint)]">{body.trim().length}/800</p>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
        <Btn
          variant="soft"
          size="sm"
          disabled={!body.trim() || !whatsappHref}
          title={whatsappHref ? undefined : "מספר הטלפון של הלקוח אינו תקין"}
          onClick={() => whatsappHref && window.open(whatsappHref, "_blank", "noopener,noreferrer")}
        >
          פתח ב-WhatsApp
        </Btn>
        <Btn variant="primary" size="sm" loading={loading} disabled={!body.trim()} onClick={sendSms}>
          שלח SMS
        </Btn>
      </div>
    </Modal>
  );
}
