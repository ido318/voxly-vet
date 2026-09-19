import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { formatIsraelDateTime } from "@/lib/israel-date";
import { CallStatusBadge, CallDirection, CallCategoryBadge } from "@/components/dashboard/ui/call-status";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { CallRecordingPlayer } from "@/app/dashboard/voice/[callId]/call-recording-player";
import type { VoiceCall } from "@/types/domain/voice-call";

/**
 * A single call Tomer handled. Reached from the pre-visit brief on the
 * appointment and visit screens, so it opens on its own rather than in the
 * calls drawer.
 */

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")} דק׳` : `${s} שנ׳`;
}

/** One labelled line inside a detail sheet, hairline-separated from the next. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline gap-4 px-4"
      style={{ minHeight: "var(--row-h-sub)", borderBottom: "var(--rule-row)" }}
    >
      <span
        className="flex-shrink-0 text-[12px] w-28"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span className="flex-1 text-[13px] py-2" style={{ color: "var(--text-primary)" }}>
        {children}
      </span>
    </div>
  );
}

function Sheet({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--label-gap)]">
      {title && (
        <h2 className="gv-section-label" style={{ color: "var(--text-muted)" }}>{title}</h2>
      )}
      <div
        style={{
          background: "var(--surface-raised)",
          borderRadius: "var(--radius-3)",
          boxShadow: "var(--shadow-raised)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default async function VoiceCallDetailPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;
  const call = await dashboardApiFetch<VoiceCall>(`/api/voice/calls/${callId}`);

  if (!call) {
    return (
      <div style={{ padding: "var(--page-gutter)" }}>
        <EmptyState
          title="השיחה לא נמצאה"
          subtitle="ייתכן שהיא נמחקה או שהקישור שגוי"
          action={
            <Link href="/dashboard/calls" className="text-[12px]" style={{ color: "var(--text-link)" }}>
              ‹ חזרה לשיחות
            </Link>
          }
        />
      </div>
    );
  }

  const duration = formatDuration(call.durationSeconds);

  return (
    <div
      className="flex flex-col gap-[var(--section-gap)]"
      style={{ padding: "var(--page-gutter)", maxWidth: "var(--content-max)" }}
    >
      {/* Page header */}
      <header className="flex flex-col gap-1">
        <Link
          href="/dashboard/calls"
          className="text-[12px] w-fit"
          style={{ color: "var(--text-link)" }}
        >
          ‹ חזרה לשיחות
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="gv-ltr" style={{ font: "var(--type-page-title)", letterSpacing: "var(--track-title)" }}>
            {call.fromNumber}
          </h1>
          <CallStatusBadge status={call.status} />
          <CallDirection direction={call.direction} />
          <CallCategoryBadge category={call.callCategory} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          {formatIsraelDateTime(call.startedAt)}
          {duration && <span className="gv-data"> · {duration}</span>}
        </p>
      </header>

      <div className="grid gap-[var(--col-gap)] lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="flex flex-col gap-[var(--section-gap)] min-w-0">
          {/* Tomer's summary — named and credited, never anthropomorphised */}
          <Sheet title="סיכום השיחה">
            {call.aiSummary ? (
              <div className="px-4 py-3">
                <p
                  className="whitespace-pre-wrap text-[13.5px]"
                  style={{ color: "var(--text-primary)", lineHeight: "var(--lh-body)" }}
                >
                  {call.aiSummary}
                </p>
                <p className="mt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  נוסח על ידי תומר
                </p>
              </div>
            ) : (
              <div className="px-4">
                <EmptyState title="אין סיכום לשיחה" subtitle="תומר מסכם שיחות לאחר סיומן" compact />
              </div>
            )}
          </Sheet>

          <Sheet title="תמלול">
            {call.transcript?.length ? (
              <ul>
                {call.transcript.map((item, index) => {
                  const isAgent = item.role === "agent";
                  return (
                    <li
                      key={index}
                      className="flex gap-3 px-4 py-3"
                      style={{ borderBottom: "var(--rule-row)" }}
                    >
                      <span className="flex-shrink-0 flex flex-col items-start gap-1 w-16">
                        <span
                          className="text-[12px]"
                          style={{
                            color: isAgent ? "var(--text-primary)" : "var(--text-secondary)",
                            fontWeight: "var(--w-semibold)",
                          }}
                        >
                          {isAgent ? "תומר" : "מתקשר"}
                        </span>
                        {item.time_in_call_secs != null && (
                          <span className="gv-mono text-[11px]" style={{ color: "var(--text-faint)" }}>
                            {formatDuration(item.time_in_call_secs)}
                          </span>
                        )}
                      </span>
                      <p
                        className="flex-1 whitespace-pre-wrap text-[13px] min-w-0"
                        style={{ color: "var(--text-primary)", lineHeight: "var(--lh-body)" }}
                      >
                        {item.message}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4">
                <EmptyState title="אין תמלול לשיחה" compact />
              </div>
            )}
          </Sheet>
        </div>

        {/* Contextual detail — at the inline end, opposite the rail */}
        <div className="flex flex-col gap-[var(--section-gap)] min-w-0">
          <Sheet title="פרטי שיחה">
            <Row label="מאת">
              <span className="gv-ltr block">{call.fromNumber}</span>
            </Row>
            <Row label="אל">
              <span className="gv-ltr block">{call.toNumber}</span>
            </Row>
            <Row label="התחילה">
              <span className="gv-data">{formatIsraelDateTime(call.startedAt)}</span>
            </Row>
            {call.endedAt && (
              <Row label="הסתיימה">
                <span className="gv-data">{formatIsraelDateTime(call.endedAt)}</span>
              </Row>
            )}
            {duration && (
              <Row label="משך">
                <span className="gv-data">{duration}</span>
              </Row>
            )}
            <Row label="לקוח">
              {call.customerId ? (
                <Link
                  href={`/dashboard/clients?customerId=${call.customerId}`}
                  style={{ color: "var(--text-link)" }}
                >
                  הצג לקוח
                </Link>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>מתקשר לא מזוהה</span>
              )}
            </Row>
          </Sheet>

          <Sheet title="הקלטה">
            {call.recordingStoragePath || call.recordingUrl ? (
              <div className="px-4 py-3">
                <CallRecordingPlayer callId={call.id} />
              </div>
            ) : (
              <div className="px-4">
                <EmptyState title="אין הקלטה לשיחה" compact />
              </div>
            )}
          </Sheet>

          {/* Debug identifiers — present for support, kept quiet */}
          {call.twilioCallSid && (
            <Sheet title="מזהים">
              <Row label="Twilio SID">
                <span className="gv-mono gv-ltr block text-[12px]" style={{ color: "var(--text-muted)" }}>
                  {call.twilioCallSid}
                </span>
              </Row>
              {call.elevenLabsConversationId && (
                <Row label="ElevenLabs">
                  <span className="gv-mono gv-ltr block text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {call.elevenLabsConversationId}
                  </span>
                </Row>
              )}
            </Sheet>
          )}
        </div>
      </div>
    </div>
  );
}
