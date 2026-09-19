"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Card, SectionHeading } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { useToast } from "@/components/dashboard/ui/toast";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

type ApproveResponse = { data: { suggestion: PromptSuggestion; published: boolean; message: string } };
type RejectResponse = { data: PromptSuggestion };

const CATEGORY_LABEL: Record<string, string> = {
  prompt: "פרומפט",
  knowledge_base: "מאגר ידע",
  tool: "כלי",
  backend_logic: "לוגיקת שרת",
  conversation_flow: "זרימת שיחה",
};

export function ImprovementsPageClient() {
  const [items, setItems] = useState<PromptSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [consolidating, setConsolidating] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prompt-suggestions");
      if (res.ok) {
        const d = (await res.json()) as { data: { items: PromptSuggestion[] } };
        setItems(d.data.items ?? []);
      } else {
        setError("שגיאה בטעינת ההצעות. נסה לרענן את הדף.");
      }
    } catch {
      setError("שגיאה בטעינת ההצעות. נסה לרענן את הדף.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/prompt-suggestions/${id}/${action}`, { method: "POST" });
      if (!res.ok) {
        toast("הפעולה נכשלה", "error");
        return;
      }
      let status: string;
      let message: string;
      if (action === "approve") {
        const body = (await res.json()) as ApproveResponse;
        status = body.data.suggestion.status;
        message = body.data.message;
      } else {
        const body = (await res.json()) as RejectResponse;
        status = body.data.status;
        message = "";
      }
      toast(message || `הצעה סומנה ${status}`, "success");
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast("התוצאה לא ידועה — הרענן את הדף כדי לבדוק את הסטטוס בפועל.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function consolidateAll() {
    setConsolidating(true);
    try {
      const res = await fetch("/api/prompt-suggestions/consolidate", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast(body?.error?.message || "האיחוד נכשל", "error");
        return;
      }
      toast("ההצעות אוחדו לפרומפט אחד — ממתין לאישור", "success");
      await fetchData();
    } catch {
      toast("התוצאה לא ידועה — הרענן את הדף כדי לבדוק את הסטטוס בפועל.", "error");
    } finally {
      setConsolidating(false);
    }
  }

  const promptCandidateCount = items.filter((s) => s.category === "prompt").length;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 style={{ font: "var(--type-page-title)", color: "var(--text-primary)" }}>הצעות תיקון</h1>
        {promptCandidateCount >= 2 && (
          <Btn variant="soft" size="sm" loading={consolidating} onClick={() => void consolidateAll()}>
            אחד הכל
          </Btn>
        )}
      </div>

      {loading ? null : error ? (
        <EmptyState title="שגיאה" subtitle={error} />
      ) : items.length === 0 ? (
        <EmptyState title="אין הצעות ממתינות" subtitle="הצעות תיקון שנוצרות מהניתוח השבועי יופיעו כאן." />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id}>
              <SectionHeading title={s.patternSummary} action={<Badge tone="info">{CATEGORY_LABEL[s.category] ?? s.category}</Badge>} />
              {s.proposedChange && (
                <p className="text-[13.5px] mt-2" style={{ color: "var(--text-secondary)" }}>{s.proposedChange}</p>
              )}
              {s.category === "prompt" && s.suggestedPrompt && (
                <pre
                  className="mt-3 p-3 text-[12px] whitespace-pre-wrap"
                  style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-2)", color: "var(--text-secondary)" }}
                >
                  {s.suggestedPrompt}
                </pre>
              )}
              <div className="flex gap-2 mt-4">
                <Btn variant="primary" size="sm" loading={busyId === s.id} onClick={() => void act(s.id, "approve")}>
                  אשר
                </Btn>
                <Btn variant="dangerSoft" size="sm" loading={busyId === s.id} onClick={() => void act(s.id, "reject")}>
                  דחה
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
