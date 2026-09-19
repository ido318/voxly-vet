"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input, Select, Textarea } from "@/components/dashboard/ui/field";
import { Alert } from "@/components/dashboard/ui/alert";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Pet } from "@/types/domain/pet";

type Props = {
  pet: Pet;
};

function nullableString(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function nullableNumber(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? Number(text) : null;
}

export function PetProfileForm({ pet }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: nullableString(formData.get("name")) ?? pet.name,
      species: nullableString(formData.get("species")) ?? pet.species,
      breed: nullableString(formData.get("breed")),
      sex: nullableString(formData.get("sex")),
      birthDate: nullableString(formData.get("birthDate")),
      weight: nullableNumber(formData.get("weight")),
      chipNumber: nullableString(formData.get("chipNumber")),
      isNeutered: formData.get("isNeutered") === "on",
      allergies: nullableString(formData.get("allergies")),
      chronicConditions: nullableString(formData.get("chronicConditions")),
      currentMedications: nullableString(formData.get("currentMedications")),
      notes: nullableString(formData.get("notes")),
      status: nullableString(formData.get("status")) ?? "active",
    };

    const response = await fetch(`/api/pets/${pet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {
        error?: { message?: string };
      } | null;
      const message = body?.error?.message ?? "שמירת פרטי החיה נכשלה";
      setError(message);
      toast(message, "error");
      return;
    }

    toast("פרטי החיה נשמרו", "success");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">פרופיל רפואי</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">פרטים קבועים שחייבים להיות זמינים בכל ביקור</p>
        </div>
        <Btn type="submit" size="sm" loading={saving}>שמור פרטים</Btn>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="שם החיה" htmlFor="pet-name" required>
          <Input id="pet-name" name="name" defaultValue={pet.name} required />
        </Field>
        <Field label="סוג חיה" htmlFor="pet-species">
          <Select id="pet-species" name="species" defaultValue={pet.species}>
            <option value="dog">כלב</option>
            <option value="cat">חתול</option>
            <option value="other">אחר</option>
          </Select>
        </Field>
        <Field label="גזע" htmlFor="pet-breed">
          <Input id="pet-breed" name="breed" defaultValue={pet.breed ?? ""} />
        </Field>
        <Field label="מין" htmlFor="pet-sex">
          <Select id="pet-sex" name="sex" defaultValue={pet.sex ?? ""}>
            <option value="">לא ידוע</option>
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
          </Select>
        </Field>
        <Field label="משקל בק״ג" htmlFor="pet-weight">
          <Input id="pet-weight" name="weight" type="number" step="0.01" min="0" defaultValue={pet.weight ?? ""} />
        </Field>
        <Field label="תאריך לידה" htmlFor="pet-birthDate">
          <Input id="pet-birthDate" name="birthDate" type="date" defaultValue={pet.birthDate ?? ""} />
        </Field>
        <Field label="מספר שבב" htmlFor="pet-chipNumber">
          <Input id="pet-chipNumber" name="chipNumber" defaultValue={pet.chipNumber ?? ""} />
        </Field>
        <Field label="סטטוס" htmlFor="pet-status">
          <Select id="pet-status" name="status" defaultValue={pet.status}>
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
          </Select>
        </Field>
        <label
          className="flex items-center gap-2 self-end px-3 text-sm font-semibold"
          style={{
            height: "var(--field-h)",
            borderRadius: "var(--radius-2)",
            border: "1px solid var(--border-field)",
            background: "var(--surface-raised)",
            color: "var(--text-secondary)",
          }}
        >
          <input name="isNeutered" type="checkbox" defaultChecked={pet.isNeutered} />
          מעוקר / מסורס
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label="אלרגיות" htmlFor="pet-allergies">
          <Textarea id="pet-allergies" name="allergies" defaultValue={pet.allergies ?? ""} rows={3} />
        </Field>
        <Field label="מחלות כרוניות" htmlFor="pet-chronicConditions">
          <Textarea id="pet-chronicConditions" name="chronicConditions" defaultValue={pet.chronicConditions ?? ""} rows={3} />
        </Field>
        <Field label="תרופות קבועות" htmlFor="pet-currentMedications">
          <Textarea id="pet-currentMedications" name="currentMedications" defaultValue={pet.currentMedications ?? ""} rows={3} />
        </Field>
        <Field label="הערות" htmlFor="pet-notes">
          <Textarea id="pet-notes" name="notes" defaultValue={pet.notes ?? ""} rows={3} />
        </Field>
      </div>

      {error ? (
        <Alert tone="critical" className="mt-3">{error}</Alert>
      ) : null}
    </form>
  );
}
