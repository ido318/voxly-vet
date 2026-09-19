import { Badge } from "@/components/dashboard/ui/badge";

export function dueTone(dueAt: string | null, now = new Date()): "muted" | "amber" | "red" {
  if (!dueAt) return "muted";
  const due = new Date(dueAt).getTime();
  if (due < now.getTime()) return "red";
  if (due - now.getTime() <= 24 * 60 * 60 * 1000) return "amber";
  return "muted";
}

export function DueBadge({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return <Badge color="muted">ללא תאריך</Badge>;
  const tone = dueTone(dueAt);
  return <Badge color={tone}>{tone === "red" ? "באיחור" : tone === "amber" ? "להיום" : "מתוזמן"}</Badge>;
}
