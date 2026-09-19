"use client";
import React, { useState, useEffect, FormEvent, useTransition } from "react";
import Link from "next/link";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input, Select, Textarea } from "@/components/dashboard/ui/field";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Customer, CustomerDuplicate, PreferredContactMethod } from "@/types/domain/customer";

interface NewCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export function NewCustomerModal({ open, onClose, onCreated }: NewCustomerModalProps) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState<PreferredContactMethod>("phone");
  const [notes, setNotes] = useState("");
  const [duplicateCustomers, setDuplicateCustomers] = useState<CustomerDuplicate[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  function reset() {
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setPreferredContactMethod("phone");
    setNotes("");
    setDuplicateCustomers([]);
  }

  // Clear stale input whenever the modal closes, whether via cancel, the X
  // button, Escape, or a backdrop click -- not just on a successful submit.
  useEffect(() => {
    if (!open) {
      startTransition(reset);
    }
  }, [open, startTransition]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      toast("שם מלא חייב להכיל לפחות 2 תווים", "error");
      return;
    }

    setLoading(true);
    setDuplicateCustomers([]);
    try {
      const meRes = await fetch("/api/me");
      if (!meRes.ok) throw new Error();
      const me = (await meRes.json()) as { data: { memberships: { clinicId: string }[] } };
      const clinicId = me.data.memberships[0]?.clinicId;
      if (!clinicId) throw new Error();

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          preferredContactMethod,
          notes: notes.trim() || null,
        }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => null)) as {
          error?: { details?: { duplicates?: CustomerDuplicate[] } };
        } | null;
        const duplicates = body?.error?.details?.duplicates ?? [];
        setDuplicateCustomers(duplicates);
        toast("נמצא לקוח קיים עם אותו טלפון או אימייל", "error");
        return;
      }
      if (!res.ok) throw new Error();

      const created = (await res.json()) as { data: Customer };
      toast("הלקוח נוסף בהצלחה", "success");
      onCreated(created.data);
      onClose();
    } catch {
      toast("שגיאה בהוספת הלקוח", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="לקוח חדש" subtitle="הוספת לקוח ידנית לדשבורד">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="שם מלא *" htmlFor="fullName">
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
          />
        </Field>
        <Field label="טלפון" htmlFor="phone">
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label="אימייל" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label="כתובת" htmlFor="address">
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        <Field label="ערוץ מועדף" htmlFor="preferredContactMethod">
          <Select
            id="preferredContactMethod"
            value={preferredContactMethod}
            onChange={(e) => setPreferredContactMethod(e.target.value as PreferredContactMethod)}
          >
            <option value="phone">טלפון</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">אימייל</option>
          </Select>
        </Field>
        <Field label="הערות" htmlFor="notes">
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </Field>
        {duplicateCustomers.length > 0 && (
          <div className="rounded-[var(--radius-2)] border p-3" style={{ borderColor: "var(--status-pending-text)", background: "var(--status-pending-wash)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--status-pending-text)" }}>ייתכן שהלקוח כבר קיים</p>
            <div className="mt-2 space-y-1">
              {duplicateCustomers.map((duplicate) => (
                <Link
                  key={duplicate.id}
                  href={`/dashboard/clients?customerId=${duplicate.id}`}
                  className="block rounded-[var(--radius-1)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-white/70"
                  onClick={onClose}
                >
                  {duplicate.fullName} · {duplicate.phone ?? duplicate.email ?? "ללא פרטי קשר"}
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" variant="primary" size="sm" loading={loading}>הוסף לקוח</Btn>
        </div>
      </form>
    </Modal>
  );
}
