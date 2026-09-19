"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";

export function ApprovalControls({ artifactId }: { artifactId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function review(action: "approve" | "reject") {
    setLoading(action);
    setMessage(null);
    const response = await fetch(`/api/ai/artifacts/${artifactId}/${action}`, {
      method: "POST",
      headers: action === "reject" ? { "Content-Type": "application/json" } : undefined,
      body: action === "reject" ? JSON.stringify({ reason }) : undefined,
    });
    setLoading(null);
    setMessage(response.ok ? "עודכן" : "העדכון נכשל");
    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="סיבת דחייה"
        className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
      />
      <div className="flex gap-2">
        <Btn type="button" size="sm" loading={loading === "approve"} onClick={() => void review("approve")}>
          אשר
        </Btn>
        <Btn
          type="button"
          size="sm"
          variant="dangerSoft"
          loading={loading === "reject"}
          disabled={!reason.trim()}
          onClick={() => void review("reject")}
        >
          דחה
        </Btn>
      </div>
      {message ? <p className="text-xs font-semibold text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
