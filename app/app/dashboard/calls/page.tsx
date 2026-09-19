"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { CallStatusBadge, CallCategoryBadge } from "@/components/dashboard/ui/call-status";
import { Table } from "@/components/dashboard/ui/table";
import { Tabs } from "@/components/dashboard/ui/tabs";
import { Input } from "@/components/dashboard/ui/field";
import { PhoneIcon, ClockIcon, SparkleIcon, PlayIcon } from "@/components/dashboard/icons";
import { Btn } from "@/components/dashboard/ui/btn";
import { Drawer } from "@/components/dashboard/ui/drawer";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { VoiceCall, TranscriptItem } from "@/types/domain/voice-call";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return formatIsraelDateTime(iso);
}

function fmtDuration(secs: number | null) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")} דק'` : `${s}ש'`;
}

// ─── CallDrawer ────────────────────────────────────────────────────────────────

function TranscriptBubble({ item }: { item: TranscriptItem }) {
  const isAgent = item.role === "agent";
  return (
    <div className={`flex gap-2 ${isAgent ? "flex-row-reverse" : ""}`}>
      <span
        className="mt-0.5 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
        style={{ background: "var(--surface-field)", color: "var(--text-secondary)" }}
      >
        {isAgent ? "ת" : "ל"}
      </span>
      <div
        className="max-w-[75%] rounded-[14px] px-3 py-2 text-[13px] leading-relaxed"
        style={
          isAgent
            ? { background: "var(--active-wash)", color: "var(--text-accent)", borderStartEndRadius: "4px" }
            : { background: "var(--surface-sunken)", color: "var(--text-primary)", borderStartStartRadius: "4px" }
        }
      >
        {item.message}
        {item.time_in_call_secs != null && (
          <span className="mt-0.5 block text-[10px] opacity-50">
            {String(Math.floor(item.time_in_call_secs / 60)).padStart(2, "0")}:{String(item.time_in_call_secs % 60).padStart(2, "0")}
          </span>
        )}
      </div>
    </div>
  );
}

function AudioPlayer({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function load() {
    if (url || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/voice/calls/${callId}/recording`);
      if (!res.ok) throw new Error();
      const d = await res.json() as { data: { url: string } };
      setUrl(d.data.url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (error) return <p className="text-xs" style={{ color: "var(--text-muted)" }}>הקלטה לא זמינה</p>;

  if (!url) {
    return (
      <button
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
        style={{ background: "var(--active-wash)", color: "var(--text-accent)", transition: "var(--transition-color)" }}
        onClick={load}
        disabled={loading}
      >
        {loading ? (
          <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <PlayIcon size={12} />
        )}
        {loading ? "טוען…" : "נגן הקלטה"}
      </button>
    );
  }

  return (
    <audio
      ref={audioRef}
      src={url}
      controls
      className="w-full h-8 rounded-lg"
      style={{ accentColor: "var(--active)" }}
    />
  );
}

type CallTab = "summary" | "transcript" | "recording";

function CallDrawer({
  call,
  onClose,
}: {
  call: VoiceCall;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<CallTab>("summary");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);

  return (
    <Drawer open onClose={onClose} title={call.fromNumber} subtitle={fmtDate(call.startedAt)} width={440}>
      <div className="px-5 py-4 space-y-5">
        {/* Meta row */}
        <div className="flex flex-wrap gap-2">
          <CallStatusBadge status={call.status} />
          <CallCategoryBadge category={call.callCategory} />
          {call.durationSeconds != null && (
            <Badge tone="neutral">
              <ClockIcon size={10} /> {fmtDuration(call.durationSeconds)}
            </Badge>
          )}
        </div>

        <Tabs
          variant="pill"
          value={tab}
          onChange={setTab}
          className="w-full [&>button]:flex-1"
          items={[
            { value: "summary", label: "סיכום" },
            { value: "transcript", label: "תמלול" },
            { value: "recording", label: "הקלטה" },
          ]}
        />

        {tab === "summary" && (
          <>
            {call.aiSummary ? (
              <div className="p-3" style={{ borderRadius: "var(--radius-2)", background: "var(--active-wash)" }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <SparkleIcon size={13} className="text-[var(--text-accent)]" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-accent)" }}>סיכום AI</p>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>{call.aiSummary}</p>
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>אין סיכום AI לשיחה הזו.</p>
            )}
            {call.customerId ? (
              <div className="space-y-2 p-3" style={{ borderRadius: "var(--radius-2)", border: "1px solid var(--border-field)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>משימת המשך מהשיחה</p>
                <Input
                  type="datetime-local"
                  value={taskDueAt}
                  onChange={(event) => setTaskDueAt(event.target.value)}
                />
                <Btn
                  type="button"
                  size="sm"
                  variant="soft"
                  loading={taskLoading}
                  disabled={!taskDueAt}
                  onClick={() => {
                    setTaskLoading(true);
                    setTaskMessage(null);
                    void fetch("/api/follow-ups", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        clinicId: call.clinicId,
                        customerId: call.customerId,
                        petId: call.petId,
                        voiceCallId: call.id,
                        reason: call.aiSummary ?? `מעקב אחרי שיחה מ-${call.fromNumber}`,
                        dueAt: new Date(taskDueAt).toISOString(),
                      }),
                    }).then((res) => {
                      setTaskMessage(res.ok ? "משימת המשך נוצרה" : "יצירת המשימה נכשלה");
                    }).finally(() => setTaskLoading(false));
                  }}
                >
                  צור משימה מהשיחה
                </Btn>
                {taskMessage ? <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{taskMessage}</p> : null}
              </div>
            ) : null}
          </>
        )}

        {tab === "recording" && (
          call.recordingStoragePath ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>הקלטת השיחה</p>
              <AudioPlayer callId={call.id} />
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>אין הקלטה שמורה לשיחה הזו.</p>
          )
        )}

        {tab === "transcript" && (
          call.transcript && call.transcript.length > 0 ? (
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>תמלול השיחה</p>
              <div className="space-y-3">
                {call.transcript.map((item, i) => (
                  <TranscriptBubble key={i} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>אין תמלול שמור לשיחה הזו.</p>
          )
        )}
      </div>
    </Drawer>
  );
}

// ─── Main table ────────────────────────────────────────────────────────────────

type CategoryFilter = "all" | "operation" | "information";

export default function CallsPage() {
  const [items, setItems] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selected, setSelected] = useState<VoiceCall | null>(null);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/voice/calls");
      if (res.ok) {
        const d = await res.json() as { data: { items: VoiceCall[] } };
        setItems(d.data.items ?? []);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData(true);
    });
    const intervalId = window.setInterval(() => {
      void fetchData(false);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [fetchData]);

  const filtered = category === "all"
    ? items
    : items.filter(c => c.callCategory === category);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>שיחות</h1>

        <Tabs
          variant="pill"
          size="sm"
          value={category}
          onChange={setCategory}
          items={[
            { value: "all", label: "הכול" },
            { value: "operation", label: "פעולה" },
            { value: "information", label: "מידע" },
          ]}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="אין שיחות"
          subtitle="שיחות שתומר יקבל יופיעו כאן"
        />
      ) : (
        <Table
          rows={filtered}
          rowKey={(call) => call.id}
          onRowClick={setSelected}
          columns={[
            {
              key: "caller",
              header: "מתקשר",
              render: (call) => (
                <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--text-primary)" }}>
                  <PhoneIcon size={13} className="text-[var(--text-muted)]" />
                  {call.fromNumber}
                </span>
              ),
            },
            {
              key: "date",
              header: "תאריך ושעה",
              render: (call) => <span style={{ color: "var(--text-secondary)" }}>{fmtDate(call.startedAt)}</span>,
            },
            {
              key: "duration",
              header: "משך",
              render: (call) => <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{fmtDuration(call.durationSeconds)}</span>,
            },
            {
              key: "category",
              header: "סוג",
              render: (call) => <CallCategoryBadge category={call.callCategory} />,
            },
            {
              key: "status",
              header: "סטטוס",
              render: (call) => <CallStatusBadge status={call.status} />,
            },
            {
              key: "summary",
              header: "סיכום",
              className: "max-w-[220px]",
              render: (call) => (
                call.aiSummary ? (
                  <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>{call.aiSummary}</p>
                ) : (
                  <span style={{ color: "var(--text-faint)" }}>—</span>
                )
              ),
            },
          ]}
        />
      )}

      {/* Call drawer */}
      {selected && <CallDrawer call={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
