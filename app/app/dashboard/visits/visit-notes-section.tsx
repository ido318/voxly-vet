"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/dashboard/ui/btn";
import { Badge } from "@/components/dashboard/ui/badge";
import { isMedicalNoteLocked } from "@/lib/domain/medical-note-lock";
import type { MedicalNote, MedicalNoteType } from "@/types/domain/medical-note";

const NOTE_TYPES: MedicalNoteType[] = [
  "general",
  "soap_subjective",
  "soap_objective",
  "soap_assessment",
  "soap_plan",
  "follow_up",
];

const NOTE_TYPE_LABELS: Record<MedicalNoteType, string> = {
  general: "כללי",
  soap_subjective: "SOAP - תלונת לקוח",
  soap_objective: "SOAP - ממצאים",
  soap_assessment: "SOAP - הערכה",
  soap_plan: "SOAP - תוכנית טיפול",
  // "soap_full" notes, like "addendum" below, are never picked from this
  // form's NOTE_TYPES select — they're created exclusively via
  // VoiceSoapRecorder's "הוסף כהערה" flow (POST .../notes with a full,
  // possibly hand-edited S/O/A/P draft), which sets noteType client-side.
  soap_full: "SOAP מלא",
  follow_up: "מעקב",
  // "addendum" notes are never picked from this form's NOTE_TYPES select —
  // they're created exclusively via the "הוסף נספח" flow in NoteListItem
  // below (POST .../notes/:noteId/addendum), which sets noteType server-side.
  addendum: "נספח",
};

// Matches voice-soap-recorder.tsx's SOAP_FIELD_LABELS wording.
const SOAP_SUBFIELD_LABELS = {
  subjective: "סובייקטיבי",
  objective: "אובייקטיבי",
  assessment: "הערכה",
  plan: "תוכנית טיפול",
} as const;

function fieldToNull(value: string): string | null {
  return value.trim() ? value : null;
}

function formatNoteDateTime(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? fallback;
}

const textareaClass =
  "w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

type Props = {
  visitId: string;
  initialNotes: MedicalNote[];
};

type NoteListItemProps = {
  note: MedicalNote;
  visitId: string;
  childrenByParent: Map<string, MedicalNote[]>;
  depth: number;
};

function NoteListItem({ note, visitId, childrenByParent, depth }: NoteListItemProps) {
  const router = useRouter();
  const locked = isMedicalNoteLocked(note);
  const children = childrenByParent.get(note.id) ?? [];

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [editSubjective, setEditSubjective] = useState(note.subjective ?? "");
  const [editObjective, setEditObjective] = useState(note.objective ?? "");
  const [editAssessment, setEditAssessment] = useState(note.assessment ?? "");
  const [editPlan, setEditPlan] = useState(note.plan ?? "");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [addendumOpen, setAddendumOpen] = useState(false);
  const [addendumContent, setAddendumContent] = useState("");
  const [addendumSaving, setAddendumSaving] = useState(false);
  const [addendumError, setAddendumError] = useState<string | null>(null);

  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  function startEdit() {
    setEditContent(note.content);
    setEditSubjective(note.subjective ?? "");
    setEditObjective(note.objective ?? "");
    setEditAssessment(note.assessment ?? "");
    setEditPlan(note.plan ?? "");
    setEditError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditError(null);
  }

  async function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditSaving(true);
    setEditError(null);

    const response = await fetch(`/api/visits/${visitId}/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: editContent,
        subjective: fieldToNull(editSubjective),
        objective: fieldToNull(editObjective),
        assessment: fieldToNull(editAssessment),
        plan: fieldToNull(editPlan),
      }),
    });

    setEditSaving(false);
    if (!response.ok) {
      setEditError(await readErrorMessage(response, "עדכון ההערה נכשל"));
      return;
    }

    setEditing(false);
    router.refresh();
  }

  async function onApprove() {
    setApproving(true);
    setApproveError(null);

    const response = await fetch(`/api/visits/${visitId}/notes/${note.id}/approve`, {
      method: "POST",
    });

    setApproving(false);
    if (!response.ok) {
      setApproveError(await readErrorMessage(response, "אישור ההערה נכשל"));
      return;
    }

    router.refresh();
  }

  function cancelAddendum() {
    setAddendumOpen(false);
    setAddendumContent("");
    setAddendumError(null);
  }

  async function onSaveAddendum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddendumSaving(true);
    setAddendumError(null);

    const response = await fetch(`/api/visits/${visitId}/notes/${note.id}/addendum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: addendumContent }),
    });

    setAddendumSaving(false);
    if (!response.ok) {
      setAddendumError(await readErrorMessage(response, "הוספת הנספח נכשלה"));
      return;
    }

    setAddendumContent("");
    setAddendumOpen(false);
    router.refresh();
  }

  return (
    <li className={depth > 0 ? "mr-3 mt-2 border-r-2 border-[var(--brand-200)] pr-3" : ""}>
      <div className="rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-3 text-sm">
        {depth > 0 ? (
          <p className="mb-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
            נספח מתאריך {formatNoteDateTime(note.createdAt)}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{NOTE_TYPE_LABELS[note.noteType]}</Badge>
          {locked ? <Badge tone="neutral">נעול</Badge> : null}
        </div>

        {editing ? (
          <form onSubmit={onSaveEdit} className="mt-2 space-y-2">
            <textarea
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              required
              rows={3}
              placeholder="הערה רפואית שנכתבה על ידי הצוות"
              className={textareaClass}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_SUBFIELD_LABELS.subjective}</span>
                <textarea
                  value={editSubjective}
                  onChange={(event) => setEditSubjective(event.target.value)}
                  rows={2}
                  className={textareaClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_SUBFIELD_LABELS.objective}</span>
                <textarea
                  value={editObjective}
                  onChange={(event) => setEditObjective(event.target.value)}
                  rows={2}
                  className={textareaClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_SUBFIELD_LABELS.assessment}</span>
                <textarea
                  value={editAssessment}
                  onChange={(event) => setEditAssessment(event.target.value)}
                  rows={2}
                  className={textareaClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_SUBFIELD_LABELS.plan}</span>
                <textarea
                  value={editPlan}
                  onChange={(event) => setEditPlan(event.target.value)}
                  rows={2}
                  className={textareaClass}
                />
              </label>
            </div>
            {editError ? <p className="text-xs font-semibold text-[var(--red-700)]">{editError}</p> : null}
            <div className="flex gap-2">
              <Btn type="submit" size="sm" loading={editSaving}>
                שמור שינויים
              </Btn>
              <Btn type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={editSaving}>
                ביטול
              </Btn>
            </div>
          </form>
        ) : (
          <>
            <p className="mt-1.5 whitespace-pre-wrap text-[var(--text-primary)]">{note.content}</p>
            {(note.subjective || note.objective || note.assessment || note.plan) && (
              <dl className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                {note.subjective && <div><dt className="font-bold">S</dt><dd className="whitespace-pre-wrap">{note.subjective}</dd></div>}
                {note.objective && <div><dt className="font-bold">O</dt><dd className="whitespace-pre-wrap">{note.objective}</dd></div>}
                {note.assessment && <div><dt className="font-bold">A</dt><dd className="whitespace-pre-wrap">{note.assessment}</dd></div>}
                {note.plan && <div><dt className="font-bold">P</dt><dd className="whitespace-pre-wrap">{note.plan}</dd></div>}
              </dl>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {note.status === "draft" ? (
                <Btn type="button" variant="soft" size="sm" loading={approving} onClick={() => void onApprove()}>
                  אשר וחתום
                </Btn>
              ) : null}
              {locked ? (
                <Btn type="button" variant="ghost" size="sm" onClick={() => setAddendumOpen((open) => !open)}>
                  הוסף נספח
                </Btn>
              ) : (
                <Btn type="button" variant="ghost" size="sm" onClick={startEdit}>
                  ערוך
                </Btn>
              )}
            </div>
            {approveError ? <p className="mt-1.5 text-xs font-semibold text-[var(--red-700)]">{approveError}</p> : null}
          </>
        )}

        {addendumOpen ? (
          <form onSubmit={onSaveAddendum} className="mt-3 space-y-2 border-t border-[var(--border-row)] pt-3">
            <textarea
              value={addendumContent}
              onChange={(event) => setAddendumContent(event.target.value)}
              required
              rows={2}
              placeholder="תוכן הנספח"
              className={textareaClass}
            />
            {addendumError ? <p className="text-xs font-semibold text-[var(--red-700)]">{addendumError}</p> : null}
            <div className="flex gap-2">
              <Btn type="submit" size="sm" loading={addendumSaving}>
                שמור נספח
              </Btn>
              <Btn type="button" variant="ghost" size="sm" onClick={cancelAddendum} disabled={addendumSaving}>
                ביטול
              </Btn>
            </div>
          </form>
        ) : null}
      </div>

      {children.length > 0 ? (
        <ul className="space-y-2">
          {children.map((child) => (
            <NoteListItem
              key={child.id}
              note={child}
              visitId={visitId}
              childrenByParent={childrenByParent}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function VisitNotesSection({ visitId, initialNotes }: Props) {
  const router = useRouter();
  const [noteType, setNoteType] = useState<MedicalNoteType>("general");
  const [content, setContent] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/visits/${visitId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteType,
        content,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      setError(await readErrorMessage(response, "הוספת ההערה נכשלה"));
      return;
    }

    setContent("");
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    router.refresh();
  }

  const childrenByParent = new Map<string, MedicalNote[]>();
  const rootNotes: MedicalNote[] = [];
  for (const note of initialNotes) {
    if (note.parentNoteId) {
      const siblings = childrenByParent.get(note.parentNoteId) ?? [];
      siblings.push(note);
      childrenByParent.set(note.parentNoteId, siblings);
    } else {
      rootNotes.push(note);
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {rootNotes.length === 0 ? (
          <li className="text-sm text-[var(--text-faint)]">אין עדיין הערות.</li>
        ) : (
          rootNotes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              visitId={visitId}
              childrenByParent={childrenByParent}
              depth={0}
            />
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3 border-t border-[var(--border-row)] pt-4">
        <select
          value={noteType}
          onChange={(event) => setNoteType(event.target.value as MedicalNoteType)}
          className="w-full rounded-[var(--radius-2)] border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        >
          {NOTE_TYPES.map((value) => (
            <option key={value} value={value}>
              {NOTE_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          rows={3}
          placeholder="הערה רפואית שנכתבה על ידי הצוות"
          className={textareaClass}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_SUBFIELD_LABELS.subjective}</span>
            <textarea
              value={subjective}
              onChange={(event) => setSubjective(event.target.value)}
              rows={2}
              className={textareaClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_SUBFIELD_LABELS.objective}</span>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              rows={2}
              className={textareaClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_SUBFIELD_LABELS.assessment}</span>
            <textarea
              value={assessment}
              onChange={(event) => setAssessment(event.target.value)}
              rows={2}
              className={textareaClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--ink-2)]">{SOAP_SUBFIELD_LABELS.plan}</span>
            <textarea
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              rows={2}
              className={textareaClass}
            />
          </label>
        </div>
        {error ? <p className="text-sm font-semibold text-[var(--red-700)]">{error}</p> : null}
        <Btn type="submit" size="sm" loading={loading}>הוסף הערה</Btn>
      </form>
    </div>
  );
}
