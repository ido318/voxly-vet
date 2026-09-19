import { Card } from "@/components/dashboard/ui/card";
import { ApprovalControls } from "@/components/dashboard/ai/approval-controls";
import { AiSafetyNotice } from "@/components/dashboard/ai/ai-safety-notice";
import { SourceRefsList } from "@/components/dashboard/ai/source-refs-list";
import type { AiSummary } from "@/types/domain/ai-summary";

export function AiDraftPanel({
  artifact,
  sourceRefs = [],
}: {
  artifact: AiSummary;
  sourceRefs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <Card>
      <div className="space-y-3">
        <AiSafetyNotice />
        <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">{artifact.draftText}</p>
        <SourceRefsList refs={sourceRefs} />
        {artifact.status === "draft" ? <ApprovalControls artifactId={artifact.id} /> : null}
      </div>
    </Card>
  );
}
