import { Badge } from "@/components/dashboard/ui/badge";

/**
 * Tomer is named and credited, never anthropomorphised — and no sparkle or
 * robot iconography sits on his surfaces.
 */
export function AiSafetyNotice() {
  return (
    <div
      className="px-3 py-2 text-[13px]"
      style={{
        borderRadius: "var(--radius-2)",
        background: "var(--status-pending-wash)",
        color: "var(--text-secondary)",
      }}
    >
      <Badge tone="pending">לאישור</Badge>
      <span className="ms-2">טיוטה אינה רשומה רשמית עד אישור וטרינר או מנהל.</span>
    </div>
  );
}
