"use client";
import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import { PlayIcon } from "@/components/dashboard/icons";

/**
 * Recordings sit in a private bucket, so the URL is fetched on demand and
 * signed. Mirrors the player in the calls drawer.
 */
export function CallRecordingPlayer({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    if (url || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/voice/calls/${callId}/recording`);
      if (!res.ok) throw new Error();
      const payload = (await res.json()) as { data: { url: string } };
      setUrl(payload.data.url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        ההקלטה אינה זמינה
      </p>
    );
  }

  if (!url) {
    return (
      <Btn variant="soft" size="sm" onClick={load} loading={loading}>
        <PlayIcon size={12} />
        נגן הקלטה
      </Btn>
    );
  }

  return (
    <audio
      src={url}
      controls
      className="w-full h-8"
      style={{ accentColor: "var(--active)", borderRadius: "var(--radius-2)" }}
    />
  );
}
